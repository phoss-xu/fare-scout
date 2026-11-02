import {tr} from './i18n.js';
import {escape} from './format.js';

const text = (value, fallback) => typeof value === 'string' && value.trim() ? escape(value) : fallback;
const segments = leg => Array.isArray(leg?.segments) ? leg.segments.filter(s => s && typeof s === 'object') : [];
const numeric = value => typeof value === 'number' && Number.isFinite(value);
export function duration(seconds) {
  if (!numeric(seconds) || seconds <= 0) return tr("时长暂缺","Duration unavailable");
  const minutes = Math.floor(seconds / 60);
  if (!minutes) return tr("不足 1 分钟","Under 1 min");
  const hours = Math.floor(minutes / 60);
  return `${hours ? `${hours}${tr(" 小时"," hr")}` : ''}${minutes % 60 ? ` ${minutes % 60}${tr(" 分钟"," min")}` : ''}`.trim();
}

function localParts(value) {
  const match = typeof value === 'string' && value.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  return match ? {date:match[1], clock:match[2]} : {date:tr("日期暂缺","Date unavailable"), clock:tr("时间暂缺","Time unavailable")};
}

function endpoint(leg, side) {
  const list = segments(leg);
  const segment = side === 'from' ? list[0] : list.at(-1);
  const parts = localParts(side === 'from' ? leg.departureTime : leg.arrivalTime);
  return `<div class="flight-endpoint"><time>${parts.clock}</time><span class="flight-date">${parts.date}</span><strong>${text(leg[side], tr("机场代码暂缺","Airport code unavailable"))}</strong><span class="airport-name">${text(segment?.[`${side}Name`], tr("机场名称暂缺","Airport name unavailable"))}</span></div>`;
}

function stopLabel(leg) {
  return Number.isInteger(leg.stops) && leg.stops >= 0 ? leg.stops === 0 ? tr("直飞","Direct") : `${leg.stops}${tr(" 次中转"," stops")}` : tr("中转信息暂缺","Stop information unavailable");
}

function carrier(leg) {
  const list = segments(leg);
  return [...new Set(list.map(s => [s.carrierName || s.carrier, s.flightNumber].filter(v => typeof v === 'string' && v.trim()).map(v => escape(v)).join(' · ')).filter(Boolean))].join(' / ') || tr("航空公司与航班号暂缺","Airline and flight number unavailable");
}

function legSummary(leg, title) {
  if (!leg || typeof leg !== 'object') return `<section class="flight-leg"><h4>${title}${tr("</h4><p class=\"muted\">航班信息暂缺</p></section>","</h4><p class=\"muted\">Flight details unavailable</p></section>")}`;
  return `<section class="flight-leg"><div class="flight-leg-head"><h4>${title}</h4><span>${text(leg.cabinClass, tr("舱位信息暂缺","Cabin information unavailable"))}</span></div><div class="flight-route">${endpoint(leg, 'from')}<div class="flight-bridge"><span>${duration(leg.durationSeconds)}</span><span class="flight-route-line" aria-hidden="true">↗</span><span>${stopLabel(leg)}</span></div>${endpoint(leg, 'to')}</div><p class="flight-carrier">${carrier(leg)}</p></section>`;
}

export function baggageItems(baggage) {
  const fields = [['personalItem',tr("随身小包","Personal item")], ['cabinBag',tr("手提行李","Cabin bag")], ['checkedBag',tr("托运行李","Checked bag")]];
  return fields.map(([key, label]) => {
    const count = baggage?.[key];
    return `${label} ${Number.isInteger(count) && count >= 0 ? `${count}${tr(" 件"," pieces")}` : tr("件数暂缺","Quantity unavailable")}`;
  });
}

function airport(segment, side) {
  const location = [segment[`${side}City`], segment[`${side}Country`]].filter(v => typeof v === 'string' && v.trim()).map(v => escape(v)).join(' / ');
  return `<strong>${text(segment[side], tr("代码暂缺","Code unavailable"))} · ${text(segment[`${side}Name`], tr("机场名称暂缺","Airport name unavailable"))}</strong>${location ? `<span>${location}</span>` : ''}`;
}

function segmentView(segment, index) {
  const departure = localParts(segment.departureTime), arrival = localParts(segment.arrivalTime);
  return `${tr("<div class=\"segment\"><div class=\"segment-heading\"><strong>航段 ","<div class=\"segment\"><div class=\"segment-heading\"><strong>Segment ")}${index + 1}</strong><span>${text(segment.carrierName || segment.carrier, tr("航空公司暂缺","Airline unavailable"))} · ${text(segment.flightNumber, tr("航班号暂缺","Flight number unavailable"))}</span></div><div class="segment-airport">${airport(segment, 'from')}<time>${departure.date} ${departure.clock}${tr(" 起飞</time></div><div class=\"segment-duration\">飞行 "," departure</time></div><div class=\"segment-duration\">Flight ")}${duration(segment.durationSeconds)} · ${text(segment.cabinClass, tr("舱位暂缺","Cabin unavailable"))}</div><div class="segment-airport">${airport(segment, 'to')}<time>${arrival.date} ${arrival.clock}${tr(" 抵达</time></div></div>"," arrival</time></div></div>")}`;
}

function civilTime(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) return NaN;
  // Keep unzoned local clock values independent of the viewer's timezone.
  return Date.parse(value + (/(?:Z|[+-]\d{2}:?\d{2})$/.test(value) ? '' : 'Z'));
}

function layover(before, after) {
  if (before.to !== after.from) return `${tr("<div class=\"layover\">需更换机场：","<div class=\"layover\">Airport transfer required: ")}${text(before.to, tr("暂缺","Unavailable"))} → ${text(after.from, tr("暂缺","Unavailable"))}${tr(" · 请预留交通时间</div>"," · Allow time to transfer</div>")}`;
  const seconds = (civilTime(after.departureTime) - civilTime(before.arrivalTime)) / 1000;
  return `<div class="layover">${text(before.to, tr("中转机场暂缺","Transfer airport unavailable"))}${tr(" 中转 · "," stops · ")}${seconds > 0 ? `${tr("间隔约 ","Transfer time: approx. ")}${duration(seconds)}` : tr("转机间隔请核价确认","Confirm transfer time on the booking page")}</div>`;
}

function legDetails(leg, title) {
  const list = segments(leg);
  return `<section class="segment-group"><h4>${title} · ${leg ? stopLabel(leg) : tr("信息暂缺","Information unavailable")}</h4>${list.length ? list.map((s, i) => (i ? layover(list[i-1], s) : '') + segmentView(s, i)).join('') : tr("<p class=\"muted\">航段信息暂缺</p>","<p class=\"muted\">Segment details unavailable</p>")}</section>`;
}

export function flightDetails(offer) {
  const bags = baggageItems(offer.baggage).map(item => `<span>${item}</span>`).join('');
  return `${tr("<div class=\"flight-overview\"><p class=\"flight-local-note\">机场当地时间 · 总时长含中转</p>","<div class=\"flight-overview\"><p class=\"flight-local-note\">Airport local time · Duration includes transfers</p>")}${legSummary(offer.outbound, tr("去程","Outbound"))}${legSummary(offer.inbound, tr("返程","Inbound"))}${tr("<div class=\"baggage-summary\"><strong>报价行李信息</strong><div class=\"baggage-items\">","<div class=\"baggage-summary\"><strong>Quoted baggage allowance</strong><div class=\"baggage-items\">")}${bags}${tr("</div><p class=\"baggage-note\">重量、尺寸及每人额度需核价确认</p></div></div><details class=\"flight-expanded\"><summary>航段详情 <span aria-hidden=\"true\">＋</span></summary><div class=\"flight-expanded-body\">","</div><p class=\"baggage-note\">Confirm baggage weight, dimensions and per-person allowance when booking</p></div></div><details class=\"flight-expanded\"><summary>Segment details <span aria-hidden=\"true\">＋</span></summary><div class=\"flight-expanded-body\">")}${legDetails(offer.outbound, tr("去程航段","Outbound segments"))}${legDetails(offer.inbound, tr("返程航段","Inbound segments"))}</div></details>`;
}
