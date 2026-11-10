import {ensure} from './db.js';
import {returnRoute} from './watch-route.js';
import {validateWindows,acceptsWindows} from './time-windows.js';
import {selections, expand, origins, destinations, resolve, contains} from './locations.js';
export const today = () => new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export const plusDays = (date, days) => new Date(Date.parse(date+'T00:00:00Z')+days*86400000).toISOString().slice(0,10);
export const weekday = date => (new Date(date+'T00:00:00Z').getUTCDay()+6)%7;
function date(value) {
  ensure(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value, '请检查日期。');
  return value;
}
function number(value, fallback) {
  const n = value === undefined || value === '' ? fallback : typeof value === 'boolean' || value === null || typeof value === 'object' ? NaN : Number(value);
  ensure(Number.isFinite(n), '请检查人数、预算与筛选条件。'); return n;
}
export function policy(d) {
  const auto_enabled = d.auto_enabled ?? true, alerts_enabled = d.alerts_enabled ?? true;
  const interval_hours = number(d.interval_hours,6), min_drop = number(d.min_drop,100);
  ensure(typeof auto_enabled === 'boolean' && typeof alerts_enabled === 'boolean', '请选择是否开启自动查价和价格提醒。');
  ensure([1,3,6,12,24].includes(interval_hours), '查价间隔可选 1、3、6、12 或 24 小时。');
  ensure(min_drop >= 1 && min_drop <= 1000000, '降价提醒金额须为 HK$1–1,000,000。');
  return {auto_enabled,alerts_enabled,interval_hours,min_drop};
}
export function validate(d, discovery = false) {
  const trip_type=d.trip_type ?? 'roundtrip';
  ensure(['roundtrip','oneway'].includes(trip_type), '请选择有效的行程类型。');
  const oneWay=trip_type==='oneway';
  const timeWindows=discovery && d.date_mode==='windows'?validateWindows(d.time_windows,oneWay):null;
  if(timeWindows) d={...d,start:timeWindows.outbound.start.slice(0,10),end:(timeWindows.inbound || timeWindows.outbound).end.slice(0,10)};
  if(oneWay && (d.date_mode==='fixed' || !discovery)) d={...d,end:d.start};
  const currency=d.currency ?? 'HKD';
  ensure(['HKD','CNY','USD','EUR','JPY','GBP','SGD','AUD','CAD'].includes(currency),'请选择支持的报价货币。');
  const origin_selections = selections(d.origins ?? [d.origin ?? 'airport:HKG']);
  const destination_selections = selections(d.destinations ?? [], discovery);
  const os = expand(origin_selections), ds = expand(destination_selections);
  ensure(discovery || !(os.length === 1 && ds.length === 1 && os[0].kind === 'airport' && os[0].id === ds[0].id), '出发机场和目的机场不能相同。');
  const start = date(d.start), end = date(d.end), mode = discovery ? 'fixed' : d.mode ?? 'fixed';
  ensure(['fixed','weekend'].includes(mode), '请选择固定日期或周末出行。');
  ensure(start >= today() && end >= start, '出发日期不能早于今天，结束日期不能早于出发日期。');
  const adults=number(d.adults,1),weeks=number(d.weeks,1),budget=number(d.budget,0),max_duration_hours=number(d.max_duration_hours,0),max_stops=number(d.max_stops,-1);
  ensure(Number.isInteger(adults) && adults>=1 && adults<=9 && Number.isInteger(weeks) && weeks>=1 && weeks<=4, '成人数须为 1–9，周末数量须为 1–4。');
  ensure(budget>=0 && budget<=1000000 && max_duration_hours>=0 && max_duration_hours<=72 && [-1,0,1,2,3].includes(max_stops), '请检查预算、每程最长时长或中转次数。');
  ensure(!oneWay || discovery || mode==='fixed','单程提醒请选择固定出发日期。');
  const config = {origin:os[0].code,origin_location:os[0],origin_locations:os,destination_locations:ds,origin_selections,destination_selections,destinations:ds.map(r=>r.code),start,end,mode,adults,weeks,budget,max_duration_hours,max_stops,currency,cabin:'M',...policy(d)};
  if(oneWay) config.trip_type='oneway';
  if(!discovery) { const route=returnRoute(d,config);if(route) config.return_route=route; }
  if (discovery) {
    const date_mode=d.date_mode ?? 'range';
    ensure(['range','fixed','windows'].includes(date_mode), '请选择有效的日期方式。');
    if(timeWindows) {
      for(const w of Object.values(timeWindows)) ensure(w.start.slice(0,10)>=today() && w.end.slice(0,10)<=plusDays(today(),365) && w.end.slice(0,10)<=plusDays(w.start.slice(0,10),180),'请选择未来一年内的时间范围，单次跨度不超过 180 天。');
      config.time_windows=timeWindows;
    }
    let min_nights=number(d.min_nights,2),max_nights=number(d.max_nights,5),weekdays=d.weekdays ?? [];
    ensure(os.length*Math.max(1,ds.length)<=120, '这次选择超过 120 组出发地与目的地组合，请缩小范围。');
    ensure(end<=plusDays(start,180) && end<=plusDays(today(),365), '请选择未来一年内的出发时间，单次日期跨度不超过 180 天。');
    const selected=d.nights !== undefined ? d.nights : (Number.isInteger(min_nights) && Number.isInteger(max_nights) && min_nights>=1 && max_nights<=10 && min_nights<=max_nights ? Array.from({length:max_nights-min_nights+1},(_,i)=>min_nights+i) : []);
    ensure(oneWay || date_mode!=='range' || (Array.isArray(selected) && selected.every(n=>Number.isInteger(n)&&n>=1&&n<=10)), '请检查停留晚数。');
    const nights=oneWay || date_mode!=='range'?[]:[...new Set(selected)].sort((a,b)=>a-b);
    min_nights=nights.length?Math.min(...nights):0;max_nights=nights.length?Math.max(...nights):0;
    ensure(Array.isArray(weekdays) && weekdays.every(n=>Number.isInteger(n)&&n>=0&&n<7), '请检查出发星期。');
    if(d.date_pairs!==undefined) {
      ensure(!oneWay && date_mode==='fixed' && Array.isArray(d.date_pairs) && d.date_pairs.length>=1 && d.date_pairs.length<=4,'请至少选择一个周末，最多选择四个。');
      const pairs=d.date_pairs.map(p=>{
        ensure(p && typeof p==='object','请检查所选周末。');
        const start=date(p.start),end=date(p.end);
        ensure(start>=today() && end<=plusDays(today(),365) && weekday(start)===5 && end===plusDays(start,1),'请检查所选周末的往返日期。');
        return {start,end};
      });
      config.date_pairs=[...new Map(pairs.map(p=>[p.start,p])).values()].sort((a,b)=>a.start.localeCompare(b.start));
      ensure(start===config.date_pairs[0].start && end===config.date_pairs.at(-1).end,'所选周末与日期范围不一致，请重新选择。');
      ensure(os.length*Math.max(1,ds.length)*config.date_pairs.length<=120,'所选周末及地点超过 120 组查询，请缩小范围。');
    }
    if(d.comparison===true) {
      ensure(date_mode==='fixed' && !config.date_pairs && os.length===1 && ds.length===1 && os[0].kind==='airport' && ds[0].kind==='airport','航线方案比较请选择一组机场与固定日期。');
      config.comparison=true;
    }
    Object.assign(config,{locale:['zh-CN','en'].includes(d.locale)?d.locale:'zh-CN',trip_type,date_mode,nights,min_nights,max_nights,weekdays:date_mode!=='range'?[]:[...new Set(weekdays)].sort()});
  }
  return config;
}
export function jobs(c) {
  const first = plusDays(c.start,(5-weekday(c.start)+7)%7);
  const dates = c.mode === 'weekend' ? Array.from({length:c.weeks},(_,i)=>[plusDays(first,i*7),plusDays(first,i*7+2)]) : [[c.start,c.end]];
  return dates.flatMap(([departure,arrival])=>origins(c).flatMap(o=>destinations(c).filter(d=>!(o.kind==='airport' && o.id===d.id)).map(d=>({destination:d.code,location_id:d.id,origin_id:o.id,departure,arrival}))));
}
function localTime(value) { return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value) && Number.isFinite(Date.parse(value)); }
export function matches(offer,c,j) {
  if(c.trip_type==='oneway') return acceptsOneWay(offer,{...c,start:j.departure,end:j.departure,date_mode:'fixed',weekdays:[],budget:0},j);
  const out=offer.outbound, back=offer.inbound;
  if (!out || !back || typeof offer.price!=='number' || !Number.isFinite(offer.price) || offer.price<=0) return false;
  const o=resolve(j.origin_id || c.origin_location || c.origin), d=resolve(j.location_id || j.destination);
  if (!contains(o,out.from) || !(c.return_route?back.to===c.return_route.to:contains(o,back.to)) || !contains(d,out.to) || !(c.return_route?back.from===c.return_route.from:contains(d,back.from)) || out.from===out.to) return false;
  if (![out.departureTime,out.arrivalTime,back.departureTime,back.arrivalTime].every(localTime)) return false;
  if (out.departureTime.slice(0,10)!==j.departure) return false;
  if (c.mode==='fixed' && back.departureTime.slice(0,10)!==j.arrival) return false;
  if (c.mode==='weekend' && (Number(out.departureTime.slice(11,13))>=6 || Number(back.arrivalTime.slice(11,13))>=6 || back.arrivalTime.slice(0,10)!==j.arrival)) return false;
  return [out,back].every(leg=>Number.isInteger(leg.stops) && leg.stops>=0 && (c.max_stops<0 || leg.stops<=c.max_stops) && Number.isFinite(leg.durationSeconds) && leg.durationSeconds>0 && (!c.max_duration_hours || leg.durationSeconds<=c.max_duration_hours*3600));
}
export function accepts(offer,c,j) {
  if(!acceptsWindows(offer,c)) return false;
  if(c.trip_type==='oneway') return acceptsOneWay(offer,c,j);
  const out=offer.outbound,back=offer.inbound;
  if (!out || !back || !localTime(out.arrivalTime)) return false;
  const dep=out.departureTime?.slice(0,10),ret=back.departureTime?.slice(0,10),nights=(Date.parse(ret)-Date.parse(out.arrivalTime.slice(0,10)))/86400000;
  if(c.date_mode==='windows') {
    if(c.budget && offer.price>c.budget) return false;
  } else if (c.date_mode==='fixed') {
    const selected=c.date_pairs ? (j.window ? j.window.start===dep && j.window.end===ret : c.date_pairs.some(p=>p.start===dep && p.end===ret)) : dep===c.start && ret===c.end;
    if(!selected || (c.budget && offer.price>c.budget)) return false;
  } else if (!(dep>=c.start && dep<=c.end) || (c.weekdays.length && !c.weekdays.includes(weekday(dep))) || (Array.isArray(c.nights) ? c.nights.length>0 && !c.nights.includes(nights) : !(nights>=c.min_nights && nights<=c.max_nights)) || (c.budget && offer.price>c.budget)) return false;
  try { return matches(offer,c,{...j,location_id:j.location_id || 'airport:'+out.to,departure:dep,arrival:ret}); } catch { return false; }
}
function acceptsOneWay(offer,c,j) {
  const out=offer.outbound;
  if(!acceptsWindows(offer,c)) return false;
  if(!out || offer.inbound || ![out.departureTime,out.arrivalTime].every(localTime)) return false;
  const dep=out.departureTime.slice(0,10);
  if(!(dep>=c.start && dep<=c.end) || (c.date_mode==='fixed' && dep!==c.start) || (c.weekdays.length && !c.weekdays.includes(weekday(dep)))) return false;
  if(typeof offer.price!=='number' || !Number.isFinite(offer.price) || offer.price<=0 || (c.budget && offer.price>c.budget)) return false;
  try {
    if(!contains(resolve(j.origin_id),out.from) || !contains(resolve(j.location_id || 'airport:'+out.to),out.to) || out.from===out.to) return false;
    return Number.isInteger(out.stops) && out.stops>=0 && (c.max_stops<0 || out.stops<=c.max_stops) && Number.isFinite(out.durationSeconds) && out.durationSeconds>0 && (!c.max_duration_hours || out.durationSeconds<=c.max_duration_hours*3600);
  } catch { return false; }
}
export const routeKey = (c,j,o) => JSON.stringify([o.outbound.from,o.outbound.to,o.inbound?.from || '',o.inbound?.to || '',o.outbound.departureTime.slice(0,10),o.inbound?.departureTime.slice(0,10) || '',o.inbound?.arrivalTime.slice(0,10) || '']);
