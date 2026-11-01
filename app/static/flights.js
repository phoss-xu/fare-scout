import {escape} from './format.js';

const text = (value, fallback) => typeof value === 'string' && value.trim() ? escape(value) : fallback;
const segments = leg => Array.isArray(leg?.segments) ? leg.segments.filter(s => s && typeof s === 'object') : [];
const numeric = value => typeof value === 'number' && Number.isFinite(value);
export function duration(seconds) {
  if (!numeric(seconds) || seconds <= 0) return '时长暂缺';
  const minutes = Math.floor(seconds / 60);
  if (!minutes) return '不足 1 分钟';
  const hours = Math.floor(minutes / 60);
  return `${hours ? `${hours} 小时` : ''}${minutes % 60 ? ` ${minutes % 60} 分钟` : ''}`.trim();
}

function localParts(value) {
  const match = typeof value === 'string' && value.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  return match ? {date:match[1], clock:match[2]} : {date:'日期暂缺', clock:'时间暂缺'};
}

function endpoint(leg, side) {
  const list = segments(leg);
  const segment = side === 'from' ? list[0] : list.at(-1);
  const parts = localParts(side === 'from' ? leg.departureTime : leg.arrivalTime);
  return `<div class="flight-endpoint"><time>${parts.clock}</time><span class="flight-date">${parts.date}</span><strong>${text(leg[side], '机场代码暂缺')}</strong><span class="airport-name">${text(segment?.[`${side}Name`], '机场名称暂缺')}</span></div>`;
}

function stopLabel(leg) {
  return Number.isInteger(leg.stops) && leg.stops >= 0 ? leg.stops === 0 ? '直飞' : `${leg.stops} 次中转` : '中转信息暂缺';
}

function carrier(leg) {
  const list = segments(leg);
  return [...new Set(list.map(s => [s.carrierName || s.carrier, s.flightNumber].filter(v => typeof v === 'string' && v.trim()).map(v => escape(v)).join(' · ')).filter(Boolean))].join(' / ') || '航空公司与航班号暂缺';
}

function legSummary(leg, title) {
  if (!leg || typeof leg !== 'object') return `<section class="flight-leg"><h4>${title}</h4><p class="muted">航班信息暂缺</p></section>`;
  return `<section class="flight-leg"><div class="flight-leg-head"><h4>${title}</h4><span>${text(leg.cabinClass, '舱位信息暂缺')}</span></div><div class="flight-route">${endpoint(leg, 'from')}<div class="flight-bridge"><span>${duration(leg.durationSeconds)}</span><span class="flight-route-line" aria-hidden="true">↗</span><span>${stopLabel(leg)}</span></div>${endpoint(leg, 'to')}</div><p class="flight-carrier">${carrier(leg)}</p></section>`;
}

export function baggageItems(baggage) {
  const fields = [['personalItem','随身小包'], ['cabinBag','手提行李'], ['checkedBag','托运行李']];
  return fields.map(([key, label]) => {
    const count = baggage?.[key];
    return `${label} ${Number.isInteger(count) && count >= 0 ? `${count} 件` : '件数暂缺'}`;
  });
}

function airport(segment, side) {
  const location = [segment[`${side}City`], segment[`${side}Country`]].filter(v => typeof v === 'string' && v.trim()).map(v => escape(v)).join(' / ');
  return `<strong>${text(segment[side], '代码暂缺')} · ${text(segment[`${side}Name`], '机场名称暂缺')}</strong>${location ? `<span>${location}</span>` : ''}`;
}

function segmentView(segment, index) {
  const departure = localParts(segment.departureTime), arrival = localParts(segment.arrivalTime);
  return `<div class="segment"><div class="segment-heading"><strong>航段 ${index + 1}</strong><span>${text(segment.carrierName || segment.carrier, '航空公司暂缺')} · ${text(segment.flightNumber, '航班号暂缺')}</span></div><div class="segment-airport">${airport(segment, 'from')}<time>${departure.date} ${departure.clock} 起飞</time></div><div class="segment-duration">飞行 ${duration(segment.durationSeconds)} · ${text(segment.cabinClass, '舱位暂缺')}</div><div class="segment-airport">${airport(segment, 'to')}<time>${arrival.date} ${arrival.clock} 抵达</time></div></div>`;
}

function civilTime(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) return NaN;
  // Keep unzoned local clock values independent of the viewer's timezone.
  return Date.parse(value + (/(?:Z|[+-]\d{2}:?\d{2})$/.test(value) ? '' : 'Z'));
}

function layover(before, after) {
  if (before.to !== after.from) return `<div class="layover">需更换机场：${text(before.to, '暂缺')} → ${text(after.from, '暂缺')}，请核对交通与转机时间。</div>`;
  const seconds = (civilTime(after.departureTime) - civilTime(before.arrivalTime)) / 1000;
  return `<div class="layover">${text(before.to, '中转机场暂缺')} 中转 · ${seconds > 0 ? `间隔约 ${duration(seconds)}` : '转机间隔请核价确认'}</div>`;
}

function legDetails(leg, title) {
  const list = segments(leg);
  return `<section class="segment-group"><h4>${title} · ${leg ? stopLabel(leg) : '信息暂缺'}</h4>${list.length ? list.map((s, i) => (i ? layover(list[i-1], s) : '') + segmentView(s, i)).join('') : '<p class="muted">数据源未返回分段信息，请在核价页确认。</p>'}</section>`;
}

export function flightDetails(offer) {
  const bags = baggageItems(offer.baggage).map(item => `<span>${item}</span>`).join('');
  return `<div class="flight-overview"><p class="flight-local-note">所有起降时间均为各机场当地时间；总时长包含中转等待。</p>${legSummary(offer.outbound, '去程')}${legSummary(offer.inbound, '返程')}<div class="baggage-summary"><strong>报价行李信息</strong><div class="baggage-items">${bags}</div><p class="baggage-note">重量、尺寸及每人额度需核价确认</p></div></div><details class="flight-expanded"><summary>查看航段、机场与行李详情 <span aria-hidden="true">＋</span></summary><div class="flight-expanded-body">${legDetails(offer.outbound, '去程航段')}${legDetails(offer.inbound, '返程航段')}<section class="baggage-detail"><h4>行李与其他信息</h4><p>${baggageItems(offer.baggage).join(' · ')}</p><p class="muted">重量、尺寸、每位乘客及每一航段的适用额度未完整返回，请在预订页核对最终额度与费用。</p><p class="muted">航站楼、退改签条件暂未提供。机型与座位信息以航空公司为准。</p></section></div></details>`;
}
