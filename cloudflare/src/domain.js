import {ensure} from './db.js';
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
  const config = {origin:os[0].code,origin_location:os[0],origin_locations:os,destination_locations:ds,origin_selections,destination_selections,destinations:ds.map(r=>r.code),start,end,mode,adults,weeks,budget,max_duration_hours,max_stops,currency:'HKD',cabin:'M',...policy(d)};
  if (discovery) {
    const min_nights=number(d.min_nights,2),max_nights=number(d.max_nights,5),weekdays=d.weekdays ?? [];
    ensure(os.length*Math.max(1,ds.length)<=120, '这次选择超过 120 组出发地与目的地组合，请缩小范围。');
    ensure(end<=plusDays(start,180) && end<=plusDays(today(),365), '请选择未来一年内的出发时间，单次日期跨度不超过 180 天。');
    ensure(Number.isInteger(min_nights) && Number.isInteger(max_nights) && min_nights>=1 && max_nights<=30 && min_nights<=max_nights, '目的地停留晚数须为 1–30，最少不能大于最多。');
    ensure(Array.isArray(weekdays) && weekdays.every(n=>Number.isInteger(n)&&n>=0&&n<7), '请检查出发星期。');
    Object.assign(config,{min_nights,max_nights,weekdays:[...new Set(weekdays)].sort()});
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
  const out=offer.outbound, back=offer.inbound;
  if (!out || !back || typeof offer.price!=='number' || !Number.isFinite(offer.price) || offer.price<=0) return false;
  const o=resolve(j.origin_id || c.origin_location || c.origin), d=resolve(j.location_id || j.destination);
  if (!contains(o,out.from) || !contains(o,back.to) || !contains(d,out.to) || !contains(d,back.from) || out.from===out.to) return false;
  if (![out.departureTime,out.arrivalTime,back.departureTime,back.arrivalTime].every(localTime)) return false;
  if (out.departureTime.slice(0,10)!==j.departure) return false;
  if (c.mode==='fixed' && back.departureTime.slice(0,10)!==j.arrival) return false;
  if (c.mode==='weekend' && (Number(out.departureTime.slice(11,13))>=6 || Number(back.arrivalTime.slice(11,13))>=6 || back.arrivalTime.slice(0,10)!==j.arrival)) return false;
  return [out,back].every(leg=>Number.isInteger(leg.stops) && leg.stops>=0 && (c.max_stops<0 || leg.stops<=c.max_stops) && Number.isFinite(leg.durationSeconds) && leg.durationSeconds>0 && (!c.max_duration_hours || leg.durationSeconds<=c.max_duration_hours*3600));
}
export function accepts(offer,c,j) {
  const out=offer.outbound,back=offer.inbound;
  if (!out || !back || !localTime(out.arrivalTime)) return false;
  const dep=out.departureTime?.slice(0,10),ret=back.departureTime?.slice(0,10),nights=(Date.parse(ret)-Date.parse(out.arrivalTime.slice(0,10)))/86400000;
  if (!(dep>=c.start && dep<=c.end) || (c.weekdays.length && !c.weekdays.includes(weekday(dep))) || !(nights>=c.min_nights && nights<=c.max_nights) || (c.budget && offer.price>c.budget)) return false;
  try { return matches(offer,c,{...j,location_id:j.location_id || 'airport:'+out.to,departure:dep,arrival:ret}); } catch { return false; }
}
export const routeKey = (c,j,o) => JSON.stringify([o.outbound.from,o.outbound.to,o.inbound.from,o.inbound.to,o.outbound.departureTime.slice(0,10),o.inbound.departureTime.slice(0,10),o.inbound.arrivalTime.slice(0,10)]);
