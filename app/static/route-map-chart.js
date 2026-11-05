import {priceLevelLabel} from './price-history-view.js';
import {tr} from './i18n.js';
import {getPreferences} from './preferences.js';
import {routeName,clusterPoints} from './route-projection.js';
import {loadBasemap} from './route-basemap.js';
import {bubblePrice,bubbleLayout,routeBounds} from './route-bubbles.js';

export function mountRouteChart(container,groups,geo,onSelect) {
  const abort=new AbortController();let active=true,map,renderer,selected=-1,markers=[],observer,mapFailures=0;
  container.innerHTML=`<div class="basemap-surface"></div><div class="basemap-notice" role="status">${tr('正在加载地图…','Loading map…')}</div><button type="button" class="map-overview" hidden>${tr('查看全部','View all')}</button>`;
  const surface=container.querySelector('.basemap-surface'),notice=container.querySelector('.basemap-notice');
  const bounds=routeBounds(groups,geo.airports);
  const ready=()=>{notice.hidden=true;container.querySelector('.map-overview').hidden=false;};
  function route() {
    if(!map?.getSource('selected-flight'))return;
    let coordinates=[];
    if(selected>=0){const g=groups[selected],a=geo.airports[g.from],b=[...geo.airports[g.to]];while(b[0]-a[0]>180)b[0]-=360;while(b[0]-a[0]<-180)b[0]+=360;
      coordinates=Array.from({length:41},(_,i)=>{const t=i/40;return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t+Math.sin(Math.PI*t)*Math.min(4,Math.abs(b[0]-a[0])*.12)];});}
    map.getSource('selected-flight').setData({type:'Feature',properties:{},geometry:{type:'LineString',coordinates}});
  }
  function paint() {
    if(!map || !renderer || !active)return;
    markers.forEach(m=>m.remove());markers=[];
    const width=container.clientWidth,height=container.clientHeight;
    const center=map.getCenter().lng;
    const points=groups.map((g,index)=>{const coordinates=[...geo.airports[g.to]];while(coordinates[0]-center>180)coordinates[0]-=360;while(coordinates[0]-center< -180)coordinates[0]+=360;const p=map.project(coordinates);return {index,coordinates,x:p.x,y:p.y,price:g.offers[0].price,currency:g.offers[0].currency};}).filter(p=>p.x>12 && p.x<width-12 && p.y>12 && p.y<height-36);
    const reserved=[...new Set(groups.map(g=>g.from))].map(code=>{const p=map.project(geo.airports[code]);return {x:p.x-36,y:p.y-34,w:72,h:34};});
    const labels=bubbleLayout(points,width,height,selected,reserved),labeled=new Set(labels.map(p=>p.index));
    function marker(point,button,anchor='center',offset=[0,0]){
      const wrapper=document.createElement('div');wrapper.className='fare-marker';wrapper.append(button);
      markers.push(new renderer.Marker({element:wrapper,anchor,offset}).setLngLat(point.coordinates).addTo(map));
    }
    labels.forEach(point=>{
      const button=document.createElement('button');button.type='button';button.className='fare-bubble';button.textContent=bubblePrice(point.price,point.currency);
      button.dataset.routeIndex=point.index;button.dataset.priceLevel=groups[point.index].offers[0].price_history?.level || '';button.setAttribute('aria-label',`${routeName(groups[point.index])} · ${bubblePrice(point.price,point.currency)}`);button.setAttribute('aria-pressed',String(selected===point.index));button.title=routeName(groups[point.index])+' · '+priceLevelLabel(button.dataset.priceLevel);
      button.onclick=()=>onSelect(point.index);marker(point,button,'bottom',[0,-8]);
    });
    clusterPoints(points.filter(p=>!labeled.has(p.index)),38).forEach(cluster=>{
      if(labels.some(b=>cluster.x>b.x-10 && cluster.x<b.x+b.w+10 && cluster.y>b.y-10 && cluster.y<b.y+b.h+18))return;
      const point=cluster.items[0],button=document.createElement('button');button.type='button';
      if(cluster.items.length===1){button.className='fare-dot';button.setAttribute('aria-label',`${routeName(groups[point.index])} · ${bubblePrice(point.price,point.currency)}`);button.onclick=()=>onSelect(point.index);}
      else{button.className='fare-cluster';button.textContent=cluster.items.length;button.setAttribute('aria-label',tr(`放大查看 ${cluster.items.length} 个目的地`,`Zoom into ${cluster.items.length} destinations`));button.onclick=()=>map.easeTo({center:map.unproject([cluster.x,cluster.y]),zoom:Math.min(12,map.getZoom()+1.5),duration:350});}
      marker(point,button);
    });
    [...new Set(groups.map(g=>g.from))].forEach(code=>{
      const button=document.createElement('span');button.className='fare-origin';button.textContent=`✈ ${code}`;
      marker({coordinates:geo.airports[code]},button,'bottom',[0,-4]);
    });
  }
  function fail(error,partial=false){
    if(!active || error?.name==='AbortError')return;
    console.error('Basemap unavailable',error?.message || 'Map resource failed');
    notice.hidden=false;notice.textContent=partial?tr('部分底图未加载，可重试。报价仍可浏览。','Some map resources failed. Fares remain available.'):tr('底图暂时无法加载，报价仍可浏览。','Basemap unavailable; fares remain available.');
    const button=document.createElement('button');button.type='button';button.textContent=tr('重试','Retry');button.onclick=()=>{button.disabled=true;markers.forEach(m=>m.remove());markers=[];observer?.disconnect();map?.remove();map=undefined;notice.textContent=tr('正在加载地图…','Loading map…');start();};notice.append(button);
  }
  function start(){mapFailures=0;return loadBasemap(abort.signal).then(result=>{
    if(!active)return;renderer=result.renderer;
    map=new renderer.Map({container:surface,style:result.style,center:[114,20],zoom:3,renderWorldCopies:false,attributionControl:{compact:true},dragRotate:false,pitchWithRotate:false,localIdeographFontFamily:getComputedStyle(document.documentElement).fontFamily,locale:{'NavigationControl.ZoomIn':tr('放大地图','Zoom in'),'NavigationControl.ZoomOut':tr('缩小地图','Zoom out'),'AttributionControl.ToggleAttribution':tr('地图来源','Toggle attribution'),'Map.Title':tr('机票地图','Flight map')}});
    map.addControl(new renderer.NavigationControl({showCompass:false}),'bottom-right');
    map.fitBounds(bounds,{padding:{top:65,bottom:65,left:60,right:60},maxZoom:6,duration:0});
    map.on('load',()=>{
      if(!active)return;
      const language=getPreferences().language;
      if(language==='zh-CN')for(const layer of map.getStyle().layers){if(layer.type==='symbol' && layer.layout?.['text-field'])map.setLayoutProperty(layer.id,'text-field',['coalesce',['get','name:zh-Hans'],['get','name:zh'],['get','name:en'],['get','name_en'],['get','name']]);}
      map.addSource('selected-flight',{type:'geojson',data:{type:'FeatureCollection',features:[]}});
      map.addLayer({id:'selected-flight',type:'line',source:'selected-flight',paint:{'line-color':'#df6036','line-width':3,'line-opacity':.9,'line-dasharray':[3,2]}});
      ready();route();paint();
    });
    map.on('error',event=>{mapFailures++;if(mapFailures<=2)console.warn('Basemap resource failed',event.error?.message);if(!map.isStyleLoaded() || mapFailures===3)fail(event.error,map.isStyleLoaded());});map.on('moveend',paint);map.on('resize',paint);
    let previousWidth=container.clientWidth;
    observer=new ResizeObserver(()=>{const width=container.clientWidth;map.resize();if(Math.abs(width-previousWidth)>80){map.stop();map.fitBounds(bounds,{padding:Math.min(60,width*.12),maxZoom:6,duration:0});}previousWidth=width;});observer.observe(container);
    container.querySelector('.map-overview').onclick=()=>map.fitBounds(bounds,{padding:65,maxZoom:6,duration:350});
  }).catch(fail);}
  start();
  return {select(index){selected=index;route();if(map && index>=0){const p=map.project(geo.airports[groups[index].to]);if(p.x<90 || p.x>container.clientWidth-90 || p.y<65 || p.y>container.clientHeight-65)map.easeTo({center:geo.airports[groups[index].to],duration:350});}paint();},dispose(){active=false;abort.abort();observer?.disconnect();markers.forEach(m=>m.remove());map?.remove();}};
}
