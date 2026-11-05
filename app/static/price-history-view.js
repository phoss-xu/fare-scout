import {escape,amount,time,money} from './format.js';
import {tr} from './i18n.js';
import {displayAmount,currencyLabel} from './currency.js';

export function lowestLabel(h) {
  return h.full_window?tr('近 90 天采样最低','90-day sampled low'):
    tr(`${h.coverage_days} 天采样最低`,`${h.coverage_days}-day sampled low`);
}
export function priceLevelLabel(level) {
  return {collecting:tr('历史积累中','Building history'),low:tr('偏低','Low'),high:tr('偏高','High'),typical:tr('常见价格','Typical')}[level] || '';
}
export function priceBadges(offer) {
  const h=offer.price_history;
  if(!h?.sampled_days)return '';
  return `<span class="price-level">${priceLevelLabel(h.level)}</span>${h.lowest?`<span class="price-lowest">↘ ${lowestLabel(h)}</span>`:''}`;
}
export function priceInsight(offer,{compact=false}={}) {
  const h=offer.price_history;
  if(!h?.sampled_days)return '';
  const delta=Math.abs(h.difference_percent),currency=offer.currency || 'HKD';
  if(compact)return `<button type="button" class="rd-history-link" data-price-history="${escape(h.id)}" data-price-current="${Number(offer.price)}" data-price-currency="${escape(currency)}">${tr('价格历史','Price history')} <span aria-hidden="true">↗</span></button>`;
  const note=h.level==='collecting'?tr('积累 7 个采样日后判断高低','Price assessment starts after 7 sampled days'):
    delta<.05?tr('与历史中位价相近','Close to the historical median'):
    h.difference_percent<0?tr(`比历史中位价低 ${delta.toFixed(0)}%`,`${delta.toFixed(0)}% below the historical median`):
      tr(`比历史中位价高 ${delta.toFixed(0)}%`,`${delta.toFixed(0)}% above the historical median`);
  return `<div class="price-insight" data-price-level="${escape(h.level)}"><div class="price-insight-tags">${priceBadges(offer)}</div><p>${escape(note)}</p><button type="button" data-price-history="${escape(h.id)}" data-price-current="${Number(offer.price)}" data-price-currency="${escape(currency)}">${tr(`覆盖 ${h.coverage_days} 天 · 实际采样 ${h.sampled_days} 天`,`Covers ${h.coverage_days} days · ${h.sampled_days} sampled`)} <span aria-hidden="true">↗</span></button><small>${tr('最近查询 ','Last checked ')}${escape(time(h.last_at))}</small></div>`;
}
export function historyChart(points,currency) {
  if(!points.length)return '';
  if(points.length===1)return `<p class="price-history-single">${tr('目前只有 1 个采样日，跨天采样后展示价格趋势。','Only 1 sampled day so far. A trend will appear after sampling on more days.')}</p>`;
  const min=Math.min(...points.map(p=>p.price)),max=Math.max(...points.map(p=>p.price)),spread=max-min || max*.1 || 1;
  const first=Date.parse(points[0].day),span=Date.parse(points.at(-1).day)-first || 86400000;
  const x=p=>24+(Date.parse(p.day)-first)/span*592,y=p=>144-(p.price-min)/spread*112;
  // A broken line across unsampled dates would imply observations that do not exist.
  const segments=[];let segment=[];
  for(const p of points){if(segment.length && Date.parse(p.day)-Date.parse(segment.at(-1).day)>86400000){segments.push(segment);segment=[];}segment.push(p);}segments.push(segment);
  return `<figure class="price-history-chart"><svg viewBox="0 0 640 176" role="img" aria-label="${tr('每天最低有效报价，缺少采样的日期留空','Daily lowest valid fares; unsampled dates are gaps')}"><line class="price-chart-axis" x1="24" y1="152" x2="616" y2="152"/>${segments.map(s=>`<polyline points="${s.map(p=>`${x(p)},${y(p)}`).join(' ')}"/>`).join('')}${points.map(p=>`<circle cx="${x(p)}" cy="${y(p)}" r="4"><title>${escape(p.day)} · ${escape(amount(p.price,currency))}</title></circle>`).join('')}</svg><figcaption><span>${escape(points[0].day)}</span><span>${tr('每日最低报价','Daily sampled low')}</span><span>${escape(points.at(-1).day)}</span></figcaption></figure>`;
}
export function historyContent(data,current,currency) {
  const h=data.summary,id=data.identity,p=displayAmount(0,currency);
  const number=value=>{const v=displayAmount(value,currency);return escape((v.converted?'≈ ':'')+v.amount);};
  const units=tr('金额单位：','Amounts in ')+currencyLabel(p.code)+(p.converted?
    tr(` · 源币种 ${currency} · 参考汇率 ${p.date}`,` · Source ${currency} · Reference rate ${p.date}`):'');
  const level=h.sampled_days<7?'collecting':current<=h.median*.9?'low':current>=h.median*1.1?'high':'typical';
  const metrics=[[tr('当前所选报价','Selected quote'),current],[tr('历史中位价','Historical median'),h.median],
    [tr('采样最低','Sampled low'),h.minimum],[tr('采样最高','Sampled high'),h.maximum]];
  return `<p class="price-history-route">${escape(id.outbound[0])} ${id.inbound?'⇄':'→'} ${escape(id.outbound[1])} · ${escape(id.outbound[2])}${id.inbound?' / '+escape(id.inbound[2]):''} · ${id.adults}${tr(' 人 · 经济舱',' travellers · Economy')}</p>
    <p class="price-history-units">${escape(units)}</p>
    <div class="price-history-metrics">${metrics.map(([label,value],index)=>`<div${index===0?' data-price-level="'+level+'"':''}><span>${label}</span><strong>${number(value)}</strong></div>`).join('')}</div>
    <p class="price-history-coverage">${tr(`覆盖 ${h.coverage_days} 天 · 实际采样 ${h.sampled_days} 天`,`Covers ${h.coverage_days} days · ${h.sampled_days} sampled`)} · ${tr('最近查询 ','Last checked ')}${escape(time(h.last_at))}</p>
    ${historyChart(data.points,currency)}
    <details><summary>${tr('逐日记录与统计口径','Daily records and comparison basis')}</summary><p class="price-history-explanation">${tr('保留最近 90 天报价，按北京时间每天最低有效报价计算中位价；采样满 7 天后，低于中位价至少 10% 标为偏低，高于至少 10% 标为偏高。只比较相同机场、出行日期、人数、舱位、源币种、行李及筛选条件，航班可不同。','Quotes are retained for 90 days. The median uses each sampled day’s lowest valid fare (Beijing time). After 7 sampled days, at least 10% below/above the median is low/high. Airports, travel dates, travellers, cabin, source currency, baggage and filters must match; flights may differ.')} ${tr('这是已返回报价的采样记录，不代表市场全部报价，也不预测后续涨跌。','These samples cover returned quotes, not the entire market, and do not predict future prices.')}</p>
    <p>${tr('历史均价 ','Historical mean ')}${number(h.mean)}${p.converted?` · ${tr('所选报价源价 ' ,'Selected source quote ')}${escape(currency)} ${escape(money(current))}`:''}</p><p>${tr('每程中转次数','Stops per leg')}: ${escape([id.outbound[3],...(id.inbound?[id.inbound[3]]:[])].join(' / '))} · ${tr('筛选条件','Filters')}: ${escape(id.max_stops<0?tr('不限中转','Any stops'):id.max_stops+tr(' 次中转以内',' stops maximum'))}, ${escape(id.max_duration_hours? id.max_duration_hours+tr(' 小时以内',' hours maximum'):tr('不限时长','Any duration'))}${id.weekend?' · '+tr('凌晨往返','Overnight return'):''}${id.time_windows?' · '+tr('限定时间窗口','Restricted time windows'):''}</p><div class="price-history-table"><table><thead><tr><th>${tr('采样日期（北京时间）','Sample date (Beijing time)')}</th><th>${tr('当日最低','Daily low')}</th></tr></thead><tbody>${data.points.slice().reverse().map(p=>`<tr><td>${escape(p.day)}</td><td>${number(p.price)}</td></tr>`).join('')}</tbody></table></div></details>`;
}
