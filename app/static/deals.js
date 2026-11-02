import {subscribePreferences} from './preferences.js';
import {subscribeCurrency} from './currency.js';
import {tr} from './i18n.js';
import {amount} from './format.js';
import {request} from './api.js';
import {picker} from './locations.js';
import {escape,money} from './format.js';
import {dealCards, destinationChoices, discoveryPlaceholder, resultSummary, sampledDays, sortedOffers,watchDraft} from './deal_views.js';
import {setupHolidays} from './holidays.js';
import {setupSearchLayout} from './ui.js';
import {setupNights} from './nights.js';
import {setupJourney} from './journey.js';

export function setupDeals(openWatch) {
  const form = document.querySelector('#deals-form'), panel = document.querySelector('#deals-panel');
  const scopeNote=document.createElement('p');scopeNote.className='form-hint';scopeNote.setAttribute('role','status');form.append(scopeNote);
  function summarizeScopes() {
    const count=origin.expandedCount()*(form.elements.anywhere.checked?1:destinations.expandedCount());
    scopeNote.textContent=count>1?`${count}${tr(" 组查询 · 上限 120 组"," query groups · Limit: 120")}`:'';
    form.dispatchEvent(new Event('journey:locations'));
  }
  form.elements.anywhere.addEventListener('change',summarizeScopes);
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
  const status = panel.querySelector('#deal-status'), results = panel.querySelector('#deal-results');
  const controls = panel.querySelector('#deal-result-controls'), button = form.querySelector('[type=submit]');
  let epoch=0, timer, result, day='',destination='',edited=false,preferenceKey;
  form.addEventListener('input',()=>edited=true);
  form.addEventListener('change',()=>edited=true);
  const fmt = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  function render() {
    const choices=destinationChoices(result.offers,day);
    if(!choices.some(c=>c.key===destination)) destination='';
    const offers=sortedOffers(result.offers, form.elements.result_sort.value, day).filter(o=>!destination || (o.destination_id || o.outbound.to)===destination);
    results.innerHTML = dealCards(offers, result.offers, result.config.adults);
    const rail=panel.querySelector('#deal-destinations');
    rail.innerHTML='<button type="button" data-deal-destination="" aria-pressed="'+String(!destination)+tr("\">所有目的地</button>","\">All destinations</button>")+choices.map(c=>`<button type="button" data-deal-destination="${escape(c.key)}" aria-pressed="${c.key===destination}"><span>${escape(c.name)}</span><strong>${amount(c.price)}</strong></button>`).join('');
    panel.querySelectorAll('[data-deal-day]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.dealDay === day)));
  }
  panel.querySelector('#deal-anywhere').addEventListener('click', () => {
    form.elements.anywhere.checked=false;
    form.elements.anywhere.dispatchEvent(new Event('change',{bubbles:true}));
    destinations.browse();
  });
  panel.addEventListener('click', async event => {
    const preset = event.target.closest('[data-deal-range]');
    if (preset) {
      const start = new Date(), end = new Date(); end.setDate(end.getDate()+Number(preset.dataset.dealRange));
      form.elements.start.value=fmt(start); form.elements.end.value=fmt(end);
      form.elements.end.dispatchEvent(new Event('change',{bubbles:true}));
    }
    const date = event.target.closest('[data-deal-day]');
    if (date && result) { day=date.dataset.dealDay; render(); }
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
  async function poll(id, version) {
    try {
      const data = await request(`/api/deals/${id}`);
      if (version !== epoch) return;
      if (data.status === 'running') {
        status.textContent=`${tr("查询中 · ","Checking · ")}${data.completed}/${data.total}`;
        timer=setTimeout(() => poll(id,version),1500); return;
      }
      button.disabled=false; results.setAttribute('aria-busy','false');
      if (data.status === 'error') { status.textContent=tr("数据源连接失败，请稍后重试。","Cannot reach the flight source. Try again later."); results.innerHTML=discoveryPlaceholder('error'); return; }
      result=data; day=''; destination=''; status.textContent=resultSummary(data); controls.hidden=false;
      panel.querySelector('#deal-sort').hidden=false;
      panel.querySelector('#deal-days').innerHTML=tr("<button type=\"button\" data-deal-day=\"\" aria-pressed=\"true\">全部日期</button>","<button type=\"button\" data-deal-day=\"\" aria-pressed=\"true\">All dates</button>")+sampledDays(data.offers).map(([date,price])=>`<button type="button" data-deal-day="${date}" aria-pressed="false">${date.slice(5)}<strong>${amount(price)}</strong></button>`).join('');
      render();
    } catch (error) { if (version === epoch) { button.disabled=false; status.textContent=error.message; results.setAttribute('aria-busy','false'); results.innerHTML=discoveryPlaceholder('error'); } }
  }
  form.addEventListener('submit',async event => {
    event.preventDefault(); const version=++epoch; clearTimeout(timer); button.disabled=true;
    controls.hidden=true; panel.querySelector('#deal-sort').hidden=true; results.innerHTML=discoveryPlaceholder('loading'); results.setAttribute('aria-busy','true'); result=undefined; status.textContent=tr("搜索中…","Searching…");
    try {
      if (!origin.values().length) throw new Error(tr("请选择出发地。","Choose a departure location."));
      const to=form.elements.anywhere.checked ? [] : destinations.values();
      if (!form.elements.anywhere.checked && !to.length) throw new Error(tr("请选择目的地，或勾选不限目的地。","Choose a destination or select Anywhere."));
      const data={...Object.fromEntries(new FormData(form)),origins:origin.values(),destinations:to,
        weekdays:[...form.querySelectorAll('[name=weekday]:checked')].map(e => Number(e.value))};
      const task = await request('/api/deals',data);
      if (version === epoch) poll(task.id,version);
    } catch(error) { if (version === epoch) { status.textContent=error.message; button.disabled=false; results.setAttribute('aria-busy','false'); results.innerHTML=discoveryPlaceholder('error'); } }
  });
  function renderDisplayPreferences() {
    rangeButton.textContent=tr('＋ 免签精选','＋ Visa-free selection');
    summarizeScopes();
    if(result) {
      status.textContent=resultSummary(result);
      panel.querySelector('#deal-days').innerHTML=`<button type="button" data-deal-day="" aria-pressed="${!day}">${tr('全部日期','All dates')}</button>`+sampledDays(result.offers).map(([date,value])=>`<button type="button" data-deal-day="${date}" aria-pressed="${date===day}">${date.slice(5)}<strong>${amount(value)}</strong></button>`).join('');
      render();
    } else if(!button.disabled) {results.innerHTML=discoveryPlaceholder();status.textContent='';}
  }
  subscribePreferences(renderDisplayPreferences);subscribeCurrency(renderDisplayPreferences);
  return {applyPreferences(c) {
    const key=JSON.stringify([c.origins,c.adults,c.budget]);
    if(edited || key===preferenceKey) return;
    preferenceKey=key;
    form.elements.adults.value=c.adults;form.elements.budget.value=c.budget || '';
    origin.setValues(c.origins).catch(error=>{status.textContent=error.message;});
    form.dispatchEvent(new Event('journey:locations'));
  },reset(active) {
    epoch+=1;clearTimeout(timer);form.reset();origin.clear();destinations.clear();result=undefined;destination='';edited=false;preferenceKey=undefined;
    holidays.reset(active);
    layout.reset();
    nights.reset();
    results.innerHTML=discoveryPlaceholder();results.setAttribute('aria-busy','false');controls.hidden=true;panel.querySelector('#deal-sort').hidden=true;status.textContent='';button.disabled=false;
    const start=new Date(),end=new Date();end.setDate(end.getDate()+30);
    form.elements.start.value=fmt(start);form.elements.end.value=fmt(end);
    form.elements.start.min=form.elements.end.min=fmt(start);
    journey.reset();
    if(active) origin.setInitial('airport:HKG');
  }};
}
