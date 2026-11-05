import {escape,amount,flightDate} from './format.js';
import {tr} from './i18n.js';
import {legDates} from './route-detail-model.js';

export function shiftDay(day,offset) {
  const date=new Date(day+'T12:00:00Z');
  if(!Number.isFinite(date.getTime()))return '';
  date.setUTCDate(date.getUTCDate()+offset);
  return date.toISOString().slice(0,10);
}
export const queryPair=state=>[state.outDate,state.inDate].filter(Boolean).join('/');
export function dateWindow(anchor) {
  return Array.from({length:7},(_,index)=>shiftDay(anchor,index-3));
}
export function dateStrip(offers,selected,state,returning,currency) {
  const prefix=returning?'in':'out',label=returning?tr('返程日期','Return date'):tr('去程日期','Outbound date');
  const current=state[prefix+'Date'] || '',anchor=state[prefix+'Anchor'] || current || (returning?selected.inbound:selected.outbound).departureTime.slice(0,10);
  const prices=new Map(legDates(offers,state,returning));
  const today=state.today || new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const invalid=day=>day<today || (returning?Boolean(state.outDate && day<state.outDate):Boolean(selected.inbound && state.inDate && day>state.inDate));
  return `<div class="rd-column-dates"><div class="rd-date-navigation"><button type="button" data-rd-page="-7" data-rd-direction="${prefix}" aria-label="${label}${tr('：前七天',': Previous seven days')}">‹</button><strong>${escape(anchor.slice(0,7).replace('-','.'))}</strong><button type="button" data-rd-page="7" data-rd-direction="${prefix}" aria-label="${label}${tr('：后七天',': Next seven days')}">›</button><details class="rd-calendar"><summary>${tr('日历','Calendar')}</summary><div class="rd-calendar-panel"><label class="rd-date-input">${label}<input type="date" data-rd-field="${prefix}Date" aria-label="${label}" min="${returning && state.outDate?escape(state.outDate):today}" value="${escape(current)}"></label><button type="button" data-rd-day="" data-rd-direction="${prefix}">${tr('不限日期','Any date')}</button></div></details></div><div class="rd-date-rail" data-rd-rail="${prefix}" role="group" aria-label="${label}">${dateWindow(anchor).map(day=>{
    const filters={...state,[prefix+'Date']:day},total=prices.get(day),known=state.checkedPairs?.[queryPair(filters)];
    const pending=state.loading && current===day;
    return `<button type="button" data-rd-day="${day}" data-rd-direction="${prefix}" aria-pressed="${current===day}" ${invalid(day) || pending?'disabled':''}><span>${escape(flightDate(day,true))}</span><strong>${pending?tr('查价中…','Checking…'):total!==undefined?escape(amount(total,currency)):known===0?tr('无匹配','No match'):tr('查价','Check price')}</strong>${total!==undefined?`<small>${selected.inbound?tr('往返起','return from'):tr('单程起','one-way from')}</small>`:''}</button>`;
  }).join('')}</div><p class="rd-date-caption">${returning?tr('保持去程日期，比较不同返程日的往返总价。','Compare return dates with the outbound date held fixed.'):selected.inbound?tr('保持返程日期，比较不同出发日的往返总价。','Compare departure dates with the return date held fixed.'):tr('选择前后日期比较单程总价。','Compare one-way totals on nearby dates.')}</p></div>`;
}
