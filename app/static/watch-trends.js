import {request} from './api.js';
import {escape} from './format.js';
import {displayAmount,currencyLabel,currencySymbol} from './currency.js';
import {tr} from './i18n.js';

export function setupWatchTrends() {
  const cache=new Map(),pending=new Map();
  function chart(data,currency) {
    const points=data.points || [];
    if(!points.length)return {change:'',graph:`<span>${tr('采样趋势暂不可用','Trend samples are unavailable')}</span>`};
    const recent=points.filter(p=>Date.parse(p.day)>=Date.parse(points.at(-1).day)-6*86400000),changePoints=recent.length>1?recent:points.slice(-2);
    const first=Number(changePoints[0].price),last=Number(changePoints.at(-1).price),delta=last-first,percent=first?delta/first*100:0;
    const changeDays=Math.max(1,Math.floor((Date.parse(changePoints.at(-1).day)-Date.parse(changePoints[0].day))/86400000)+1);
    const direction=delta>0?'up':delta<0?'down':'steady';
    const deltaDisplay=displayAmount(Math.abs(delta),currency),deltaTip=`${currencyLabel(deltaDisplay.code)} (${deltaDisplay.code})`;
    const arrow=direction==='steady'?'':`<svg viewBox="0 0 40 40" aria-hidden="true"><path d="${direction==='up'?'M5 30 C9 16 17 9 30 9 M21 5 L31 9 L25 18':'M5 9 C18 9 27 16 31 30 M23 21 L31 31 L37 21'}"/></svg>`;
    const currencyTip=`<span class="watch-currency-tip"><button type="button" data-currency-tip title="${escape(deltaTip)}" aria-label="${escape(deltaTip)}" aria-expanded="false">${escape(currencySymbol(deltaDisplay.code))}</button><span class="watch-currency-name" role="tooltip" aria-hidden="true">${escape(deltaTip)}</span></span>`;
    const change=points.length>1?`<span class="watch-trend-change ${direction}" aria-label="${escape(tr(direction==='up'?`近${changeDays}天上涨 ${Math.abs(percent).toFixed(1)}%`:`近${changeDays}天下降 ${Math.abs(percent).toFixed(1)}%`,direction==='up'?`Fare up ${Math.abs(percent).toFixed(1)}% over ${changeDays} days`:`Fare down ${Math.abs(percent).toFixed(1)}% over ${changeDays} days`))}">${arrow}<span><strong>${direction==='up'?'+':direction==='down'?'−':''}${Math.abs(percent).toFixed(1)}%</strong><small>${direction==='steady'?tr(`近 ${changeDays} 天持平`,`No change in ${changeDays} days`):tr(`近 ${changeDays} 天 · `,`Last ${changeDays} days · `)}${currencyTip}<span class="watch-trend-delta">${escape(deltaDisplay.amount)}</span></small></span></span>`:`<span class="watch-trend-change collecting">${tr('继续采样中','Sampling')}</span>`;
    const values=points.map(p=>Number(p.price)),min=Math.min(...values),max=Math.max(...values),spread=max-min || max*.08 || 1;
    const firstDay=Date.parse(points[0].day),lastDay=Date.parse(points.at(-1).day),span=lastDay-firstDay || 86400000;
    const coordinates=points.map(p=>({p,x:12+(Date.parse(p.day)-firstDay)/span*296,y:62-(Number(p.price)-min)/spread*46}));
    const paths=coordinates.slice(1).map((point,i)=>{const previous=coordinates[i],mid=(previous.x+point.x)/2,gap=Date.parse(point.p.day)-Date.parse(previous.p.day)>86400000;return `<path class="${gap?'gap':''}" d="M${previous.x},${previous.y} C${mid},${previous.y} ${mid},${point.y} ${point.x},${point.y}"/>`;}).join('');
    const dots=coordinates.map(({p,x,y},i)=>`<circle class="${i===coordinates.length-1?'latest':''}" cx="${x}" cy="${y}" r="${i===coordinates.length-1?4:3}"><title>${escape(p.day)} · ${escape(currencyLabel(displayAmount(p.price,currency).code))} (${escape(displayAmount(p.price,currency).code)}) ${escape(displayAmount(p.price,currency).amount)}</title></circle>`).join('');
    const extrema=[0,values.indexOf(min),values.indexOf(max),values.length-1].filter((v,i,a)=>a.indexOf(v)===i).sort((a,b)=>a-b),labelIndexes=[];
    for(const i of extrema){const endpoint=i===0||i===values.length-1;if(endpoint||labelIndexes.every(j=>Math.abs(coordinates[j].x-coordinates[i].x)>=58))labelIndexes.push(i);}
    const currencyCode=displayAmount(points.at(-1).price,currency).code,symbol=currencySymbol(currencyCode);
    const labels=labelIndexes.map(i=>{const {p,x,y}=coordinates[i],formatted=displayAmount(p.price,currency);const anchor=i===0?'start':i===coordinates.length-1?'end':'middle',labelY=y<23?y+16:y-9;return `<text x="${x}" y="${labelY}" text-anchor="${anchor}">${escape(symbol+formatted.amount)}<title>${escape(p.day)} · ${escape(currencyLabel(formatted.code))} (${escape(formatted.code)}) ${escape(formatted.amount)}</title></text>`;}).join('');
    const label=tr(`同一行程每天采样价格，${points.length} 个采样日`,`Daily sampled fares for the same itinerary, ${points.length} sample days`);
    const summary=tr(`${data.summary.sampled_days} 个采样日 · ${data.summary.coverage_days} 天`,` ${data.summary.sampled_days} sampled days · ${data.summary.coverage_days} days`);
    const graph=`<div class="watch-trend-plot"><svg viewBox="0 0 320 84" role="img" aria-label="${escape(label)}"><line class="watch-trend-grid" x1="8" y1="17" x2="312" y2="17"/><line class="watch-trend-grid" x1="8" y1="64" x2="312" y2="64"/>${paths}<g>${dots}</g><g class="watch-trend-values">${labels}</g></svg></div><div class="watch-trend-caption"><time>${escape(points[0].day)}</time><span>${escape(summary)}</span><time>${escape(points.at(-1).day)}</time></div>`;
    return {change,graph};
  }
  function paint(element,data,currency) {
    const result=chart(data,currency),card=element.closest('.watch-price-panel'),change=card?.querySelector('[data-watch-change]');
    if(change)change.outerHTML=result.change;
    element.innerHTML=result.graph;
  }
  async function load(element) {
    const id=element.dataset.series,currency=element.dataset.currency || 'HKD';
    if(cache.has(id)){paint(element,cache.get(id),currency);return;}
    if(!pending.has(id))pending.set(id,request(`/api/price-history/${encodeURIComponent(id)}`).finally(()=>pending.delete(id)));
    try {const data=await pending.get(id);cache.set(id,data);if(element.isConnected)paint(element,data,currency);}
    catch {if(element.isConnected){const change=element.closest('.watch-price-panel')?.querySelector('[data-watch-change]');if(change)change.textContent=tr('暂不可用','Unavailable');element.innerHTML=`<span>${tr('价格走势暂时不可用','Fare trend temporarily unavailable')}</span><button type="button" class="text-btn" data-watch-trend-retry="${escape(id)}">${tr('重试','Retry')}</button>`;}}
  }
  function render() {
    if(document.querySelector('#watches-panel')?.hidden)return;
    document.querySelectorAll('#watches [data-watch-trend][data-series]').forEach(element=>void load(element));
  }
  document.addEventListener('click',event=>{
    if(event.target.closest('[data-tab="watches"]'))requestAnimationFrame(render);
    const currencyButton=event.target.closest('[data-currency-tip]');
    document.querySelectorAll('[data-currency-tip]').forEach(button=>{const open=button===currencyButton && button.getAttribute('aria-expanded')!=='true';button.setAttribute('aria-expanded',String(open));button.parentElement.classList.toggle('is-open',open);button.parentElement.querySelector('.watch-currency-name')?.setAttribute('aria-hidden',String(!open));});
    const retry=event.target.closest('[data-watch-trend-retry]');
    if(retry){cache.delete(retry.dataset.watchTrendRetry);const card=retry.closest('.watch-card'),placeholder=card?.querySelector('[data-watch-trend]');if(placeholder)void load(placeholder);}
  });
  document.addEventListener('languagechange',render);
  return {render};
}
