import {request} from './api.js';
import {picker} from './locations.js';
import {money} from './format.js';
import {dealCards, discoveryPlaceholder, resultSummary, sampledDays, sortedOffers,watchDraft} from './deal_views.js';
import {setupHolidays} from './holidays.js';
import {setupSearchLayout} from './ui.js';
import {setupNights} from './nights.js';
import {setupJourney} from './journey.js';

export function setupDeals(openWatch) {
  const form = document.querySelector('#deals-form'), panel = document.querySelector('#deals-panel');
  const scopeNote=document.createElement('p');scopeNote.className='form-hint';scopeNote.setAttribute('role','status');form.append(scopeNote);
  function summarizeScopes() {
    const count=origin.expandedCount()*(form.elements.anywhere.checked?1:destinations.expandedCount());
    scopeNote.textContent=`已选 ${origin.values().length} 个出发范围 · ${form.elements.anywhere.checked?'不限目的地':`${destinations.values().length} 个目的地范围`} · 展开后 ${count} 组查询（最多 120 组）`;
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
  const rangeButton=document.createElement('button');rangeButton.type='button';rangeButton.className='scope-shortcut';rangeButton.textContent='＋ 免签精选';
  panel.querySelector('#deal-destination').insertBefore(rangeButton,panel.querySelector('#deal-destination .place-recent'));
  rangeButton.addEventListener('click',()=>destinations.browse('visa-free'));
  const holidays = setupHolidays(panel.querySelector('#deal-holidays'), form, 'deals');
  const layout = setupSearchLayout(form, panel);
  const nights = setupNights(form);
  const journey = setupJourney(form, panel);
  const status = panel.querySelector('#deal-status'), results = panel.querySelector('#deal-results');
  const controls = panel.querySelector('#deal-result-controls'), button = form.querySelector('[type=submit]');
  let epoch=0, timer, result, day='',edited=false,preferenceKey;
  form.addEventListener('input',()=>edited=true);
  form.addEventListener('change',()=>edited=true);
  const fmt = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  function render() {
    results.innerHTML = dealCards(sortedOffers(result.offers, form.elements.result_sort.value, day), result.offers, result.config.adults);
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
    const watch = event.target.closest('[data-deal-watch]');
    if (watch && result) {
      const offer = result.offers[Number(watch.dataset.dealWatch)];
      if (offer.outbound.from !== offer.inbound.to || offer.outbound.to !== offer.inbound.from) {
        status.textContent='这趟往返使用不同机场，请在创建监控时选择对应城市或国家范围。'; return;
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
        status.textContent=`正在寻找好价格 · 已查询 ${data.completed}/${data.total} 个范围，通常需要几十秒…`;
        timer=setTimeout(() => poll(id,version),1500); return;
      }
      button.disabled=false; results.setAttribute('aria-busy','false');
      if (data.status === 'error') { status.textContent='这次暂时没查到数据，数据源连接失败，请稍后重试。'; results.innerHTML=discoveryPlaceholder('error'); return; }
      result=data; day=''; status.textContent=resultSummary(data); controls.hidden=false;
      panel.querySelector('#deal-sort').hidden=false;
      panel.querySelector('#deal-days').innerHTML='<button type="button" data-deal-day="" aria-pressed="true">全部日期</button>'+sampledDays(data.offers).map(([date,price])=>`<button type="button" data-deal-day="${date}" aria-pressed="false">${date.slice(5)}<strong>HK$${money(price)}</strong></button>`).join('');
      render();
    } catch (error) { if (version === epoch) { button.disabled=false; status.textContent=error.message; results.setAttribute('aria-busy','false'); results.innerHTML=discoveryPlaceholder('error'); } }
  }
  form.addEventListener('submit',async event => {
    event.preventDefault(); const version=++epoch; clearTimeout(timer); button.disabled=true;
    controls.hidden=true; panel.querySelector('#deal-sort').hidden=true; results.innerHTML=discoveryPlaceholder('loading'); results.setAttribute('aria-busy','true'); result=undefined; status.textContent='正在发起特价搜索…';
    try {
      if (!origin.values().length) throw new Error('请从候选中选择出发地。');
      const to=form.elements.anywhere.checked ? [] : destinations.values();
      if (!form.elements.anywhere.checked && !to.length) throw new Error('请选择目的地，或勾选不限目的地。');
      const data={...Object.fromEntries(new FormData(form)),origins:origin.values(),destinations:to,
        weekdays:[...form.querySelectorAll('[name=weekday]:checked')].map(e => Number(e.value))};
      const task = await request('/api/deals',data);
      if (version === epoch) poll(task.id,version);
    } catch(error) { if (version === epoch) { status.textContent=error.message; button.disabled=false; results.setAttribute('aria-busy','false'); results.innerHTML=discoveryPlaceholder('error'); } }
  });
  return {applyPreferences(c) {
    const key=JSON.stringify([c.origins,c.adults,c.budget]);
    if(edited || key===preferenceKey) return;
    preferenceKey=key;
    form.elements.adults.value=c.adults;form.elements.budget.value=c.budget || '';
    origin.setValues(c.origins).catch(error=>{status.textContent=error.message;});
    form.dispatchEvent(new Event('journey:locations'));
  },reset(active) {
    epoch+=1;clearTimeout(timer);form.reset();origin.clear();destinations.clear();result=undefined;edited=false;preferenceKey=undefined;
    holidays.reset(active);
    layout.reset();
    nights.reset();
    results.innerHTML=discoveryPlaceholder();results.setAttribute('aria-busy','false');controls.hidden=true;panel.querySelector('#deal-sort').hidden=true;status.textContent='搜索后，这里会出现适合你的行程。';button.disabled=false;
    const start=new Date(),end=new Date();end.setDate(end.getDate()+30);
    form.elements.start.value=fmt(start);form.elements.end.value=fmt(end);
    form.elements.start.min=form.elements.end.min=fmt(start);
    journey.reset();
    if(active) origin.setInitial('airport:HKG');
  }};
}
