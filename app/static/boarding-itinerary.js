import {locationName,carrierLabel} from './location-names.js';
import {tr} from './i18n.js';
import {escape} from './format.js';
import {duration} from './flights.js';

function place(leg,side,fallback) {
  const segment=side==='from'?leg.segments?.[0]:leg.segments?.at(-1);
  return `<div class="boarding-place"><span>${side==='from'?tr('出发地','From'):tr('目的地','To')}</span><strong>${escape(locationName(leg[side],'city',segment?.[side+'City'] || fallback))}</strong><b>${escape(leg[side])}</b><small>${escape(locationName(leg[side],'airport',segment?.[side+'Name']))}</small></div>`;
}
function moment(value,airport,action) {
  const parts=typeof value==='string'?value.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/):null;
  return `<div class="boarding-moment"><time>${escape(parts?.[2] || tr('时间暂缺','Time unavailable'))}</time><span>${escape(parts?.[1] || '')}</span><small>${escape(airport)} · ${action}</small></div>`;
}
function legRow(leg,returning=false) {
  const name=returning?tr('返程','Inbound'):tr('去程','Outbound');
  const stops=leg.stops===0?tr('直飞','Direct'):tr(`${leg.stops} 次中转`,`${leg.stops} stops`);
  const carriers=[...new Set((leg.segments || []).map(s=>[carrierLabel(s),s.flightNumber].filter(Boolean).join(' ')).filter(Boolean))];
  const departure=moment(leg.departureTime,leg.from,tr('起飞','Departure'));
  const arrival=moment(leg.arrivalTime,leg.to,tr('到达','Arrival'));
  return `<div class="boarding-leg${returning?' boarding-return':''}" role="group" aria-label="${name} ${escape(returning?leg.to:leg.from)} ${returning?'←':'→'} ${escape(returning?leg.from:leg.to)}">${returning?arrival:departure}<div class="boarding-connection"><div class="boarding-route-control"><span class="boarding-route-end"></span><span class="boarding-route-track"><i></i><b aria-hidden="true">✈</b></span><span class="boarding-route-end"></span></div><span class="boarding-direction">${name}</span><strong class="boarding-duration">${duration(leg.durationSeconds)}</strong><span class="boarding-flight-kind">${stops}</span>${carriers.length?`<div class="boarding-carriers">${carriers.map(c=>`<span>${escape(c)}</span>`).join('')}</div>`:''}</div>${returning?departure:arrival}</div>`;
}
/** Airport columns stay anchored: return arrival is on the origin side. */
export function boardingItinerary(offer) {
  return `<section class="boarding-itinerary" aria-label="${tr('行程路线与时间','Itinerary route and times')}"><div class="boarding-places">${place(offer.outbound,'from')}${place(offer.outbound,'to',offer.destination_name)}</div>${legRow(offer.outbound)}${offer.inbound?legRow(offer.inbound,true):''}<p class="boarding-time-note">${tr('机场当地时间 · 时长含中转','Airport local time · Duration includes transfers')}</p></section>`;
}
