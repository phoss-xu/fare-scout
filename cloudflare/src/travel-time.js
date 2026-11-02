import calendar from '../../app/static/holidays.json';
import {plusDays,weekday} from './domain.js';

export function dayInfo(date) {
  const year=calendar.years.find(y=>y.year===Number(date.slice(0,4)));
  const holiday=year?.holidays.find(h=>date>=h.start && date<=h.end);
  const makeup=year?.holidays.some(h=>h.workdays.includes(date));
  return {off:!makeup && (!!holiday || weekday(date)>=5),reference:year?.status!=='official',holiday:holiday?.name || null};
}
const clock = value => value.slice(11,16);
const civil = value => Date.parse(value.slice(0,19)+'Z');

// The user's working calendar is mainland China, independent of the departure airport.
// Workday travel before 18:00 or a return after 06:00 uses one whole day of leave.
export function travelTime(offer) {
  const out=offer.outbound,back=offer.inbound;
  const start=out.departureTime.slice(0,10),end=back.arrivalTime.slice(0,10);
  const length=(Date.parse(end)-Date.parse(start))/86400000;
  if(!Number.isInteger(length) || length<0 || length>16 || civil(back.departureTime)<=civil(out.arrivalTime)) return null;
  const leave_dates=[];let reference=false,offDays=0;
  for(let i=0;i<=length;i++) {
    const date=plusDays(start,i),info=dayInfo(date);reference ||= info.reference;
    if(info.off) {offDays++;continue;}
    if(date===start && clock(out.departureTime)>='18:00') continue;
    if(date===end && clock(back.arrivalTime)<='06:00') continue;
    leave_dates.push(date);
  }
  let full_days=0;
  const arrival=out.arrivalTime.slice(0,10),departure=back.departureTime.slice(0,10);
  const stay=(Date.parse(departure)-Date.parse(arrival))/86400000;
  for(let i=0;i<=stay;i++) {
    const date=plusDays(arrival,i);
    if((date>arrival || clock(out.arrivalTime)<='09:00') && (date<departure || clock(back.departureTime)>='20:00')) full_days++;
  }
  return {leave_days:leave_dates.length,leave_dates,full_days,off_days:offDays,calendar_reference:reference,
    red_eye:clock(out.departureTime)<'06:00' && clock(back.arrivalTime)<'06:00',
    stay_hours:Math.round((civil(back.departureTime)-civil(out.arrivalTime))/3600000)};
}

export function suitable(offer,c,window) {
  const info=travelTime(offer);
  if(!info || !info.off_days || info.leave_days>c.max_leave_days || info.full_days<c.min_full_days) return null;
  // Allow a night flight home on the following workday, but bound the trip to its window.
  if(offer.inbound.arrivalTime.slice(0,10)>plusDays(window.off_end,c.max_leave_days+1)) return null;
  return info;
}

export function travelWindows(c,date) {
  const horizon=plusDays(date,84),weekends=[],holidays=[];
  for(let d=plusDays(date,1);d<=horizon;d=plusDays(d,1)) {
    if(weekday(d)===5 && dayInfo(d).off && dayInfo(plusDays(d,1)).off) weekends.push({off_start:d,off_end:plusDays(d,1),name:'周末',kind:'weekend'});
  }
  for(const year of calendar.years) for(const h of year.holidays) {
    if(h.start>date && h.start<=horizon) holidays.push({off_start:h.start,off_end:h.end,name:h.name,kind:'holiday',reference:year.status!=='official'});
  }
  // Four near weekends and two rotating future windows keep each edition at <=12 queries.
  const selected=weekends.slice(0,4),later=[...holidays,...weekends.slice(4)];
  if(later.length) {
    const offset=Math.floor(Date.parse(date)/86400000)%later.length;
    for(let i=0;i<Math.min(2,later.length);i++) selected.push(later[(offset+i)%later.length]);
  }
  // Always include the next holiday, rather than leaving it to the rotation.
  if(holidays.length && !selected.some(w=>w.off_start===holidays[0].off_start)) selected[selected.length-1]=holidays[0];
  return selected.map((w,i)=>({...w,red_eye:!!c.prefer_red_eye && i<4 && w.kind==='weekend',start:[plusDays(date,1),plusDays(w.off_start,-1-c.max_leave_days)].sort().at(-1),
    end:w.off_start,min_nights:1,max_nights:Math.min(14,(Date.parse(w.off_end)-Date.parse(w.off_start))/86400000+2+c.max_leave_days)}));
}
