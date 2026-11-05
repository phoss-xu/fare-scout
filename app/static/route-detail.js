import {routeDetailPrefetch} from './route-detail-prefetch.js';
import {shiftDay,queryPair} from './route-date-strip.js';
import {tr} from './i18n.js';
import {routeOffers,datePair,routeOptions,selectOutbound,returnChoices,legIdentity} from './route-detail-model.js';
import {routeDetailMarkup} from './route-detail-views.js';
import {subscribePreferences} from './preferences.js';
import {subscribeCurrency} from './currency.js';

export function setupRouteDetail(container,getData) {
  let dialog,offers,selected,context,state,opener,previousOverflow;
  const search=routeDetailPrefetch({progress(update){
    Object.assign(state,{prefetch:update,pendingPairs:update.pendingPairs,failedPairs:update.failedPairs});render();
  },result(result,filters){
    const pair=queryPair(filters);
    const incoming=routeOffers(selected,result.offers,context.currency).map(o=>({...o,_checked_at:result.checked_at}));
    state.checkedPairs[pair]=incoming.length;
    if(incoming.length){
      const same=incoming.find(o=>legIdentity(o.outbound)===legIdentity(selected.outbound) && legIdentity(o.inbound)===legIdentity(selected.inbound));
      offers=[...offers.filter(o=>datePair(o)!==pair),...incoming];if(same)selected=same;
    }
    // Background dates must never change the user's selected date or flight.
    if(queryPair(state)===pair)selectVisible();
    render();
  }});
  function render(focusKey) {
    if(!dialog?.open || dialog.querySelector('.date-input-calendar:popover-open'))return;
    const active=document.activeElement;
    if(!focusKey && dialog.contains(active)){
      if(active.matches('input,select'))return;
      if(active.hasAttribute('data-rd-day'))focusKey=`[data-rd-day="${CSS.escape(active.dataset.rdDay)}"][data-rd-direction="${active.dataset.rdDirection}"]`;
      else if(active.hasAttribute('data-rd-close'))focusKey='[data-rd-close]';
    }
    const railScroll=[...dialog.querySelectorAll('[data-rd-rail]')].map(el=>[el.dataset.rdRail,el.scrollLeft]);
    const scroll=dialog.scrollTop,listScroll=[...dialog.querySelectorAll('[data-rd-list]')].map(el=>[el.dataset.rdList,el.scrollTop]);
    state.detailsOpen=dialog.querySelector('.rd-itinerary')?.open || false;
    dialog.innerHTML=routeDetailMarkup(offers,selected,context,state);
    dialog.scrollTop=scroll;
    for(const prefix of ['out','in']){const rail=dialog.querySelector(`[data-rd-rail="${prefix}"]`),old=railScroll.find(([key])=>key===prefix);if(rail){if(old && state.recenter!==prefix)rail.scrollLeft=old[1];else{const current=rail.querySelector('[aria-pressed=true]');rail.scrollLeft=current?current.offsetLeft-rail.offsetLeft-rail.clientWidth/2+current.clientWidth/2:0;}}}
    state.recenter='';
    for(const [key,top] of listScroll)dialog.querySelector(`[data-rd-list="${key}"]`)?.scrollTo(0,top);
    if(focusKey)dialog.querySelector(focusKey)?.focus({preventScroll:true});
  }
  function close(){search.cancel();dialog?.close();}
  container.addEventListener('click',event=>{
    const card=event.target.closest('[data-route-detail]');if(!card)return;
    if(event.target.closest('a,summary,details,input,select,[data-trip-save],[data-trip-share],[data-trip-alert],[data-price-history]'))return;
    const data=getData(),offer=data?.all[Number(card.dataset.routeDetail)];if(!offer)return;
    search.cancel();context={...data.context,adults:data.adults};offers=routeOffers(offer,data.all,context.currency);selected=offer;
    state={checkedPairs:{},date:'',outDate:offer.outbound.departureTime.slice(0,10),inDate:offer.inbound?.departureTime.slice(0,10) || '',sort:'price',onlyDirect:false};opener=card.querySelector('[data-route-open]');
    if(!dialog){
      dialog=document.createElement('dialog');dialog.className='route-detail';dialog.setAttribute('aria-labelledby','route-detail-title');document.body.append(dialog);
      dialog.addEventListener('date-picker-close',e=>{const field=e.target.dataset.rdField;render();if(field)dialog.querySelector(`[data-rd-field="${field}"]`)?.closest('details')?.querySelector('summary')?.focus({preventScroll:true});});
      dialog.addEventListener('close',()=>{search.cancel();document.body.style.overflow=previousOverflow;opener?.focus({preventScroll:true});});
      dialog.addEventListener('click',e=>{
        if(e.target.closest('[data-rd-load]')){state.dateFocus='';if(!state.outDate || (selected.inbound && (!state.inDate || state.inDate<state.outDate))){state.message=tr('请填写出发日期，返程日期不能早于出发日期。','Choose a departure date and a return date on or after departure.');render();return;}search.ensure({...state},true);return;}
        if(e.target.closest('[data-rd-reset]')){state.message='';for(const key of ['outDate','inDate','outFrom','outTo','inFrom','inTo','date'])state[key]='';selectVisible();render('[data-rd-reset]');return;}
        if(e.target.closest('[data-rd-close]')){close();return;}
        const page=e.target.closest('[data-rd-page]');
        if(page){const prefix=page.dataset.rdDirection;state.recenter=prefix;state[prefix+'Anchor']=shiftDay(state[prefix+'Anchor'] || state[prefix+'Date'] || (prefix==='out'?selected.outbound:selected.inbound).departureTime.slice(0,10),Number(page.dataset.rdPage));render(`[data-rd-page="${page.dataset.rdPage}"][data-rd-direction="${prefix}"]`);return;}
        const outbound=e.target.closest('[data-rd-outbound]'),option=e.target.closest('[data-rd-option]'),day=e.target.closest('[data-rd-day]');
        if(outbound){selected=selectOutbound(routeOptions(offers,state),offers[Number(outbound.dataset.rdOutbound)],selected);state.message='';render(`[data-rd-outbound="${outbound.dataset.rdOutbound}"]`);}
        if(day)changeDate(day.dataset.rdDirection,day.dataset.rdDay,`[data-rd-day="${day.dataset.rdDay}"][data-rd-direction="${day.dataset.rdDirection}"]`);
        if(option){state.message='';selected=offers[Number(option.dataset.rdOption)];render(`[data-rd-option="${option.dataset.rdOption}"]`);}
      });
      dialog.addEventListener('focusout',e=>{if(e.target.matches('input,select'))requestAnimationFrame(()=>render());});
      dialog.addEventListener('change',e=>{
        if(e.target.matches('[data-rd-field]')){const key=e.target.dataset.rdField;if(key.endsWith('Date')){state.recenter=key.slice(0,-4);state[key.slice(0,-4)+'Anchor']=e.target.value;changeDate(key.slice(0,-4),e.target.value,`[data-rd-field="${key}"]`);}else{state.message='';state[key]=e.target.value;state.date='';selectVisible();render(`[data-rd-field="${key}"]`);}}
        if(e.target.matches('[data-rd-direct]')){state.onlyDirect=e.target.checked;selectVisible();render('[data-rd-direct]');}
        if(e.target.matches('[data-rd-sort]')){state.sort=e.target.value;render('[data-rd-sort]');}
      });
    }
    previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';dialog.showModal();render();dialog.querySelector('[data-rd-close]').focus({preventScroll:true});dialog.scrollTop=0;
    const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    search.start(offer,context,today);
  });
  function changeDate(prefix,day,focus) {
    state.message='';state.date='';state.dateFocus=focus;
    state[prefix+'Anchor'] ||= state[prefix+'Date'] || day;
    state[prefix+'Date']=day;
    if(day && selected.inbound){const other=prefix==='out'?'in':'out';state[other+'Date'] ||= (other==='out'?selected.outbound:selected.inbound).departureTime.slice(0,10);}
    selectVisible();render(focus);
    if(!day || !state.outDate || (selected.inbound && !state.inDate))return;
    if(selected.inbound && state.inDate<state.outDate){state.message=tr('返程日期不能早于去程日期。','Return must be on or after departure.');render(focus);return;}
    const pair=queryPair(state);
    if(!offers.some(o=>datePair(o)===pair) && state.checkedPairs[pair]===undefined)search.ensure({...state});
  }
  function selectVisible(){const visible=routeOptions(offers,state);if(visible.length && !visible.includes(selected))selected=returnChoices(visible,selected)[0] || visible[0];}
  document.addEventListener('locationnameschange',()=>render());
  subscribePreferences(()=>render());subscribeCurrency(()=>render());
  return {close,reset(){close();search.clear();}};
}
