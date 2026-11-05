import {escape,farePrice,flightDate} from './format.js';
import {locationName,carrierLabel} from './location-names.js';
import {dateStrip,dateCalendar} from './route-date-strip.js';
import {duration} from './flights.js';
import {tr} from './i18n.js';
import {legIdentity,outboundChoices,returnChoices} from './route-detail-model.js';

function flightRow(leg) {
  const carriers=[...new Set((leg.segments || []).map(carrierLabel).filter(Boolean))].join(' / ');
  const numbers=(leg.segments || []).map(segment=>segment.flightNumber).filter(Boolean).join(' / ');
  const clock=value=>escape(value?.slice(11,16) || '—');
  const place=side=>escape(locationName(leg[side],'city',leg.segments?.[side==='from'?0:leg.segments.length-1]?.[side+'City']));
  const arrivalDate=leg.arrivalTime?.slice(0,10),departureDate=leg.departureTime.slice(0,10);
  return `<div class="rd-flight-times"><div><strong>${clock(leg.departureTime)}</strong><span>${place('from')} <b>${escape(leg.from)}</b></span></div><div class="rd-flight-track"><small>${duration(leg.durationSeconds)}</small><i aria-hidden="true">→</i><small>${leg.stops===0?tr('直飞','Direct'):escape(leg.stops)+tr(' 次中转',' stops')}</small></div><div><strong>${clock(leg.arrivalTime)}</strong><span>${place('to')} <b>${escape(leg.to)}</b></span></div></div>${arrivalDate && arrivalDate!==departureDate?`<p class="rd-arrival-date">${tr('抵达 ','Arrives ')}${escape(flightDate(leg.arrivalTime,true))}</p>`:''}<p class="rd-carrier">${escape(carriers || tr('航司信息暂缺','Airline unavailable'))}${numbers?' · '+escape(numbers):''}</p>`;
}
function timeControls(state,returning) {
  const prefix=returning?'in':'out';
  return `<details class="rd-time-filter" ${state[prefix+'From'] || state[prefix+'To']?'open':''}><summary>${tr('起飞时段','Departure time')}${state[prefix+'From'] || state[prefix+'To']?` · ${escape(state[prefix+'From'] || '00:00')}–${escape(state[prefix+'To'] || '23:59')}`:''}</summary><div class="rd-time-range">${[['From',tr('最早起飞','Earliest departure')],['To',tr('最晚起飞','Latest departure')]].map(([suffix,title])=>`<label>${title}<input type="time" data-rd-field="${prefix+suffix}" aria-label="${returning?tr('返程','Return '):tr('去程','Outbound ')}${title}" value="${escape(state[prefix+suffix] || '')}"></label>`).join('')}</div></details>`;
}
export function legPicker(offers,options,selected,state,currency) {
  const outbounds=outboundChoices(options),returns=returnChoices(options,selected,state.sort);
  const minimum=returns.length?Math.min(...returns.map(o=>o.price)):0;
  const column=(returning)=>{
    const choices=returning?returns:outbounds;
    return `<section class="rd-flight-column" aria-label="${returning?tr('选择返程','Choose return'):tr('选择去程','Choose outbound')}"><div class="rd-column-heading"><h3><span>${returning?'02':'01'}</span> ${returning?tr('返程','Return'):tr('去程','Outbound')}</h3>${dateCalendar(selected,state,returning)}</div>${dateStrip(offers,selected,state,returning,currency)}${timeControls(state,returning)}<div class="rd-option-list" data-rd-list="${returning?'in':'out'}">${choices.map(choice=>{
      const offer=returning?choice:choice.cheapest,leg=returning?offer.inbound:offer.outbound;
      const active=returning?offer===selected:choice.key===legIdentity(selected.outbound);
      const delta=offer.price-minimum;
      const fare=returning?(delta===0?'':farePrice(delta,currency,true)):farePrice(offer.price,currency);
      return `<button type="button" class="rd-option" ${returning?'data-rd-option':'data-rd-outbound'}="${offers.indexOf(offer)}" aria-pressed="${active}"><div class="rd-option-heading"><time datetime="${escape(leg.departureTime)}">${escape(flightDate(leg.departureTime,true))}</time>${fare?`<strong>${fare}</strong>`:''}</div>${flightRow(leg)}${returning?`<div class="rd-option-foot"><span>${tr('手提 / 托运 ','Cabin / checked ')}${escape(offer.baggage?.cabinBag ?? '—')} / ${escape(offer.baggage?.checkedBag ?? '—')}</span></div>`:''}</button>`;
    }).join('') || `<p class="rd-empty">${returning?tr('当前没有可搭配的返程。调整日期或时段，或查询更多航班。','No matching returns. Adjust dates or times, or search for more flights.'):tr('当前条件下没有已返回的去程。调整条件或查询更多航班。','No returned outbounds match. Adjust filters or search for more flights.')}</p>`}</div></section>`;
  };
  return `<div class="rd-flight-columns${selected.inbound?'':' rd-oneway'}">${column(false)}${selected.inbound?column(true):''}</div>`;
}
