import {escape, money, time} from './format.js';
import {duration, flightDetails} from './flights.js';

export function watchDraft(offer,config) {
  return {origin:`airport:${offer.outbound.from}`,destinations:[`airport:${offer.outbound.to}`],mode:'fixed',
    start:offer.outbound.departureTime.slice(0,10),end:offer.inbound.departureTime.slice(0,10),adults:config.adults,
    budget:config.budget || '',max_stops:config.max_stops,max_duration_hours:config.max_duration_hours || ''};
}

export function sortedOffers(offers, sort='price', day='') {
  return offers.filter(o => !day || o.outbound.departureTime.slice(0,10) === day).slice().sort((a,b) =>
    sort === 'date' ? a.outbound.departureTime.localeCompare(b.outbound.departureTime) || a.price-b.price :
    sort === 'duration' ? (a.outbound.durationSeconds+a.inbound.durationSeconds)-(b.outbound.durationSeconds+b.inbound.durationSeconds) || a.price-b.price : a.price-b.price);
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
  const clock=value=>typeof value==='string' ? escape(value.slice(11,16)) : '时间暂缺';
  return `<div class="compact-flight"><span>${name}<strong>${clock(leg.departureTime)} → ${clock(leg.arrivalTime)}</strong></span><span>${escape(leg.from)} → ${escape(leg.to)}<span>${duration(leg.durationSeconds)} · ${leg.stops===0?'直飞':`${leg.stops} 次中转`}</span></span></div>`;
}
function experience(offer, travel) {
  if (travel) return `<div class="trip-experience"><div><span>可玩时间</span><strong>可玩 ${escape(travel.full_days)} 个白天</strong></div><div><span>工作日历估算</span><strong>${travel.calendar_reference?'预计':''}${travel.leave_days?`请假 ${escape(travel.leave_days)} 天`:'不用请假'}</strong></div></div>`;
  const start=offer.outbound.arrivalTime?.slice(0,10), end=offer.inbound.departureTime?.slice(0,10);
  const nights=(Date.parse(end)-Date.parse(start))/86400000;
  return Number.isInteger(nights) && nights>=0 ? `<div class="trip-experience"><div><span>目的地停留</span><strong>${nights} 晚</strong></div><div><span>航程</span><strong>${offer.outbound.stops===0&&offer.inbound.stops===0?'往返直飞':'含中转'}</strong></div></div>` : '';
}
export function destinationChoices(offers, day='') {
  const choices=new Map();
  for (const offer of sortedOffers(offers,'price',day)) {
    const key=offer.destination_id || offer.outbound.to;
    if(!choices.has(key)) choices.set(key,{key,name:offer.destination_name || offer.outbound.segments?.at(-1)?.toCity || offer.outbound.to,price:offer.price});
  }
  return [...choices.values()];
}
export function dealCards(offers, all, adults, recommendation=false) {
  return offers.map(o => {
    const index = all.indexOf(o), out = o.outbound, back = o.inbound, segment=out.segments?.at(-1), t=recommendation?o.travel:null;
    const badge=t?`${t.calendar_reference?'预计':''}${t.leave_days?`请假 ${t.leave_days} 天`:'不用请假'} · 可玩 ${t.full_days} 个白天`:'本次低价';
    const leave=t?`<p class="deal-date-note">${t.red_eye?'凌晨往返 · ':''}${t.leave_dates.length?'请假日期：'+t.leave_dates.map(escape).join('、'):'内地日历估算'}${t.calendar_reference?' · 假期/补班待正式公布，需复核':''}</p>`:'';
    let booking = '<span class="muted">暂无核价入口</span>';
    try { const url = new URL(o.bookingUrl); if (url.protocol === 'https:') booking = `<a class="small-btn" href="${escape(url.href)}" target="_blank" rel="noopener noreferrer">前往核价 ↗</a>`; }
    catch { booking = '<span class="muted">暂无核价入口</span>'; }
    return `<article class="card deal-card"><div class="card-top"><span class="badge">${badge}</span><span class="muted">${out.stops===0&&back.stops===0?'往返直飞':'含中转'}</span></div><div class="deal-result-title"><div><h3>${escape(o.destination_name || segment?.toCity || out.to)}<span class="deal-airport">${escape(out.to)}</span></h3><p>${escape(out.from)} 出发 · ${escape(o.destination_country || segment?.toCountry || '')}</p></div><div class="price"><small>HK$</small> ${money(o.price)}<span> / ${adults} 人往返</span></div></div>${experience(o,t)}<p class="trip-dates">${escape(out.departureTime.slice(0,10))} 出发 — ${escape((t?back.arrivalTime:back.departureTime).slice(0,10))} ${t?'返抵':'返程起飞'}</p>${leave}${compactLeg(out,'去程')}${compactLeg(back,'返程')}<details class="deal-flight-more"><summary>航班与行李详情</summary>${flightDetails(o)}</details><div class="card-bottom"><button type="button" class="text-btn" ${recommendation?'data-daily-watch':'data-deal-watch'}="${index}">创建监控</button>${booking}</div></article>`;
  }).join('') || discoveryPlaceholder('empty');
}
export function discoveryPlaceholder(kind='initial') {
  if(kind==='loading') return Array.from({length:4},()=>'<div class="skeleton-card" aria-hidden="true"><span class="skeleton-line"></span><span class="skeleton-line"></span><span class="skeleton-line"></span><span class="skeleton-line"></span></div>').join('');
  const copy={initial:['搜一搜，下一站去哪',''],empty:['本次无匹配行程','可放宽日期或预算；无匹配不代表无票。'],error:['搜索失败','请稍后重试。']}[kind];
  return `<div class="discovery-empty"><div><h3>${copy[0]}</h3>${copy[1]?`<p>${copy[1]}</p>`:''}</div><div class="empty-route" aria-hidden="true"><span>出发</span><img src="/assets/airplane-tilt.svg" alt=""><span>远方</span></div></div>`;
}
export function resultSummary(result) {
  return `${result.offers.length} 个目的地 · Kiwi · ${time(result.checked_at)}${result.failures ? ` · ${result.failures} 组查询失败` : ''}`;
}
