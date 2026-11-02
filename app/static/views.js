import {escape, time, money} from './format.js';
import {flightDetails} from './flights.js';
export {escape, time, money} from './format.js';
export const statusText = {ok:'已取得报价', empty:'本次无匹配', error:'查询失败，可重试'};
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
const empty = (title, text) => `<div class="empty"><span class="empty-icon">↗</span><h3>${title}</h3><p>${text}</p></div>`;
export function watchCards(state) {
  return state.watches.map(w => {
    const rows = state.observations.filter(o => o.watch_id === w.id);
    const current = latest(rows);
    const failures = current.filter(o => o.status === 'error').length;
    const count = current.filter(o => o.status === 'ok').length;
    const label = w.running ? '查价队列中 / 查询中' : !rows.length ? '等待首次查价' : failures ? `${failures} 组查询失败` : count ? `${count} 组取得报价` : '本次无匹配';
    const originLabel = (w.origin_selections || w.origin_locations || [w.origin_location]).filter(Boolean).map(p=>p.name).join(' / ') || w.origin;
    const places = w.destination_selections || w.destination_locations || w.destinations.map(code => ({name:state.destinations[code] || code,kind:'airport',code}));
    const destinationLabel = places.length > 3 ? `${places.slice(0,2).map(p => p.name).join(' / ')} 等 ${places.length} 地` : places.map(p => p.name).join(' / ');
    const scopes = places.map(p => `<span>${escape(p.name)} · ${{country:'国家/地区',city:'城市',airport:'机场',group:'范围'}[p.kind]}</span>`).join('');
    const hours = w.max_duration_hours ?? 8, stops = w.max_stops ?? 1;
    const limits = `${hours ? `每程不超过 ${hours} 小时` : '每程时长不限'} · ${stops < 0 ? '中转不限' : stops === 0 ? '仅直飞' : `最多 ${stops} 次中转`}`;
    return `<article class="card"><div class="card-top"><span class="badge ${failures ? 'warn' : ''}">${label}</span><span class="muted">NO. ${String(w.id).padStart(2,'0')}</span></div><h3>${escape(originLabel)} <span class="arrow">↗</span> ${escape(destinationLabel)}</h3><div class="watch-scopes">${scopes}</div><p class="trip-dates">${w.mode === 'weekend' ? `从 ${w.start} 起 · ${w.weeks} 个周末` : `${w.start} — ${w.end}`}</p><p class="muted">${w.mode === 'weekend' ? '周六 00:00–05:59 出发 · 周一 00:00–05:59 返回' : '返程按目的地起飞日期查询'}</p><p class="muted">${limits}</p><div class="card-meta"><span>${w.adults} 位成人 · 经济舱</span><span>${w.budget ? `总预算 HK$${money(w.budget)}` : '未设预算'}</span></div><div class="auto-summary"><p class="muted">${w.last_status === 'expired' ? '出行日期已过，自动查价已结束' : w.auto_enabled ? `自动查价 · 每 ${w.interval_hours} 小时${w.running ? ' · 运行中' : ` · 下次 ${time(w.next_check)}`}` : '自动查价已暂停'}${w.failure_count ? ' · 失败后退避重试' : ''}</p><p class="muted">${w.alerts_enabled ? `降价至少 HK$${money(w.min_drop)} 或进入预算时提醒` : '价格提醒已关闭'}</p><p class="muted">${w.job_count ? `上轮 ${w.last_batch_count}/${w.job_count} 组 · 轮询位置 ${w.query_cursor}` : '每轮最多查 12 组，超出部分轮询'}</p><button class="text-btn" data-settings="${w.id}">自动查价与提醒设置 ↗</button></div><div class="card-bottom"><span class="muted">${time(rows[0]?.checked_at)}</span><div><button class="text-btn danger-btn" data-remove-kind="watches" data-remove-id="${w.id}">删除监控</button><button class="text-btn" data-history="${w.id}">采样记录</button><button class="small-btn" data-check="${w.id}" ${w.running ? 'disabled' : ''}>${w.running ? '查询中…' : '查一次价格 ↗'}</button></div></div></article>`;
  }).join('') || empty('你的下一程，从这里开始', '创建一条监控，选好时间与目的地，再查一次真实价格。');
}
function bookingLink(value) {
  try {
    const url = new URL(value);
    if (url.protocol === 'https:') return `<a class="small-btn" href="${escape(url.href)}" target="_blank" rel="noopener noreferrer">前往核价 ↗</a>`;
  } catch { /* Provider URLs are optional; omit invalid links. */ }
  return '<span class="muted">暂无核价链接</span>';
}
export function offerCards(state) {
  return latest(state.observations).filter(o => o.status === 'ok' && !o.dismissed_at).map(o => {
    const w = state.watches.find(w => w.id === o.watch_id);
    const offer = o.offer;
    const within = w.budget && offer.price <= w.budget;
    const arrival = offer.outbound?.arrivalTime;
    const leave = offer.inbound?.departureTime;
    const hours = arrival && leave && offer.outbound?.to === offer.inbound?.from ? (new Date(leave) - new Date(arrival)) / 3600000 : NaN;
    return `<article class="card"><div class="card-top"><span class="badge">${within ? '在你的预算内' : '最近采样报价'}</span><span class="muted">${time(o.checked_at)}</span></div><h3>${escape(offer.outbound?.from || w.origin)} <span class="arrow">↗</span> ${escape(state.destinations[o.destination] || o.destination)}</h3><p class="trip-dates">${o.departure} — ${o.arrival}${w.mode === 'weekend' ? ' 返程抵达' : ' 返程起飞'}</p><div class="price"><small>HK$</small> ${money(offer.price)}<span> / ${w.adults} 人往返</span></div>${Number.isFinite(hours) && hours > 0 ? `<p class="muted">目的地停留约 ${Math.floor(hours)} 小时</p>` : ''}${flightDetails(offer)}<div class="card-bottom"><div><button class="text-btn danger-btn" data-remove-kind="offers" data-remove-id="${o.id}">删除机会</button><button class="text-btn" data-history="${w.id}">查看价格记录</button></div>${bookingLink(offer.bookingUrl)}</div></article>`;
  }).join('') || empty('还没有可展示的机票机会', '先在「出行监控」查一次价格。查询失败和无匹配会保留在采样记录里。');
}
export function historyView(state, id) {
  const rows = state.observations.filter(o => o.watch_id === id);
  if (!rows.length) return empty('还没有采样记录', '执行首次查价后，这里会记录每一组航线和日期的查询结果。');
  const first = rows.at(-1).checked_at;
  const days = new Set(rows.map(o => new Date(o.checked_at).toLocaleDateString('zh-CN'))).size;
  const successful = rows.filter(o => o.status === 'ok');
  const minima = new Map();
  for (const row of successful) {
    const key = row.route_key || `${row.destination}/${row.departure}/${row.arrival}`;
    minima.set(key, Math.min(minima.get(key) ?? Infinity, row.offer.price));
  }
  return `<div class="notice">从 ${time(first)} 开始 · ${days} 个采样日 · ${rows.length} 条记录<br>低价比较仅针对同一监控内的同一实际机场组合与实际往返日期。当前展示监测期最低，不代表完整市场历史。</div><div class="history-list">${rows.map(o => `<div class="history-row"><div><strong>${escape(state.destinations[o.destination])}</strong><p>${o.departure} → ${o.arrival}</p><small>${time(o.checked_at)}</small></div><div class="history-result"><span>${statusText[o.status]}</span>${o.offer ? `<strong>HK$${money(o.offer.price)}</strong><small>该组合采样最低 HK$${money(minima.get(o.route_key || `${o.destination}/${o.departure}/${o.arrival}`))}</small>` : `<small>${o.status === 'error' ? '数据源暂时未能返回报价，请重试' : '本次有限结果中没有符合条件的行程'}</small>`}</div></div>`).join('')}</div>`;
}

export function removedItems(state,kind) {
  const rows=kind==='watches'?(state.deleted_watches || []):state.observations.filter(o=>o.dismissed_at);
  if(!rows.length) return '';
  return `<details class="removed-items"><summary>最近删除 · ${rows.length} 条，可恢复</summary>${rows.map(row=>`<div class="removed-row"><span>${kind==='watches'?`监控 #${row.id} · ${escape(row.origin)} → ${escape(row.destinations.join(' / '))}`:`机票机会 · ${escape(row.offer?.outbound?.from || '')} → ${escape(row.destination)} · ${escape(row.departure)}`}</span><button class="small-btn" data-restore-kind="${kind}" data-remove-id="${row.id}">恢复</button></div>`).join('')}</details>`;
}
