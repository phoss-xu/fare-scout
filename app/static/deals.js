import {visibilityPoll} from './polling.js';
import {searchStatus} from './deal-progress.js';
import {captureSearch,restoreSearch} from './search-form.js';
import {setupSearchPresets} from './search-presets.js';
import {setupOfferViews} from './offer-views.js';
import {getPreferences,subscribePreferences} from './preferences.js';
import {subscribeCurrency} from './currency.js';
import {tr} from './i18n.js';
import {datePriceRail,resultPriceNote} from './result-comparison.js';
import {fareNumber} from './format.js';
import {request} from './api.js';
import {picker} from './locations.js';
import {escape,money} from './format.js';
import {destinationChoices, discoveryPlaceholder, sampledDays, sortedOffers,watchDraft} from './deal_views.js';
import {setupHolidays} from './holidays.js';
import {setupSearchLayout} from './ui.js';
import {setupNights} from './nights.js';
import {setupTravelDates,selectedWeekends} from './travel-dates.js';
import {setupJourney} from './journey.js';

export function setupDeals(openWatch) {
  const form = document.querySelector('#deals-form'), panel = document.querySelector('#deals-panel');
  const scopeNote=document.createElement('p');scopeNote.className='form-hint';scopeNote.setAttribute('role','status');form.append(scopeNote);
  function summarizeScopes() {
    const count=origin.expandedCount()*(form.elements.anywhere.checked?1:destinations.expandedCount())*(form.elements.date_mode.value==='weekends'?selectedWeekends(form).length:1);
    scopeNote.textContent=count>1?`${count}${tr(" 组查询 · 上限 120 组"," query groups · Limit: 120")}`:'';
    form.dispatchEvent(new Event('journey:locations'));
  }
  form.addEventListener('change',summarizeScopes);
  const origin = picker(panel.querySelector('#deal-origin'), true, summarizeScopes, {editableSelection:true,label:'出发地'});
  const destinations = picker(panel.querySelector('#deal-destination'), true, () => {
    if(destinations.values().length && form.elements.anywhere.checked){
      form.elements.anywhere.checked=false;
      form.elements.anywhere.dispatchEvent(new Event('change',{bubbles:true}));
    }
    summarizeScopes();
  }, {editableSelection:true,maxChoices:100});
  const rangeButton=document.createElement('button');rangeButton.type='button';rangeButton.className='scope-shortcut';rangeButton.textContent=tr("＋ 免签精选","＋ Visa-free selection");
  panel.querySelector('#deal-destination').insertBefore(rangeButton,panel.querySelector('#deal-destination .place-recent'));
  rangeButton.addEventListener('click',()=>destinations.browse('visa-free'));
  const holidays = setupHolidays(panel.querySelector('#deal-holidays'), form, 'deals');
  const layout = setupSearchLayout(form, panel);
  const nights = setupNights(form);
  const journey = setupJourney(form, panel);
  const travelDates = setupTravelDates(form);
  const presets = setupSearchPresets(form, {capture:()=>captureSearch(form,origin,destinations),
    apply:async (config,isCurrent)=>{holidays.clear();await restoreSearch(form,origin,destinations,config,isCurrent);}});
  const status = panel.querySelector('#deal-status'), results = panel.querySelector('#deal-results');
  const controls = panel.querySelector('#deal-result-controls'), button = form.querySelector('[type=submit]');
  controls.querySelector('.deal-date-note').removeAttribute('data-i18n');
  const offerViews=setupOfferViews(results);
  let epoch=0, activeSearch, pollDelay=1500, progress, result, renderedOffers, day='',destination='',edited=false,preferenceKey;
  form.addEventListener('input',()=>edited=true);
  form.addEventListener('change',()=>edited=true);
  const fmt = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  function render() {
    const choices=destinationChoices(result.offers,day);
    if(!choices.some(c=>c.key===destination)) destination='';
    const offers=sortedOffers(result.offers, form.elements.result_sort.value, day).filter(o=>!destination || (o.destination_id || o.outbound.to)===destination);
    offerViews.render(offers, result.offers, result.config.adults,false,{...result.config,checked_at:result.checked_at,currencyInHeader:true});
    const rail=panel.querySelector('#deal-destinations');
    rail.innerHTML='<button type="button" data-deal-destination="" aria-pressed="'+String(!destination)+tr("\">所有目的地</button>","\">All destinations</button>")+choices.map(c=>`<button type="button" data-deal-destination="${escape(c.key)}" aria-pressed="${c.key===destination}"><span>${escape(c.name)}</span><strong>${fareNumber(c.price,result.config.currency)}${tr(' 起',' from')}</strong></button>`).join('');
    panel.querySelector('#deal-days').innerHTML=datePriceRail(result.offers,{day,destination,currency:result.config.currency});
    controls.querySelector('.deal-date-note').textContent=resultPriceNote(result,destination?choices.find(c=>c.key===destination)?.name:'');
  }
  panel.querySelector('#deal-anywhere').addEventListener('click', () => {
    form.elements.anywhere.checked=false;
    form.elements.anywhere.dispatchEvent(new Event('change',{bubbles:true}));
    destinations.browse();
  });
  panel.addEventListener('click', async event => {
    const preset = event.target.closest('[data-deal-range]');
    if (preset) {
      form.elements.date_mode.value='range';
      const start = new Date(), end = new Date(); end.setDate(end.getDate()+Number(preset.dataset.dealRange));
      form.elements.start.value=fmt(start); form.elements.end.value=fmt(end);
      form.elements.end.dispatchEvent(new Event('change',{bubbles:true}));
    }
    const date = event.target.closest('[data-deal-day]');
    if (date && result) { day=date.dataset.dealDay; render(); panel.querySelector(`[data-deal-day="${day}"]`).focus({preventScroll:true}); }
    const city=event.target.closest('[data-deal-destination]');
    if(city && result) {destination=city.dataset.dealDestination;render();panel.querySelectorAll('[data-deal-destination]').forEach(b=>{if(b.dataset.dealDestination===destination)b.focus();});}
    const watch = event.target.closest('[data-deal-watch]');
    if (watch && result) {
      const offer = result.offers[Number(watch.dataset.dealWatch)];
      if (offer.outbound.from !== offer.inbound.to || offer.outbound.to !== offer.inbound.from) {
        status.textContent=tr("往返机场不同，请选择对应城市或国家创建监控。","Return airports differ. Select the relevant city or country for your watch."); return;
      }
      watch.disabled=true;
      try { await openWatch(watchDraft(offer,result.config)); }
      catch (error) { status.textContent=error.message; }
      finally { watch.disabled=false; }
    }
  });
  form.elements.result_sort.addEventListener('change', () => { if (result) render(); });
  function showResults(data) {
    result=data;status.textContent=searchStatus(data);
    if(data.status==='running' && !data.offers.length) return;
    const signature=JSON.stringify(data.offers);
    if(signature===renderedOffers) return;
    renderedOffers=signature;
    if(day && !sampledDays(data.offers).some(([date])=>date===day)) day='';
    controls.hidden=false;panel.querySelector('#deal-sort').hidden=false;
    render();
  }
  const poller=visibilityPoll(poll,{delay:()=>pollDelay});
  async function poll() {
    if(!activeSearch) return;
    const {id,version}=activeSearch;
    try {
      const data = await request(`/api/deals/${id}`);
      if (version !== epoch) return;
      if (data.status === 'error') {
        poller.stop();button.disabled=false;results.setAttribute('aria-busy','false');
        status.textContent=tr('数据源连接失败，请稍后重试。','Cannot reach the flight source. Try again later.');results.innerHTML=discoveryPlaceholder('error');return;
      }
      showResults(data);
      if(data.status==='running') {
        const next=JSON.stringify([data.completed,data.total,data.failures]);
        pollDelay=next===progress?Math.min(8000,pollDelay*2):1500;progress=next;return;
      }
      poller.stop();
      button.disabled=false;results.setAttribute('aria-busy','false');
    } catch (error) { if (version === epoch) {
      poller.stop();button.disabled=false;status.textContent=error.message;results.setAttribute('aria-busy','false');
      if(!result?.offers?.length) results.innerHTML=discoveryPlaceholder('error');
    } }
  }
  form.addEventListener('submit',async event => {
    event.preventDefault(); const version=++epoch; poller.stop(); button.disabled=true;
    offerViews.clear(); controls.hidden=true; panel.querySelector('#deal-sort').hidden=true; results.innerHTML=discoveryPlaceholder('loading'); results.setAttribute('aria-busy','true'); result=undefined;renderedOffers=undefined;day='';destination=''; status.textContent=tr("搜索中…","Searching…");
    try {
      const data=captureSearch(form,origin,destinations);
      const task = await request('/api/deals',data);
      if (version === epoch) {activeSearch={id:task.id,version};pollDelay=1500;progress=undefined;poller.start();}
    } catch(error) { if (version === epoch) { status.textContent=error.message; button.disabled=false; results.setAttribute('aria-busy','false'); results.innerHTML=discoveryPlaceholder('error'); } }
  });
  function renderDisplayPreferences() {
    rangeButton.textContent=tr('＋ 免签精选','＋ Visa-free selection');
    summarizeScopes();
    if(result) {
      status.textContent=searchStatus(result);
      if(result.status==='running' && !result.offers.length) return;
      render();
    } else if(!button.disabled) {results.innerHTML=discoveryPlaceholder();status.textContent='';}
  }
  document.addEventListener('locationnameschange',renderDisplayPreferences);
  subscribePreferences(renderDisplayPreferences);subscribeCurrency(renderDisplayPreferences);
  return {applyPreferences(c) {
    const key=JSON.stringify([c.origins,c.adults,c.budget]);
    if(edited || key===preferenceKey) return;
    preferenceKey=key;
    form.elements.adults.value=c.adults;form.elements.budget.value=(c.currency || 'HKD')===getPreferences().currency?(c.budget || ''):'';
    origin.setValues(c.origins).catch(error=>{status.textContent=error.message;});
    form.dispatchEvent(new Event('journey:locations'));
  },reset(active) {
    offerViews.clear();epoch+=1;poller.stop();activeSearch=undefined;form.reset();origin.clear();destinations.clear();result=undefined;renderedOffers=undefined;day='';destination='';edited=false;preferenceKey=undefined;
    holidays.reset(active);
    layout.reset();
    nights.reset();
    results.innerHTML=discoveryPlaceholder();results.setAttribute('aria-busy','false');controls.hidden=true;panel.querySelector('#deal-sort').hidden=true;status.textContent='';button.disabled=false;
    const start=new Date(),end=new Date();end.setDate(end.getDate()+30);
    form.elements.start.value=fmt(start);form.elements.end.value=fmt(end);
    form.elements.start.min=form.elements.end.min=fmt(start);
    travelDates.reset();
    journey.reset();
    presets.reset(active);
    if(active) origin.setInitial('airport:HKG');
  }};
}
