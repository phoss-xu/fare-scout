import {loadDestinationPhotos,destinationRow,destinationHero} from './route-card-views.js';
import {amount,escape} from './format.js';
import {tr} from './i18n.js';
import {dealCards} from './deal_views.js';
import {groupedRoutes,routeName} from './route-projection.js';
import {mountRouteChart} from './route-map-chart.js';
let geography;
async function loadGeography() {
  if(!geography) geography=fetch('/route-airports.json').then(async response=>{
    if(!response.ok)throw new Error(`Map geography HTTP ${response.status}`);
    const data=await response.json();if(!data.airports)throw new Error('Invalid map geography');return data;
  }).catch(error=>{geography=undefined;throw error;});
  return geography;
}
export function mountRouteMap(container,data) {
  let active=true,chart,retryDispose=()=>{};
  container.innerHTML=`<section class="route-map-shell"><p role="status">${tr('正在展开地图…','Unfolding your map…')}</p></section>`;
  const shell=container.firstElementChild;
  Promise.all([loadGeography(),loadDestinationPhotos()]).then(([geo,photos])=>{
    if(!active)return;
    const {groups,missing}=groupedRoutes(data.offers,geo.airports);
    shell.innerHTML=`<div class="route-map-heading"><div><span class="eyebrow">LET’S GO SOMEWHERE</span><h3>${tr('下一站，去哪儿？','Where will you go next?')}</h3></div><p>${groups.length}${tr(' 条航线',' routes')}</p></div>${groups.length?`<div class="route-map-workspace"><div class="route-map-stage"><div class="route-map-canvas" aria-label="${tr('机票航线地图','Flight route map')}"></div><div class="route-map-legend"><span><i></i>${tr('目的地','Destination')}</span><span>${tr('部分低价','Selected lower fares')}</span></div></div><aside class="route-map-sidebar" aria-label="${tr('目的地与报价','Destinations and fares')}"><div class="map-browse"><div class="map-browse-heading"><strong>${tr('探索目的地','Explore destinations')}</strong><span>${groups.length}${tr(' 条航线',' routes')}</span></div><label class="map-search-label"><span class="sr-only">${tr('查找地图目的地','Find a map destination')}</span><input type="search" placeholder="${tr('城市、机场或出发地','City, airport or origin')}" aria-label="${tr('查找地图目的地','Find a map destination')}"></label><div class="map-destination-list"></div></div><div class="route-map-detail" hidden></div></aside></div><p class="route-map-hint">${tr('本次同航线低价 · 航线仅示意','Lowest returned per route · Schematic routes')}</p>`:''}${missing.length?`<p class="route-map-hint">${missing.length}${tr(' 条报价无坐标，见下方',' quotes without coordinates below')}</p><div class="route-map-fallback">${dealCards(missing,data.all,data.adults,data.recommendation,data.context)}</div>`:''}`;
    if(!groups.length)return;
    const canvas=shell.querySelector('.route-map-canvas'),browse=shell.querySelector('.map-browse'),detail=shell.querySelector('.route-map-detail'),list=shell.querySelector('.map-destination-list'),search=shell.querySelector('input[type=search]');
    function renderList() {
      const query=search.value.trim().toLocaleLowerCase();
      list.innerHTML=groups.map((g,index)=>({g,index})).filter(({g})=>[routeName(g),g.from,g.to,g.offers[0].destination_country].join(' ').toLocaleLowerCase().includes(query)).sort((a,b)=>(query?Number(a.g.to.toLocaleLowerCase()!==query)-Number(b.g.to.toLocaleLowerCase()!==query):0) || a.g.offers[0].price-b.g.offers[0].price).map(({g,index})=>destinationRow(g,index,photos,data.adults)).join('') || `<p class="route-map-hint">${tr('本次结果无匹配','No match in these results')}</p>`;
    }
    function select(index) {
      const group=groups[index];chart.select(index);browse.hidden=true;detail.hidden=false;
      detail.innerHTML=`<button type="button" class="map-back" data-map-back>← ${tr('全部目的地','All destinations')}</button>${destinationHero(group,photos)}${group.offers.length>1?`<label class="route-date-picker">${tr('选择出行日期','Choose travel dates')}<select aria-label="${tr('地图出行日期','Map travel dates')}">${group.offers.map((o,i)=>`<option value="${i}">${escape(o.outbound.departureTime.slice(0,10))}${o.inbound?' → '+escape(o.inbound.departureTime.slice(0,10)):''} · ${escape(amount(o.price,o.currency || data.context?.currency))}</option>`).join('')}</select></label>`:''}<div class="route-popup-offer">${dealCards([group.offers[0]],data.all,data.adults,data.recommendation,data.context)}</div>`;
      detail.querySelector('.map-back').focus({preventScroll:true});
      detail.querySelector('select')?.addEventListener('change',event=>{detail.querySelector('.route-popup-offer').innerHTML=dealCards([group.offers[Number(event.target.value)]],data.all,data.adults,data.recommendation,data.context);});
    }
    chart=mountRouteChart(canvas,groups,geo,select);
    search.addEventListener('input',renderList);renderList();
    shell.addEventListener('click',event=>{
      const row=event.target.closest('[data-map-pick]');if(row)select(Number(row.dataset.mapPick));
      if(event.target.closest('[data-map-back]')){detail.hidden=true;browse.hidden=false;chart.select(-1);search.focus();}
    });
    shell.addEventListener('keydown',event=>{if(event.key==='Escape' && !detail.hidden)detail.querySelector('[data-map-back]').click();});
  }).catch(error=>{
    if(!active)return;
    console.error('Flight map could not load',error);
    shell.innerHTML=`<p role="status">${tr('地图加载失败 · 报价见下方','Map unavailable · Quotes below')}</p><button type="button" data-map-retry>${tr('重试地图','Retry map')}</button><div class="route-map-fallback">${dealCards(data.offers,data.all,data.adults,data.recommendation,data.context)}</div>`;
    shell.querySelector('[data-map-retry]').onclick=()=>{active=false;retryDispose=mountRouteMap(container,data);};
  });
  return ()=>{active=false;chart?.dispose();retryDispose();};
}
