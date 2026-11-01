import {escape, money, time} from './format.js';
import {duration, flightDetails} from './flights.js';

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
export function dealCards(offers, all, adults) {
  return offers.map(o => {
    const index = all.indexOf(o), out = o.outbound, back = o.inbound, segment=out.segments?.at(-1);
    let booking = '<span class="muted">暂无核价入口</span>';
    try { const url = new URL(o.bookingUrl); if (url.protocol === 'https:') booking = `<a class="small-btn" href="${escape(url.href)}" target="_blank" rel="noopener noreferrer">前往核价 ↗</a>`; }
    catch { booking = '<span class="muted">暂无核价入口</span>'; }
    return `<article class="card deal-card"><div class="card-top"><span class="badge">本次搜索较低价</span><span class="muted">${out.stops===0&&back.stops===0?'往返直飞':'含中转'}</span></div><div class="deal-result-title"><div><h3>${escape(o.destination_name || segment?.toCity || out.to)}<span class="deal-airport">${escape(out.to)}</span></h3><p>${escape(out.from)} 出发 · ${escape(o.destination_country || segment?.toCountry || '')}</p></div><div class="price"><small>HK$</small> ${money(o.price)}<span> / ${adults} 人往返</span></div></div><p class="trip-dates">${escape(out.departureTime.slice(0,10))} 出发 — ${escape(back.departureTime.slice(0,10))} 返程起飞</p>${compactLeg(out,'去程')}${compactLeg(back,'返程')}<details class="deal-flight-more"><summary>航班与行李详情</summary>${flightDetails(o)}</details><div class="card-bottom"><button type="button" class="text-btn" data-deal-watch="${index}">加入出行监控</button>${booking}</div></article>`;
  }).join('') || discoveryPlaceholder('empty');
}
export function discoveryPlaceholder(kind='initial') {
  if(kind==='loading') return Array.from({length:4},()=>'<div class="skeleton-card" aria-hidden="true"><span class="skeleton-line"></span><span class="skeleton-line"></span><span class="skeleton-line"></span><span class="skeleton-line"></span></div>').join('');
  const copy={initial:['你的下一站，还没设限。','选好出发地与大致时间，我们来寻找值得去的地方。'],empty:['换一段时间，也许就有好价格。','这次有限结果里没有匹配行程，可以试试放宽预算、日期或停留晚数。'],error:['这次搜索暂时没有完成。','请检查本地服务和网络连接，稍后重新搜索。']}[kind];
  return `<div class="discovery-empty"><div><h3>${copy[0]}</h3><p>${copy[1]}</p><div class="discovery-steps"><span><b>01</b>选出发地</span><span><b>02</b>留一段时间</span><span><b>03</b>发现目的地</span></div></div><div class="empty-route" aria-hidden="true"><span>出发</span><img src="/assets/airplane-tilt.svg" alt=""><span>远方</span></div></div>`;
}
export function resultSummary(result) {
  return `${result.offers.length} 个目的地 · Kiwi · ${time(result.checked_at)}${result.failures ? ` · ${result.failures} 组查询失败，可重新搜索` : ''}`;
}
