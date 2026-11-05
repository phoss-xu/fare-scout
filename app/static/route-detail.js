import {routeDetailSearch} from './route-detail-search.js';
import {shiftDay,queryPair} from './route-date-strip.js';
import {tr} from './i18n.js';
import {routeOffers,datePair,routeOptions,selectOutbound,returnChoices,legIdentity} from './route-detail-model.js';
import {routeDetailMarkup} from './route-detail-views.js';
import {subscribePreferences} from './preferences.js';
import {subscribeCurrency} from './currency.js';

export function setupRouteDetail(container,getData) {
  let dialog,offers,selected,context,state,opener,previousOverflow;
  const search=routeDetailSearch({status(loading,message){state.loading=loading;state.message=message;render(state.dateFocus || '[data-rd-load]');},done(result,filters){
    state.loading=false;
    const incoming=routeOffers(selected,result.offers,context.currency).map(o=>({...o,_checked_at:result.checked_at}));
    state.checkedPairs[queryPair(filters)]=incoming.length;
    if(incoming.length){
      const pair=datePair(incoming[0]);offers=[...offers.filter(o=>datePair(o)!==pair),...incoming];
      state.date='';selectVisible();
      state.message=tr(`补查返回 ${incoming.length} 个方案，已更新报价。`,`Found ${incoming.length} options; quotes updated.`);
    } else state.message=tr('该日期组合暂未返回匹配报价。其他日期报价已保留，可切回比较；不代表没有航班。','No matching quotes returned for these dates. Quotes for other dates remain available; this does not mean no flights.');
    render(state.dateFocus || '[data-rd-load]');
  }});
  function render(focusKey) {
    if(!dialog?.open)return;
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
    if(event.target.closest('a,summary,details,input,select,[data-trip-save],[data-trip-share],[data-trip-alert]'))return;
    const data=getData(),offer=data?.all[Number(card.dataset.routeDetail)];if(!offer)return;
    context={...data.context,adults:data.adults};offers=routeOffers(offer,data.all,context.currency);selected=offer;
    state={checkedPairs:{},date:'',outDate:offer.outbound.departureTime.slice(0,10),inDate:offer.inbound?.departureTime.slice(0,10) || '',sort:'price',onlyDirect:false};opener=card.querySelector('[data-route-open]');
    if(!dialog){
      dialog=document.createElement('dialog');dialog.className='route-detail';dialog.setAttribute('aria-labelledby','route-detail-title');document.body.append(dialog);
      dialog.addEventListener('close',()=>{search.cancel();document.body.style.overflow=previousOverflow;opener?.focus({preventScroll:true});});
      dialog.addEventListener('click',e=>{
        if(e.target.closest('[data-rd-load]')){state.dateFocus='';if(!state.outDate || (selected.inbound && (!state.inDate || state.inDate<state.outDate))){state.message=tr('请填写出发日期，返程日期不能早于出发日期。','Choose a departure date and a return date on or after departure.');render();return;}void search.start(selected,context,{...state});return;}
        if(e.target.closest('[data-rd-reset]')){search.cancel();state.loading=false;state.message='';for(const key of ['outDate','inDate','outFrom','outTo','inFrom','inTo','date'])state[key]='';selectVisible();render('[data-rd-reset]');return;}
        if(e.target.closest('[data-rd-close]')){close();return;}
        const page=e.target.closest('[data-rd-page]');
        if(page){const prefix=page.dataset.rdDirection;state.recenter=prefix;state[prefix+'Anchor']=shiftDay(state[prefix+'Anchor'] || state[prefix+'Date'] || (prefix==='out'?selected.outbound:selected.inbound).departureTime.slice(0,10),Number(page.dataset.rdPage));render(`[data-rd-page="${page.dataset.rdPage}"][data-rd-direction="${prefix}"]`);return;}
        const outbound=e.target.closest('[data-rd-outbound]'),option=e.target.closest('[data-rd-option]'),day=e.target.closest('[data-rd-day]');
        if(outbound){search.cancel();state.loading=false;const previous=selected;selected=selectOutbound(routeOptions(offers,state),offers[Number(outbound.dataset.rdOutbound)],selected);state.message=selected.inbound?(legIdentity(previous.inbound)===legIdentity(selected.inbound)?tr('已切换去程，保留原返程。','Outbound changed; your return is retained.'):tr('已切换去程，并选中可搭配的最低总价返程。','Outbound changed; the lowest compatible return total is selected.')):'';render(`[data-rd-outbound="${outbound.dataset.rdOutbound}"]`);}
        if(day)changeDate(day.dataset.rdDirection,day.dataset.rdDay,`[data-rd-day="${day.dataset.rdDay}"][data-rd-direction="${day.dataset.rdDirection}"]`);
        if(option){search.cancel();state.loading=false;state.message='';selected=offers[Number(option.dataset.rdOption)];render(`[data-rd-option="${option.dataset.rdOption}"]`);}
      });
      dialog.addEventListener('change',e=>{
        if(e.target.matches('[data-rd-field]')){const key=e.target.dataset.rdField;if(key.endsWith('Date')){state.recenter=key.slice(0,-4);state[key.slice(0,-4)+'Anchor']=e.target.value;changeDate(key.slice(0,-4),e.target.value,`[data-rd-field="${key}"]`);}else{search.cancel();state.loading=false;state.message='';state[key]=e.target.value;state.date='';selectVisible();render(`[data-rd-field="${key}"]`);}}
        if(e.target.matches('[data-rd-direct]')){state.onlyDirect=e.target.checked;selectVisible();render('[data-rd-direct]');}
        if(e.target.matches('[data-rd-sort]')){state.sort=e.target.value;render('[data-rd-sort]');}
      });
    }
    previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';dialog.showModal();render();dialog.querySelector('[data-rd-close]').focus({preventScroll:true});dialog.scrollTop=0;
  });
  function changeDate(prefix,day,focus) {
    search.cancel();state.loading=false;state.message='';state.date='';state.dateFocus=focus;
    state[prefix+'Anchor'] ||= state[prefix+'Date'] || day;
    state[prefix+'Date']=day;
    if(day && selected.inbound){const other=prefix==='out'?'in':'out';state[other+'Date'] ||= (other==='out'?selected.outbound:selected.inbound).departureTime.slice(0,10);}
    selectVisible();render(focus);
    if(!day || !state.outDate || (selected.inbound && !state.inDate))return;
    if(selected.inbound && state.inDate<state.outDate){state.message=tr('返程日期不能早于去程日期。','Return must be on or after departure.');render(focus);return;}
    const pair=queryPair(state);
    if(!offers.some(o=>datePair(o)===pair) && state.checkedPairs[pair]===undefined)void search.start(selected,context,{...state});
  }
  function selectVisible(){const visible=routeOptions(offers,state);if(visible.length && !visible.includes(selected))selected=returnChoices(visible,selected)[0] || visible[0];}
  document.addEventListener('locationnameschange',()=>render());
  subscribePreferences(()=>render());subscribeCurrency(()=>render());
  return {close};
}
