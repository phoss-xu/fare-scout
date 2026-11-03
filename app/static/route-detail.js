import {routeDetailSearch} from './route-detail-search.js';
import {tr} from './i18n.js';
import {routeOffers,datePair,routeOptions} from './route-detail-model.js';
import {routeDetailMarkup} from './route-detail-views.js';
import {subscribePreferences} from './preferences.js';
import {subscribeCurrency} from './currency.js';

export function setupRouteDetail(container,getData) {
  let dialog,offers,selected,context,state,opener,previousOverflow;
  const search=routeDetailSearch({status(loading,message){state.loading=loading;state.message=message;render('[data-rd-load]');},done(result){
    state.loading=false;
    const incoming=routeOffers(selected,result.offers,context.currency).map(o=>({...o,_checked_at:result.checked_at}));
    if(incoming.length){
      const pair=datePair(incoming[0]);offers=[...offers.filter(o=>datePair(o)!==pair),...incoming];
      selected=incoming[0];state.date=pair;state.onlyDirect=false;
      state.message=tr(`补查返回 ${incoming.length} 个方案，已更新报价。`,`Found ${incoming.length} options; quotes updated.`);
    } else state.message=tr('这次补查没有返回匹配方案，仍展示上次报价；不代表没有航班。','No matching quotes returned. Previous quotes remain; this does not mean no flights.');
    render('[data-rd-load]');
  }});
  function render(focusKey) {
    if(!dialog?.open)return;
    const scroll=dialog.scrollTop,listScroll=dialog.querySelector('.rd-option-list')?.scrollTop || 0;
    dialog.innerHTML=routeDetailMarkup(offers,selected,context,state);
    dialog.scrollTop=scroll;
    dialog.querySelector('.rd-option-list').scrollTop=listScroll;
    if(focusKey)dialog.querySelector(focusKey)?.focus({preventScroll:true});
  }
  function close(){search.cancel();dialog?.close();}
  container.addEventListener('click',event=>{
    const card=event.target.closest('[data-route-detail]');if(!card)return;
    if(event.target.closest('a,summary,details,input,select,[data-trip-save],[data-trip-share],[data-trip-alert]'))return;
    const data=getData(),offer=data?.all[Number(card.dataset.routeDetail)];if(!offer)return;
    context={...data.context,adults:data.adults};offers=routeOffers(offer,data.all,context.currency);selected=offer;
    state={date:datePair(offer),sort:'price',onlyDirect:false};opener=card.querySelector('[data-route-open]');
    if(!dialog){
      dialog=document.createElement('dialog');dialog.className='route-detail';dialog.setAttribute('aria-labelledby','route-detail-title');document.body.append(dialog);
      dialog.addEventListener('close',()=>{search.cancel();document.body.style.overflow=previousOverflow;opener?.focus({preventScroll:true});});
      dialog.addEventListener('click',e=>{
        if(e.target.closest('[data-rd-load]')){void search.start(selected,context);return;}
        if(e.target.closest('[data-rd-close]')){close();return;}
        const option=e.target.closest('[data-rd-option]'),date=e.target.closest('[data-rd-date]');
        if(option){search.cancel();state.loading=false;state.message='';selected=offers[Number(option.dataset.rdOption)];render(`[data-rd-option="${option.dataset.rdOption}"]`);}
        if(date){search.cancel();state.loading=false;state.message='';state.date=date.dataset.rdDate;selectVisible();render(`[data-rd-date="${state.date}"]`);}
      });
      dialog.addEventListener('change',e=>{
        if(e.target.matches('[data-rd-direct]')){state.onlyDirect=e.target.checked;selectVisible();render('[data-rd-direct]');}
        if(e.target.matches('[data-rd-sort]')){state.sort=e.target.value;render('[data-rd-sort]');}
      });
    }
    previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';dialog.showModal();render();dialog.querySelector('[data-rd-close]').focus({preventScroll:true});dialog.scrollTop=0;
  });
  function selectVisible(){const visible=routeOptions(offers,state);if(visible.length && !visible.includes(selected))selected=visible[0];}
  document.addEventListener('locationnameschange',()=>render());
  subscribePreferences(()=>render());subscribeCurrency(()=>render());
  return {close};
}
