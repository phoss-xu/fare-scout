import {tr} from './i18n.js';
import {dealCards} from './deal_views.js';
import {mountRouteMap} from './route-map.js';
const key='fare-scout:offer-view';
const modes=['list','cards','map'];
function savedMode() {
  try {const value=localStorage.getItem(key);return modes.includes(value)?value:'cards';}
  catch {return 'cards';}
}
/** Own presentation only; callers retain filtering, quote indexes and watch actions. */
export function setupOfferViews(container) {
  let mode=savedMode(),data,disposeMap=()=>{};
  const toolbar=document.createElement('div');toolbar.className='offer-view-toolbar';toolbar.hidden=true;
  const frame=container.parentElement.querySelector('.result-frame');
  if(frame) frame.append(toolbar);
  else container.before(toolbar);
  function render() {
    disposeMap();disposeMap=()=>{};
    toolbar.hidden=!data?.offers.length;
    toolbar.innerHTML=`<div role="group" aria-label="${tr('机票展示方式','Flight display style')}">${modes.map((value,i)=>`<button type="button" data-offer-view="${value}" aria-pressed="${mode===value}"><span aria-hidden="true">${['☷','▦','◎'][i]}</span> ${[tr('登机牌','Boarding passes'),tr('卡片','Cards'),tr('地图','Map')][i]}</button>`).join('')}</div>`;
    container.dataset.offerView=mode;
    if(!data) return;
    if(mode==='map' && data.offers.length) {
      disposeMap=mountRouteMap(container,data);
    } else container.innerHTML=dealCards(data.offers,data.all,data.adults,data.recommendation);
  }
  toolbar.addEventListener('click',event=>{
    const button=event.target.closest('[data-offer-view]');if(!button) return;
    mode=button.dataset.offerView;
    try {localStorage.setItem(key,mode);} catch(error) {console.info('Flight view preference unavailable',error.name);}
    render();toolbar.querySelector(`[data-offer-view="${mode}"]`).focus();
  });
  return {
    render(offers,all,adults,recommendation=false){data={offers,all,adults,recommendation};render();},
    clear(){disposeMap();disposeMap=()=>{};data=undefined;toolbar.hidden=true;delete container.dataset.offerView;}
  };
}
