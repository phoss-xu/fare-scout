import {priceInsight} from './price-history-view.js';
import {setupPriceHistory} from './price-history.js';
import {offerPhoto,boardingDestinationPhoto} from './route-card-views.js';
import {locationName,loadLocationNames} from './location-names.js';
import {boardingItinerary} from './boarding-itinerary.js';
import {registerTrip,tripTools,tripAlert,tripNote} from './trip-state.js';
import {tr} from './i18n.js';
import {farePrice,flightDate} from './format.js';
import {escape, money, time} from './format.js';
import {baggageItems, duration, flightDetails} from './flights.js';
import {icon} from './ui-icons.js';

export function watchDraft(offer,config) {
  return {origin:`airport:${offer.outbound.from}`,destinations:[`airport:${offer.outbound.to}`],mode:'fixed',
    start:offer.outbound.departureTime.slice(0,10),end:offer.inbound.departureTime.slice(0,10),adults:config.adults,
    budget:config.budget || '',max_stops:config.max_stops,max_duration_hours:config.max_duration_hours || ''};
}

export function sortedOffers(offers, sort='price', day='') {
  return offers.filter(o => !day || o.outbound.departureTime.slice(0,10) === day).slice().sort((a,b) =>
    sort === 'date' ? a.outbound.departureTime.localeCompare(b.outbound.departureTime) || a.price-b.price :
    sort === 'duration' ? (a.outbound.durationSeconds+(a.inbound?.durationSeconds || 0))-(b.outbound.durationSeconds+(b.inbound?.durationSeconds || 0)) || a.price-b.price : a.price-b.price);
}
export function sampledDays(offers) {
  const days = new Map();
  for (const offer of offers) {
    const day = offer.outbound.departureTime.slice(0,10);
    days.set(day, Math.min(days.get(day) ?? Infinity, offer.price));
  }
  return [...days].sort(([a],[b]) => a.localeCompare(b));
}
function compactLeg(leg, name) {
  const clock=value=>typeof value==='string' ? escape(value.slice(11,16)) : tr("时间暂缺","Time unavailable");
  return `<div class="compact-flight"><span>${name}<strong>${clock(leg.departureTime)} → ${clock(leg.arrivalTime)}</strong></span><span>${escape(leg.from)} → ${escape(leg.to)}<span>${duration(leg.durationSeconds)} · ${leg.stops===0?tr("直飞","Direct"):`${leg.stops}${tr(" 次中转"," stops")}`}</span></span></div>`;
}
function tripDates(out, back, travel) {
  const block=(value,label)=>{
    const formatted=flightDate(value),match=formatted.match(/^(\d{4}-\d{2}-\d{2})\s*(.*)$/);
    return `<span class="trip-date-block"><span class="trip-date-label">${label}</span><span class="trip-date-main"><span class="trip-date-year">${escape(match?.[1]?.slice(0,4) || '')}${tr('年','')}</span><strong>${escape(match?.[1]?.slice(5) || formatted)}</strong></span>${match?.[2]?`<span class="trip-date-weekday">${escape(match[2])}</span>`:''}</span>`;
  };
  return `<div class="trip-dates">${block(out.departureTime,tr('去程','Outbound'))}${back?`<span class="trip-date-connector" aria-hidden="true">→</span>${block(travel?back.arrivalTime:back.departureTime,travel?tr('返抵','Return arrival'):tr('返程起飞','Return departure'))}`:`<span class="trip-date-oneway">${tr('单程','One way')}</span>`}</div>`;
}
function experience(offer, travel) {
  if(!offer.inbound) return "";
  if (travel) return `${tr("<div class=\"trip-experience\"><div><span>可玩时间</span><strong>可玩 ","<div class=\"trip-experience\"><div><span>Time away</span><strong>Full days away: ")}${escape(travel.full_days)}${tr(" 个白天</strong></div><div><span>工作日历估算</span><strong>"," full days</strong></div><div><span>Work calendar estimate</span><strong>")}${travel.calendar_reference?tr("预计","Estimated "):''}${travel.leave_days?`${tr("请假 ","Leave days: ")}${escape(travel.leave_days)}${tr(" 天"," days")}`:tr("不用请假","No leave needed")}</strong></div></div>`;
  const start=offer.outbound.arrivalTime?.slice(0,10), end=offer.inbound.departureTime?.slice(0,10);
  const nights=(Date.parse(end)-Date.parse(start))/86400000;
  return Number.isInteger(nights) && nights>=0 ? `${tr("<div class=\"trip-experience\"><div><span>目的地停留</span><strong>","<div class=\"trip-experience\"><div><span>Stay at destination</span><strong>")}${nights}${tr(" 晚</strong></div><div><span>航程</span><strong>"," nights</strong></div><div><span>Flight time</span><strong>")}${offer.outbound.stops===0&&offer.inbound.stops===0?tr("往返直飞","Direct both ways"):tr("含中转","With stops")}</strong></div></div>` : '';
}
export function destinationChoices(offers, day='') {
  const choices=new Map();
  for (const offer of sortedOffers(offers,'price',day)) {
    const key=offer.destination_id || offer.outbound.to;
    if(!choices.has(key)) choices.set(key,{key,name:locationName(offer.outbound.to,'city',offer.destination_name || offer.outbound.segments?.at(-1)?.toCity),price:offer.price});
  }
  return [...choices.values()];
}
export function dealCards(offers, all, adults, recommendation=false,context={}) {
  setupPriceHistory();
  if(offers.length && typeof document!=='undefined') loadLocationNames();
  return offers.map(o => {
    const ref=registerTrip(o,{...context,adults});
    const index = all.indexOf(o), out = o.outbound, back = o.inbound, segment=out.segments?.at(-1), t=recommendation?o.travel:null;
    const badge=t?`${t.calendar_reference?tr("预计","Estimated "):''}${t.leave_days?`${tr("请假 ","Leave days: ")}${t.leave_days}${tr(" 天"," days")}`:tr("不用请假","No leave needed")}${tr(" · 可玩 "," · Full days away: ")}${t.full_days}${tr(" 个白天"," full days")}`:context.archived?tr("行程快照","Trip snapshot"):tr("本次报价","Quote from this search");
    const leave=t?`<p class="deal-date-note">${t.red_eye?tr("凌晨往返 · ","Overnight return · "):''}${t.leave_dates.length?tr("请假日期：","Leave dates: ")+t.leave_dates.map(escape).join('、'):tr("内地日历估算","Mainland China calendar estimate")}${t.calendar_reference?tr(" · 假期及补班待公布"," · Holidays and make-up workdays unconfirmed"):''}</p>`:'';
    let booking = tr("<span class=\"muted\">暂无核价入口</span>","<span class=\"muted\">No booking link available</span>");
    try { const url = new URL(o.bookingUrl); if (url.protocol === 'https:') {const label=tr('前往核价','Check price');booking=`<a class="small-btn deal-icon-action deal-booking" href="${escape(url.href)}" target="_blank" rel="noopener noreferrer" aria-label="${label}" title="${label}">${icon('external')}</a>`;} }
    catch { booking = tr("<span class=\"muted\">暂无核价入口</span>","<span class=\"muted\">No booking link available</span>"); }
    const statusIndicator=context.public||context.archived?'':priceInsight(o,{indicator:true});
    const cover=context.routeDetail?boardingDestinationPhoto(o,context.destinationPhotos):offerPhoto(o,context.destinationPhotos);
    return `<article class="card deal-card" data-price-level="${escape(o.price_history?.level || '')}"${context.routeDetail?` data-route-detail="${index}"`:""}>${cover}<div class="ticket-face"><div class="card-top"><span class="badge">${badge}</span><span class="muted">${out.stops===0&&(!back || back.stops===0)?(back?tr("往返直飞","Direct both ways"):tr("单程直飞","Direct one-way")):tr("含中转","With stops")}</span>${context.public?'':tripTools(ref)}</div><div class="deal-result-title"><div><h3>${escape(locationName(out.to,'city',o.destination_name || segment?.toCity))}<span class="deal-airport">${escape(out.to)}</span></h3><p>${escape(out.from)}${tr(" 出发 · "," departure · ")}${escape(o.destination_country || segment?.toCountry || '')}</p></div></div>${boardingItinerary(o)}${experience(o,t)}${tripDates(out,back,t)}${leave}<aside class="ticket-stub"><div class="fare-status"><div class="price">${farePrice(o.price,o.currency || context.currency || 'HKD',false,true)}<span> / ${adults}${back?tr(" 人往返</span></div>"," travellers, return</span></div>"):tr(" 人单程</span></div>"," travellers, one-way</span></div>")}${statusIndicator}</div><p class="ticket-time-note">${tr("机场当地时间 · 时长含中转","Airport local time · Duration includes transfers")}</p><p class="ticket-baggage">${baggageItems(o.baggage).map(escape).join(' · ')}</p>${compactLeg(out,tr("去程","Outbound"))}${back?compactLeg(back,tr("返程","Inbound")):""}<div class="card-bottom">${context.routeDetail?`<button type="button" class="route-open" data-route-open>${tr("比较日期与航班","Compare dates & flights")} <span aria-hidden="true">↗</span></button>`:""}${context.public?'':tripAlert(ref)}${booking}</div><div class="ticket-footer">${context.public?'':`<div class="ticket-tools">${tripTools(ref)}</div>`}${tripNote(ref)}</div></aside></div>${tr("<details class=\"deal-flight-more\"><summary>航班与行李详情</summary>","<details class=\"deal-flight-more\"><summary>Flight & baggage details</summary>")}${flightDetails(o)}</details></article>`;
  }).join('') || discoveryPlaceholder('empty');
}
export function discoveryPlaceholder(kind='initial') {
  if(kind==='loading') return Array.from({length:4},()=>'<div class="skeleton-card" aria-hidden="true"><span class="skeleton-line"></span><span class="skeleton-line"></span><span class="skeleton-line"></span><span class="skeleton-line"></span></div>').join('');
  const copy={initial:[tr("搜一搜，下一站去哪","Find your next getaway"),''],empty:[tr("本次无匹配行程","No matching itinerary in these results"),tr("无匹配不代表无票","No match does not mean no flights")],error:[tr("搜索失败","Search failed"),tr("请稍后重试。","Please try again later.")]}[kind];
  return `<div class="discovery-empty"><div><h3>${copy[0]}</h3>${copy[1]?`<p>${copy[1]}</p>`:''}</div><div class="empty-route" aria-hidden="true"><span>出发</span><img src="/assets/airplane-tilt.svg" alt=""><span>远方</span></div></div>`;
}
export function resultSummary(result) {
  return `${result.offers.length}${result.config?.trip_type==='oneway'?tr(" 组单程报价 · Kiwi · "," one-way quotes · Kiwi · "):result.config?.date_pairs ? tr(" 组往返报价 · Kiwi · "," return quotes · Kiwi · ") : tr(" 个目的地 · Kiwi · "," destinations · Kiwi · ")}${time(result.checked_at)}${result.failures ? ` · ${result.failures}${tr(" 组查询失败"," failed groups")}` : ''}`;
}
