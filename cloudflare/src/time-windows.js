import {ensure} from './db.js';

// Civil airport time: offsets in source timestamps must not shift the user's dates.
function timestamp(value) {
  ensure(typeof value==='string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value), '请选择完整的日期和时刻。');
  const parsed=new Date(value+':00Z');
  ensure(Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0,16)===value, '请检查日期和时刻。');
  return value;
}
export function validateWindows(data,oneWay) {
  ensure(data && typeof data==='object' && !Array.isArray(data), '请设置去程和返程时间范围。');
  function window(raw,title) {
    ensure(raw && typeof raw==='object' && !Array.isArray(raw), `请设置${title}时间范围。`);
    const start=timestamp(raw.start),end=timestamp(raw.end);
    ensure(end>=start, `${title}最晚时间不能早于最早时间，跨午夜请调整结束日期。`);
    return {start,end};
  }
  const outbound=window(data.outbound,'去程');
  if(oneWay) return {outbound};
  const inbound=window(data.inbound,'返程');
  ensure(['departure','arrival'].includes(data.inbound.basis), '请选择返程起飞或抵达时间。');
  return {outbound,inbound:{...inbound,basis:data.inbound.basis}};
}
export function withinWindow(value,window) {
  if(typeof value!=='string') return false;
  const civil=value.slice(0,16);
  return civil>=window.start && civil<=window.end;
}
export function acceptsWindows(offer,c) {
  if(!c.time_windows) return true;
  const {outbound,inbound}=c.time_windows;
  return withinWindow(offer.outbound?.departureTime,outbound) &&
    (!inbound || withinWindow(offer.inbound?.[inbound.basis==='arrival'?'arrivalTime':'departureTime'],inbound));
}
export function windowArguments(c,fmt,plusDays) {
  const {outbound,inbound}=c.time_windows;
  const args={departureDate:fmt(outbound.start.slice(0,10)),departureDateTo:fmt(outbound.end.slice(0,10)),one_for_city:false};
  if(inbound) {
    let start=inbound.start.slice(0,10),end=inbound.end.slice(0,10);
    if(inbound.basis==='arrival') {
      // Source return dates describe takeoff. Include earlier departures and
      // date-line crossings; exact arrival filtering happens locally.
      const earliest=plusDays(outbound.start.slice(0,10),-2);
      start=c.max_duration_hours ? [earliest,plusDays(start,-Math.ceil(c.max_duration_hours/24)-2)].sort().at(-1) : earliest;
      end=plusDays(end,2);
    }
    Object.assign(args,{returnDate:fmt(start),returnDateTo:fmt(end)});
  }
  return args;
}
