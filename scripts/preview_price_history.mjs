// Local-only visual fixture server. Never connects to D1, flight sources or notifications.
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {priceIdentity,seriesId,summarize} from '../cloudflare/src/price-history-model.js';
const root=path.resolve('app/static'),at=new Date().toISOString(),day=86400000;
const base=Date.parse(at);
const date=offset=>new Date(base+offset*day).toISOString().slice(0,10);
const histories=new Map(),offers=[];
for(const [to,values,coverage] of [
  ['SIN',[1950,2020,1990,2000,1980,2050,2000,1680],12],
  ['BKK',[1100,1120,1110,1130,1090,1140,1100,1490],12],
  ['NRT',[2200,2300,2250,2280,2190,2310,2260,1800],91],
  ['KUL',[980],1]
]) {
  const price=values.at(-1),c={adults:1,currency:'HKD',max_stops:-1};
  const o={price,currency:'HKD',baggage:{personalItem:1,cabinBag:1,checkedBag:0},
    outbound:{from:'HKG',to,departureTime:date(25)+'T10:00:00',arrivalTime:date(25)+'T14:00:00',durationSeconds:14400,stops:0},
    inbound:{from:to,to:'HKG',departureTime:date(28)+'T16:00:00',arrivalTime:date(28)+'T20:00:00',durationSeconds:14400,stops:0}};
  const identity=priceIdentity(c,o),id=await seriesId(identity);
  const points=values.map((p,i)=>({day:date(-(values.length-1-i)*(coverage>90?12:1)),price:p,last_at:new Date(base-(values.length-1-i)*(coverage>90?12:1)*day).toISOString()}));
  const summary=summarize(points,new Date(base-(coverage-1)*day).toISOString(),price,at);
  histories.set(id,{id,identity:JSON.parse(identity),points,summary});
  offers.push({...o,price_history:{id,...summary}});
}
const styles=['style','themes','flights','deals','boarding-itinerary','offer-views','trip-actions','route-detail','destination-photos','price-history'];
const html=`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>价格历史 · 本地效果预览</title><script src="/theme-init.js"></script>${styles.map(s=>`<link rel="stylesheet" href="/${s}.css">`).join('')}<link rel="stylesheet" href="/__preview.css"></head><body><main><header class="preview-heading"><p>FARE SCOUT / LOCAL PREVIEW</p><h1>这次机票，算便宜吗？</h1><p class="notice">演示数据 · 仅展示界面效果，不是真实报价，不会写入价格库或发送通知。</p><p>点击「覆盖…天 · 实际采样…天」查看价格曲线。真实查询从首次查价开始积累。</p><label>外观 <select id="preview-theme"><option value="paper">旧书纸</option><option value="night">松林夜色</option></select></label></header><section id="deals-panel"><div id="preview-offers" class="deal-results-grid" data-offer-view="cards"></div></section><p class="preview-end">功能已接入本地 <a href="http://localhost:8787/">Fare Scout 主站 ↗</a>，登录后正常查价即可开始积累。</p></main><script type="module" src="/__preview.js"></script></body></html>`;
const script=`import {dealCards} from '/deal_views.js';
import {setupPriceHistory} from '/price-history.js';
import {setupRouteDetail} from '/route-detail.js';
import {loadLocationNames} from '/location-names.js';
import {ensureRates,subscribeCurrency} from '/currency.js';
import {getAppearance,setAppearance} from '/appearance-store.js';
const offers=${JSON.stringify(offers)};
const target=document.querySelector('#preview-offers');
await loadLocationNames();
const render=()=>{target.innerHTML=dealCards(offers,offers,1,false,{public:true,routeDetail:true,checked_at:${JSON.stringify(at)}});};
render();subscribeCurrency(render);void ensureRates();
setupPriceHistory();
setupRouteDetail(target,()=>({all:offers,adults:1,context:{currency:'HKD',checked_at:${JSON.stringify(at)}}}));
const theme=document.querySelector('#preview-theme');theme.value=getAppearance().theme;
theme.addEventListener('change',()=>setAppearance({theme:theme.value}));`;
const css=`body{margin:0}main{max-width:1080px;margin:0 auto;padding:40px 24px}.preview-heading{max-width:760px;margin-bottom:32px}.preview-heading>p:first-child{font-size:11px;letter-spacing:.18em;color:var(--muted)}h1{font-size:36px;line-height:1.2;margin:12px 0 24px}.preview-heading>p{font-size:14px;line-height:1.7}.preview-heading select{width:auto;display:inline-block;margin-left:8px}.preview-end{font-size:13px;color:var(--muted);line-height:1.7;margin:32px 0}#deals-panel .deal-results-grid[data-offer-view=cards]{grid-template-columns:repeat(2,minmax(0,1fr))}@media(max-width:760px){main{padding:24px 16px}h1{font-size:28px}#deals-panel .deal-results-grid[data-offer-view=cards]{grid-template-columns:minmax(0,1fr)}}`;
const types={'.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2','.ttf':'font/ttf','.jpg':'image/jpeg'};
http.createServer(async(req,res)=>{
  try {
    const pathname=new URL(req.url,'http://localhost').pathname;
    res.setHeader('Cache-Control','no-store');
    if(pathname==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(html);}
    if(pathname==='/__preview.js'){res.setHeader('Content-Type','text/javascript');return res.end(script);}
    if(pathname==='/__preview.css'){res.setHeader('Content-Type','text/css');return res.end(css);}
    if(pathname.startsWith('/api/price-history/')) {
      const value=histories.get(pathname.split('/').at(-1));res.setHeader('Content-Type','application/json');
      res.statusCode=value?200:404;return res.end(JSON.stringify(value || {error:'这份演示历史不存在。'}));
    }
    const file=path.resolve(root,'.'+decodeURIComponent(pathname));
    if(!file.startsWith(root+path.sep)){res.statusCode=404;return res.end();}
    res.setHeader('Content-Type',types[path.extname(file)] || 'application/octet-stream');res.end(await readFile(file));
  }catch(error){res.statusCode=404;res.end('Preview asset unavailable');console.warn('Preview asset unavailable',error.code || error.name);}
}).listen(8790,'127.0.0.1',()=>console.log('Price history preview: http://localhost:8790 (demo data only)'));
