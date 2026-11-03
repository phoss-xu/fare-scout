/** Public trip data only. Shared by the browser and Workers validation boundary. */
const check=(ok)=>{if(!ok)throw new Error('行程信息不完整，请重新查询后再试。');};
const object=value=>value && typeof value==='object' && !Array.isArray(value);
function text(value,max=160) {check(typeof value==='string' && value.length<=max);return value;}
function clock(value) {text(value,40);check(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value) && Number.isFinite(Date.parse(value)));return value;}
function airport(value) {check(typeof value==='string' && /^[A-Z]{3}$/.test(value));return value;}
function leg(value,segment=false) {
  check(object(value));
  const result={from:airport(value.from),to:airport(value.to),departureTime:clock(value.departureTime),arrivalTime:clock(value.arrivalTime)};
  check(result.from!==result.to);
  if(value.durationSeconds!=null) {check(Number.isFinite(value.durationSeconds) && value.durationSeconds>0);result.durationSeconds=value.durationSeconds;}
  for(const key of ['fromCity','toCity','fromName','toName','fromCountry','toCountry','carrier','carrierName','flightNumber','cabinClass']) if(value[key]!=null)result[key]=text(value[key]);
  if(!segment) {
    check(Number.isInteger(value.stops) && value.stops>=0 && value.stops<=10);result.stops=value.stops;
    check(Array.isArray(value.segments) && value.segments.length<=12);result.segments=value.segments.map(s=>leg(s,true));
  }
  return result;
}
export function tripSnapshot(data) {
  check(object(data) && object(data.offer));const o=data.offer;
  check(typeof o.price==='number' && Number.isFinite(o.price) && o.price>0 && o.price<=10000000);
  check(Number.isInteger(data.adults) && data.adults>=1 && data.adults<=9);
  check(['HKD','CNY','USD','EUR','JPY','GBP','SGD','AUD','CAD'].includes(data.currency ?? 'HKD') && (data.cabin ?? 'M')==='M');
  const offer={price:o.price,outbound:leg(o.outbound)};
  if(data.currency && data.currency!=='HKD') offer.currency=data.currency;
  if(o.inbound) offer.inbound=leg(o.inbound);
  if(o.bookingUrl) {const url=new URL(text(o.bookingUrl,2048));check(url.protocol==='https:' && !url.username && !url.password);offer.bookingUrl=url.href;}
  for(const key of ['destination_name','destination_country']) if(o[key]!=null)offer[key]=text(o[key]);
  offer.baggage={};for(const key of ['personalItem','cabinBag','checkedBag']) {const n=o.baggage?.[key];if(n!=null){check(Number.isInteger(n) && n>=0 && n<=20);offer.baggage[key]=n;}}
  const checked_at=data.checked_at ?? null;
  check(checked_at===null || (typeof checked_at==='string' && checked_at.length<=40 && Number.isFinite(Date.parse(checked_at))));
  const filters={max_stops:data.filters?.max_stops ?? -1,max_duration_hours:data.filters?.max_duration_hours ?? 0};
  check([-1,0,1,2,3].includes(filters.max_stops) && typeof filters.max_duration_hours==='number' && Number.isFinite(filters.max_duration_hours) && filters.max_duration_hours>=0 && filters.max_duration_hours<=72);
  return {offer,adults:data.adults,currency:data.currency ?? 'HKD',cabin:'M',checked_at,filters};
}
export function tripIdentity(s) {
  const legs=[s.offer.outbound,s.offer.inbound].filter(Boolean).map(l=>[l.from,l.to,l.departureTime,l.arrivalTime,l.cabinClass || '',(l.segments || []).map(v=>[v.from,v.to,v.departureTime,v.arrivalTime,v.carrier || '',v.flightNumber || '',v.cabinClass || ''])]);
  return JSON.stringify([s.adults,s.cabin,s.currency,...legs]);
}
export function watchForTrip(s,watches) {
  const o=s.offer.outbound,b=s.offer.inbound;
  return watches.find(w=>w.mode==='fixed' && (w.trip_type || 'roundtrip')===(b?'roundtrip':'oneway') && w.origin===o.from && w.destinations?.length===1 && w.destinations[0]===o.to &&
    w.start===o.departureTime.slice(0,10) && w.end===(b?.departureTime || o.departureTime).slice(0,10) && w.adults===s.adults && (w.cabin || 'M')===s.cabin && (w.currency || 'HKD')===s.currency &&
    (w.max_stops ?? -1)===s.filters.max_stops && (w.max_duration_hours || 0)===s.filters.max_duration_hours);
}
