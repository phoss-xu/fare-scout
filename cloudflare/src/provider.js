import {resolve,label} from './locations.js';
import {matches,accepts,routeKey,plusDays} from './domain.js';
import {windowArguments} from './time-windows.js';
import {suitable} from './travel-time.js';
export class SourceError extends Error {
  constructor(code,retryable=false) { super(code); this.code=code;this.retryable=retryable; }
}
const fmt = value => value.slice(8,10)+'/'+value.slice(5,7)+'/'+value.slice(0,4);
export function argumentsFor(c,j,discovery) {
  const args={flyFrom:resolve(j.origin_id).code,flyTo:j.location_id?resolve(j.location_id).code:'anywhere',departureDate:fmt(discovery?c.start:j.departure),currency:c.currency || 'HKD',locale:c.locale || 'zh-CN',adults:c.adults,cabinClass:'M',sort:'price',allow_self_transfer:false};
  if(c.max_stops>=0) args.max_sector_stopovers=c.max_stops;
  if(discovery) {
    Object.assign(args,{departureDateTo:fmt(c.end),nights_in_dst_from:c.min_nights,nights_in_dst_to:c.max_nights,one_for_city:!c.daily && (!c.nights || c.nights.length===c.max_nights-c.min_nights+1)});
    if(c.date_mode==='fixed') {
      delete args.departureDateTo;delete args.nights_in_dst_from;delete args.nights_in_dst_to;
      args.returnDate=fmt(c.end);args.one_for_city=true;
    }
    if(c.budget) args.price_to=Math.floor(c.budget);
    if(c.weekdays.length) args.fly_days=c.weekdays.map(d=>(d+1)%7).join(',');
    if(c.daily && j.window?.red_eye) Object.assign(args,{dtime_from:0,dtime_to:5,ret_atime_from:0,ret_atime_to:5});
  } else {
    args.returnDate=fmt(j.arrival);
    if(c.mode==='weekend') Object.assign(args,{returnDate:fmt(plusDays(j.arrival,-1)),returnDateTo:fmt(j.arrival),dtime_from:0,dtime_to:5,ret_atime_from:0,ret_atime_to:5});
  }
  if(c.trip_type==='oneway') {
    for(const key of ['returnDate','returnDateTo','nights_in_dst_from','nights_in_dst_to']) delete args[key];
    args.one_for_city=true;
  }
  if(discovery && c.time_windows) {
    for(const key of ['nights_in_dst_from','nights_in_dst_to','fly_days']) delete args[key];
    Object.assign(args,windowArguments(c,fmt,plusDays));
  }
  if(discovery && c.comparison) args.one_for_city=false;
  return args;
}
async function bodyLimited(response) {
  const reader=response.body.getReader(),chunks=[];let size=0;
  for(;;) { const {done,value}=await reader.read();if(done) break;size+=value.length;if(size>4000000) { await reader.cancel();throw new SourceError('response_too_large'); } chunks.push(value); }
  const bytes=new Uint8Array(size);let offset=0;for(const c of chunks) { bytes.set(c,offset);offset+=c.length; }
  return new TextDecoder().decode(bytes);
}
export async function search(c,j,discovery=false) {
  let session;
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),22000);
  async function call(id,method,params) {
    let response;
    try { response=await fetch('https://mcp.kiwi.com',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json, text/event-stream',...(session?{'Mcp-Session-Id':session}:{})},body:JSON.stringify({jsonrpc:'2.0',id,method,params}),signal:controller.signal}); }
    catch { throw new SourceError('network',true); }
    if(!response.ok) { await response.body?.cancel();throw new SourceError('http_'+response.status,[408,429,500,502,503,504].includes(response.status)); }
    session=response.headers.get('Mcp-Session-Id') || session;
    let text;
    try { text=await bodyLimited(response); }
    catch(error) { if(error instanceof SourceError) throw error;throw new SourceError('network',true); }
    let message;
    try {
      if((response.headers.get('Content-Type')||'').includes('text/event-stream')) {
        message=text.split(/\r?\n\r?\n/).map(block=>block.split(/\r?\n/).filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trimStart()).join('\n')).filter(Boolean).map(data=>JSON.parse(data)).find(m=>m.id===id);
      } else message=JSON.parse(text);
    } catch { throw new SourceError('protocol'); }
    if(!message || message.error || message.id!==id || !message.result) throw new SourceError('protocol');
    return message.result;
  }
  try {
    await call(1,'initialize',{protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'fare-scout',version:'0.2'}});
    const result=await call(2,'tools/call',{name:'search-flight',arguments:argumentsFor(c,j,discovery)});
    if(result.isError) throw new SourceError('search_error');
    let data=result.structuredContent?.result || result.structuredContent;
    if(!Array.isArray(data?.itineraries)) {
      for(const item of result.content || []) if(item.type==='text') {
        try { const parsed=JSON.parse(item.text);if(Array.isArray(parsed?.itineraries)) { data=parsed;break; } }
        catch { /* MCP may include ordinary explanatory text alongside JSON. */ }
      }
    }
    if(data?.error || !Array.isArray(data?.itineraries)) throw new SourceError('result_shape');
    if(data.currency && data.currency!==(c.currency || 'HKD')) throw new SourceError('currency_mismatch');
    const offers=new Map();
    for(const offer of data.itineraries) {
      if(!offer || typeof offer!=='object') continue;
      if(!(discovery?accepts(offer,c,j):matches(offer,c,j))) continue;
      const travel=c.daily?suitable(offer,c,j.window):null;
      if(c.daily && (!travel || ['CN','HK','MO'].includes(resolve('airport:'+offer.outbound.to).country_code))) continue;
      let key=discovery?'':routeKey(c,j,offer),row={...offer,currency:c.currency || 'HKD'};
      if(discovery) {
        const airport=resolve('airport:'+offer.outbound.to);key=c.comparison?JSON.stringify([offer.outbound,offer.inbound || null]):c.daily?key:airport.city_code || airport.code;
        row={...offer,currency:c.currency || 'HKD',destination_name:label(airport.code),destination_country:airport.country_name,...(travel?{travel}:{} )};
      }
      if(!offers.has(key) || offer.price<offers.get(key).price) offers.set(key,row);
    }
    return [...offers.values()].sort((a,b)=>a.price-b.price);
  } finally { clearTimeout(timer); }
}
