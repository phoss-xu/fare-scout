import {tr} from './i18n.js';
import {price} from './format.js';
import {escape, time, money} from './format.js';
import {flightDetails} from './flights.js';
export {escape, time, money} from './format.js';
export const statusText = {get ok(){return tr("已取得报价","Quote available");}, get empty(){return tr("本次无匹配","No matches in these results");}, get error(){return tr("查询失败，可重试","Check failed; try again");}};
export function latest(observations) {
  const batches = new Map(), found = new Map();
  for (const row of observations) {
    const query = `${row.watch_id}/${row.search_id || row.destination}/${row.departure}/${row.arrival}`;
    const batch = row.batch_id || `legacy:${row.id}`;
    if (!batches.has(query)) batches.set(query, batch);
    if (batches.get(query) !== batch) continue;
    const key = `${row.watch_id}/${row.route_key || query}`;
    if (!found.has(key)) found.set(key, row);
  }
  return [...found.values()];
}
const empty = (title, text) => `<div class="empty"><span class="empty-icon">↗</span><h3>${title}</h3>${text?`<p>${text}</p>`:''}</div>`;
export function watchCards(state) {
  return state.watches.map(w => {
    const rows = state.observations.filter(o => o.watch_id === w.id);
    const current = latest(rows);
    const failures = current.filter(o => o.status === 'error').length;
    const count = current.filter(o => o.status === 'ok').length;
    const label = w.running ? tr("查价中","Checking") : !rows.length ? tr("等待首次查价","Waiting for first check") : failures ? `${failures}${tr(" 组查询失败"," failed groups")}` : count ? `${count}${tr(" 组取得报价"," groups with quotes")}` : tr("本次无匹配","No matches in these results");
    const originLabel = (w.origin_selections || w.origin_locations || [w.origin_location]).filter(Boolean).map(p=>p.name).join(' / ') || w.origin;
    const places = w.destination_selections || w.destination_locations || w.destinations.map(code => ({name:state.destinations[code] || code,kind:'airport',code}));
    const destinationLabel = places.length > 3 ? `${places.slice(0,2).map(p => p.name).join(' / ')}${tr(" 等 "," and more · ")}${places.length}${tr(" 地"," locations")}` : places.map(p => p.name).join(' / ');
    const scopes = places.map(p => `<span>${escape(p.name)} · ${{country:tr("国家/地区","Country/region"),city:tr("城市","City"),airport:tr("机场","Airport"),group:tr("范围","Scope")}[p.kind]}</span>`).join('');
    const hours = w.max_duration_hours ?? 8, stops = w.max_stops ?? 1;
    const limits = `${hours ? `${tr("每程不超过 ","Max hours per leg: ")}${hours}${tr(" 小时"," hr")}` : tr("每程时长不限","No duration limit")} · ${stops < 0 ? tr("中转不限","Any stops") : stops === 0 ? tr("仅直飞","Direct only") : `${tr("最多 ","Up to ")}${stops}${tr(" 次中转"," stops")}`}`;
    return `<article class="card"><div class="card-top"><span class="badge ${failures ? 'warn' : ''}">${label}</span><span class="muted">NO. ${String(w.id).padStart(2,'0')}</span></div><h3>${escape(originLabel)} <span class="arrow">↗</span> ${escape(destinationLabel)}</h3><div class="watch-scopes">${scopes}</div><p class="trip-dates">${w.mode === 'weekend' ? `${tr("从 ","From ")}${w.start}${tr(" 起 · "," · ")}${w.weeks}${tr(" 个周末"," weekends")}` : `${w.start} — ${w.end}`}</p><p class="muted">${w.mode === 'weekend' ? tr("周六 00:00–05:59 出发 · 周一 00:00–05:59 返回","Depart Sat 00:00–05:59 · Return Mon 00:00–05:59") : tr("返程为起飞日","Return date is the departure date")}</p><p class="muted">${limits}</p><div class="card-meta"><span>${w.adults}${tr(" 位成人 · 经济舱</span><span>"," adults · Economy</span><span>")}${w.budget ? `${tr("总预算 HK$","Budget HK$")}${money(w.budget)}` : tr("未设预算","No budget set")}</span></div><div class="auto-summary"><p class="muted">${w.last_status === 'expired' ? tr("已过期 · 查价结束","Expired · Checks ended") : w.auto_enabled ? `${tr("自动查价 · 每 ","Automatic check every ")}${w.interval_hours}${tr(" 小时"," hr")}${w.running ? tr(" · 运行中"," · Running") : `${tr(" · 下次 "," · Next ")}${time(w.next_check)}`}` : tr("自动查价已暂停","Automatic checks paused")}${w.failure_count ? tr(" · 稍后重试"," · Retry later") : ''}</p><p class="muted">${w.alerts_enabled ? `${tr("降价至少 HK$","Alert for a drop of at least HK$")}${money(w.min_drop)}${tr(" 或进入预算时提醒"," or when within budget")}` : tr("价格提醒已关闭","Price alerts off")}</p><p class="muted">${w.job_count ? `${tr("上轮已查 ","Last round: ")}${w.last_batch_count}/${w.job_count}${tr(" 组"," groups")}` : ''}</p><button class="text-btn" data-settings="${w.id}${tr("\">查价与提醒设置 ↗</button></div><div class=\"card-bottom\"><span class=\"muted\">","\">Price checks & alerts ↗</button></div><div class=\"card-bottom\"><span class=\"muted\">")}${time(rows[0]?.checked_at)}</span><div><button class="text-btn danger-btn" data-remove-kind="watches" data-remove-id="${w.id}${tr("\">删除监控</button><button class=\"text-btn\" data-history=\"","\">Remove watch</button><button class=\"text-btn\" data-history=\"")}${w.id}${tr("\">采样记录</button><button class=\"small-btn\" data-check=\"","\">Price samples</button><button class=\"small-btn\" data-check=\"")}${w.id}" ${w.running ? 'disabled' : ''}>${w.running ? tr("查询中…","Checking…") : tr("立即查价 ↗","Check now ↗")}</button></div></div></article>`;
  }).join('') || empty(tr("暂无监控","No watches yet"), '');
}
function bookingLink(value) {
  try {
    const url = new URL(value);
    if (url.protocol === 'https:') return `<a class="small-btn" href="${escape(url.href)}${tr("\" target=\"_blank\" rel=\"noopener noreferrer\">前往核价 ↗</a>","\" target=\"_blank\" rel=\"noopener noreferrer\">Check price ↗</a>")}`;
  } catch { /* Provider URLs are optional; omit invalid links. */ }
  return tr("<span class=\"muted\">暂无核价链接</span>","<span class=\"muted\">No booking link available</span>");
}
export function offerCards(state) {
  return latest(state.observations).filter(o => o.status === 'ok' && !o.dismissed_at).map(o => {
    const w = state.watches.find(w => w.id === o.watch_id);
    const offer = o.offer;
    const within = w.budget && offer.price <= w.budget;
    const arrival = offer.outbound?.arrivalTime;
    const leave = offer.inbound?.departureTime;
    const hours = arrival && leave && offer.outbound?.to === offer.inbound?.from ? (new Date(leave) - new Date(arrival)) / 3600000 : NaN;
    return `<article class="card"><div class="card-top"><span class="badge">${within ? tr("在你的预算内","Within your budget") : tr("最近采样报价","Latest observed fare")}</span><span class="muted">${time(o.checked_at)}</span></div><h3>${escape(offer.outbound?.from || w.origin)} <span class="arrow">↗</span> ${escape(state.destinations[o.destination] || o.destination)}</h3><p class="trip-dates">${o.departure} — ${o.arrival}${w.mode === 'weekend' ? tr(" 返程抵达"," return arrival") : tr(" 返程起飞"," return departure")}</p><div class="price">${price(offer.price)}<span> / ${w.adults}${tr(" 人往返</span></div>"," travellers, return</span></div>")}${Number.isFinite(hours) && hours > 0 ? `${tr("<p class=\"muted\">目的地停留约 ","<p class=\"muted\">Time at destination: approx. ")}${Math.floor(hours)}${tr(" 小时</p>"," hr</p>")}` : ''}${flightDetails(offer)}<div class="card-bottom"><div><button class="text-btn danger-btn" data-remove-kind="offers" data-remove-id="${o.id}${tr("\">删除机会</button><button class=\"text-btn\" data-history=\"","\">Remove opportunity</button><button class=\"text-btn\" data-history=\"")}${w.id}${tr("\">查看价格记录</button></div>","\">View price history</button></div>")}${bookingLink(offer.bookingUrl)}</div></article>`;
  }).join('') || empty(tr("暂无机票机会","No flight opportunities yet"), tr("可在出行监控中查价。","Check prices from your watches."));
}
export function historyView(state, id) {
  const rows = state.observations.filter(o => o.watch_id === id);
  if (!rows.length) return empty(tr("暂无价格记录","No price history yet"), '');
  const first = rows.at(-1).checked_at;
  const days = new Set(rows.map(o => new Date(o.checked_at).toLocaleDateString('zh-CN'))).size;
  const successful = rows.filter(o => o.status === 'ok');
  const minima = new Map();
  for (const row of successful) {
    const key = row.route_key || `${row.destination}/${row.departure}/${row.arrival}`;
    minima.set(key, Math.min(minima.get(key) ?? Infinity, row.offer.price));
  }
  return `${tr("<div class=\"notice\">从 ","<div class=\"notice\">From ")}${time(first)}${tr(" 开始 · "," · ")}${days}${tr(" 个采样日 · "," sampled days · ")}${rows.length}${tr(" 条记录<br>同一航线及往返日期的监测期最低，非市场历史最低。</div><div class=\"history-list\">"," records<br>Lowest observed for the same route and return dates during monitoring; not a market historical low.</div><div class=\"history-list\">")}${rows.map(o => `<div class="history-row"><div><strong>${escape(state.destinations[o.destination])}</strong><p>${o.departure} → ${o.arrival}</p><small>${time(o.checked_at)}</small></div><div class="history-result"><span>${statusText[o.status]}</span>${o.offer ? `<strong>${price(o.offer.price)}${tr("</strong><small>该组合采样最低 HK$","</strong><small>Lowest observed for this itinerary: HK$")}${money(minima.get(o.route_key || `${o.destination}/${o.departure}/${o.arrival}`))}</small>` : `<small>${o.status === 'error' ? tr("数据源查询失败","Flight data query failed") : tr("本次无匹配","No matches in these results")}</small>`}</div></div>`).join('')}</div>`;
}

export function removedItems(state,kind) {
  const rows=kind==='watches'?(state.deleted_watches || []):state.observations.filter(o=>o.dismissed_at);
  if(!rows.length) return '';
  return `${tr("<details class=\"removed-items\"><summary>最近删除 · ","<details class=\"removed-items\"><summary>Recently removed · ")}${rows.length}${tr(" 条</summary>"," items</summary>")}${rows.map(row=>`<div class="removed-row"><span>${kind==='watches'?`${tr("监控 #","Watch #")}${row.id} · ${escape(row.origin)} → ${escape(row.destinations.join(' / '))}`:`${tr("机票机会 · ","Flight opportunity · ")}${escape(row.offer?.outbound?.from || '')} → ${escape(row.destination)} · ${escape(row.departure)}`}</span><button class="small-btn" data-restore-kind="${kind}" data-remove-id="${row.id}${tr("\">恢复</button></div>","\">Restore</button></div>")}`).join('')}</details>`;
}
