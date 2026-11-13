import {watchPhotos} from './route-card-views.js';
import {dealCards} from './deal_views.js';
import {boardingItinerary} from './boarding-itinerary.js';
import {tr} from './i18n.js';
import {currencyLabel,currencySymbol,displayAmount} from './currency.js';
import {escape, time, money, flightDate, price} from './format.js';
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
    const cover=watchPhotos(places,state.destinationPhotos);
    const scopes = places.map(p => `<span>${escape(p.name)} · ${{country:tr("国家/地区","Country/region"),city:tr("城市","City"),airport:tr("机场","Airport"),group:tr("范围","Scope")}[p.kind]}</span>`).join('');
    const hours = w.max_duration_hours ?? 8, stops = w.max_stops ?? 1;
    const oneWay=w.trip_type==='oneway';
    const limits = `${hours ? `${tr("每程不超过 ","Max hours per leg: ")}${hours}${tr(" 小时"," hr")}` : tr("每程时长不限","No duration limit")} · ${stops < 0 ? tr("中转不限","Any stops") : stops === 0 ? tr("仅直飞","Direct only") : `${tr("最多 ","Up to ")}${stops}${tr(" 次中转"," stops")}`}`;
    const best=current.filter(o=>o.status==='ok' && o.offer).sort((a,b)=>a.offer.price-b.offer.price)[0];
    const offer=best?.offer,out=offer?.outbound,back=offer?.inbound;
    const itinerary=offer?boardingItinerary(offer):`<p class="watch-no-quote">${tr('暂无有效报价','No active quote yet')}</p>`;
    const destination=best?state.destinations[best.destination] || best.destination:destinationLabel;
    const emailReady=state.email?.verification==='verified';
    const delivery=w.alerts_enabled?(emailReady?tr('站内 + 邮件','In-app + email'):tr('站内提醒 · 邮箱未验证','In-app · email unverified')):tr('提醒已关闭','Alerts off');
    const schedule=w.last_status==='expired'?tr('监控已结束','Monitoring ended'):w.auto_enabled?`${tr('每','Every ')} ${w.interval_hours}${tr(' 小时 · 下次 ',' hr · Next ')}${time(w.next_check)}`:tr('自动查价已暂停','Automatic checks paused');
    const threshold=w.alerts_enabled?`${tr('降价 ≥ ','Drop ≥ ')}${currencyLabel(w.currency || 'HKD')} ${money(w.min_drop)}${w.budget?` · ${tr('预算内也提醒','also within budget')}`:''}`:tr('价格提醒已关闭','Price alerts off');
    const trend=offer?.price_history?.sampled_days?`<span class="watch-trend-change collecting" data-watch-change>${tr('加载走势…','Loading trend…')}</span>`:'';
    const trendGraph=offer?.price_history?.sampled_days?`<div class="watch-trend" data-watch-trend data-series="${escape(offer.price_history.id)}" data-currency="${escape(offer.currency || w.currency || 'HKD')}" data-samples="${Number(offer.price_history.sampled_days)}"><span>${tr('加载价格走势…','Loading fare trend…')}</span></div>`:`<div class="watch-trend watch-trend-empty"><span>${tr('积累采样后显示走势','Trend appears after more samples')}</span></div>`;
    const fare=offer?displayAmount(offer.price,offer.currency || w.currency || 'HKD'):null;
    const currencyName=fare?`${currencyLabel(fare.code)} (${fare.code})`:'';
    const priceHtml=offer?price(offer.price,offer.currency || w.currency || 'HKD'):'';
    const sourceQuote=priceHtml.includes('<span class="source-price">')?priceHtml.slice(priceHtml.indexOf('<span class="source-price">')):'';
    const farePrice=offer?`${fare.converted?'≈ ':''}<span class="watch-currency-tip"><button type="button" data-currency-tip title="${escape(currencyName)}" aria-label="${escape(currencyName)}" aria-expanded="false">${escape(currencySymbol(fare.code))}</button><span class="watch-currency-name" role="tooltip" aria-hidden="true">${escape(currencyName)}</span></span> <span class="watch-price-amount">${escape(fare.amount)}</span>${sourceQuote}`:'';
    const tripDates=w.mode==='weekend'?`${w.start}${tr(' 起 · ',' · ')}${w.weeks}${tr(' 个周末',' weekends')}`:oneWay?w.start+tr(' · 单程',' · One-way'):`${w.start} — ${w.end}`;
    return `<article class="card journey-card watch-card">${cover}<div class="card-top"><span class="badge ${failures ? 'warn' : ''}">${label}</span><span class="watch-route-title">${escape(originLabel)} <span aria-hidden="true">→</span> ${escape(destination)}</span></div><div class="watch-overview"><section class="watch-itinerary" aria-label="${tr('出发与到达时间','Departure and arrival times')}">${itinerary}</section><section class="watch-price-panel"><div class="watch-price-heading"><span>${tr('当前最低报价','Lowest current quote')}</span>${best?`<time>${time(best.checked_at)}</time>`:''}</div>${offer?`<div class="watch-price-row"><strong class="watch-current-price">${farePrice}</strong>${trend}</div>${trendGraph}`:`<div class="watch-trend watch-trend-empty"><span>${tr('取得报价后显示价格走势','Trend appears after a quote is found')}</span></div>`}</section><section class="watch-monitor"><div><span>${tr('监控','Monitoring')}</span><strong>${escape(schedule)}</strong></div><div><span>${tr('提醒门槛','Alert threshold')}</span><strong>${escape(threshold)}</strong></div><div><span>${tr('投送','Delivery')}</span><strong>${escape(delivery)}</strong></div><button class="text-btn" data-settings="${w.id}">${tr('设置','Settings')} ↗</button></section></div><details class="watch-filters"><summary>${tr('出行条件','Trip filters')}</summary><div class="watch-scopes">${scopes}</div><p>${escape(tripDates)} · ${escape(oneWay?tr('单程','One way'):w.mode==='weekend'?tr('返程抵达日','Return arrival date'):tr('返程起飞日','Return departure date'))}</p><p>${escape(limits)} · ${w.adults}${tr(' 位成人 · 经济舱',' travellers · Economy')}${w.budget?` · ${tr('总预算 ','Budget ')}${currencyLabel(w.currency || 'HKD')} ${money(w.budget)}`:''}</p></details><div class="card-bottom"><span class="muted">${time(rows[0]?.checked_at)}</span><div><button class="text-btn danger-btn" data-remove-kind="watches" data-remove-id="${w.id}">${tr('删除监控','Remove watch')}</button><button class="text-btn" data-history="${w.id}">${tr('采样记录','Price samples')}</button><button class="small-btn" data-check="${w.id}" ${w.running ? 'disabled' : ''}>${w.running ? tr('查询中…','Checking…') : tr('立即查价 ↗','Check now ↗')}</button></div></div></article>`;
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
    const context={...w,checked_at:o.checked_at,destinationPhotos:state.destinationPhotos,opportunity:{id:o.id,watchId:w.id,departure:o.departure,arrival:o.arrival,within:Boolean(w.budget && o.offer.price<=w.budget)}};
    return dealCards([o.offer],[o.offer],w.adults,false,context);
  }).join('') || empty(tr("暂无机票机会","No flight opportunities yet"), '');
}
export function historyView(state, id, page) {
  const rows = page?.observations || state.observations.filter(o => o.watch_id === id);
  const destinations={...state.destinations,...page?.destinations};
  if (!rows.length) return empty(tr("暂无价格记录","No price history yet"), '');
  const first = page?.summary.first_at || rows.at(-1).checked_at;
  const days = page?.summary.sampled_days ?? new Set(rows.map(o => new Date(o.checked_at).toLocaleDateString('zh-CN'))).size;
  const successful = rows.filter(o => o.status === 'ok');
  const minima = new Map();
  for (const row of successful) {
    const key = row.route_key || `${row.destination}/${row.departure}/${row.arrival}`;
    minima.set(key, Math.min(minima.get(key) ?? Infinity, row.offer.price));
  }
  return `${tr("<div class=\"notice\">从 ","<div class=\"notice\">From ")}${time(first)}${tr(" 开始 · "," · ")}${days}${tr(" 个采样日 · "," sampled days · ")}${page?.summary.total ?? rows.length}${tr(" 条记录<br>同航线、同日期采样最低 · 非市场历史最低</div><div class=\"history-list\">"," records<br>Lowest sampled for the same route and dates · Not a market historical low</div><div class=\"history-list\">")}${rows.map(o => `<div class="history-row"><div><strong>${escape(destinations[o.destination])}</strong><p>${o.departure} → ${o.arrival}</p><small>${time(o.checked_at)}</small></div><div class="history-result"><span>${statusText[o.status]}</span>${o.offer ? `<strong>${price(o.offer.price,o.offer.currency)}${tr("</strong><small>该组合采样最低 ","</strong><small>Lowest observed for this itinerary: ")}${currencyLabel(o.offer.currency || 'HKD')} ${money(o.monitored_min ?? minima.get(o.route_key || `${o.destination}/${o.departure}/${o.arrival}`))}</small>` : `<small>${o.status === 'error' ? tr("数据源查询失败","Flight data query failed") : tr("本次无匹配","No matches in these results")}</small>`}</div></div>`).join('')}</div>${page?.next_before?`<button type="button" class="small-btn" data-history-more>${tr('加载更早的记录','Load earlier samples')}</button>`:''}`;
}

export function removedItems(state,kind) {
  const rows=kind==='watches'?(state.deleted_watches || []):(state.removed_offers || state.observations.filter(o=>o.dismissed_at));
  if(!rows.length) return '';
  return `${tr("<details class=\"removed-items\"><summary>最近删除 · ","<details class=\"removed-items\"><summary>Recently removed · ")}${rows.length}${tr(" 条</summary>"," items</summary>")}${rows.map(row=>`<div class="removed-row"><span>${kind==='watches'?`${tr("监控 #","Watch #")}${row.id} · ${escape(row.origin)} → ${escape(row.destinations.join(' / '))}`:`${tr("机票机会 · ","Flight opportunity · ")}${escape(row.offer?.outbound?.from || '')} → ${escape(row.destination)} · ${escape(row.departure)}`}</span><button class="small-btn" data-restore-kind="${kind}" data-remove-id="${row.id}${tr("\">恢复</button></div>","\">Restore</button></div>")}`).join('')}${kind==='offers' && state.removed_next_before?`<button type="button" class="small-btn" data-removed-more>${tr('加载更早的删除记录','Load earlier removed items')}</button>`:''}</details>`;
}
