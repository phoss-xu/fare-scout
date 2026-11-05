import {windowDescription} from './time-windows.js';
import {currencyLabel} from './currency.js';
import {request} from './api.js';
import {tr} from './i18n.js';
import {escape} from './format.js';
import {chinaToday} from './holidays.js';

export function presetDescription(c) {
  const places=ids=>ids.map(id=>id.split(':').at(-1)).join(' / ');
  const dates=c.time_windows?windowDescription(c.time_windows):c.trip_type==='oneway' && c.date_mode==='fixed'?c.start:c.date_pairs ? c.date_pairs.map(p=>`${p.start.slice(5)}–${p.end.slice(5)}`).join(' · ') : `${c.start} — ${c.end}`;
  return `${places(c.origins)} → ${c.destinations.length?places(c.destinations):tr('任何地方','Anywhere')} · ${dates}`;
}
export function presetDetails(c) {
  const mode=c.time_windows?tr('时间范围','Time windows'):c.trip_type==='oneway'?tr(c.date_mode==='fixed'?'单程 · 固定日期':'单程 · 灵活日期',c.date_mode==='fixed'?'One-way · Fixed date':'One-way · Flexible dates'):c.date_pairs?tr(`${c.date_pairs.length} 个周末`,`${c.date_pairs.length} weekends`):c.date_mode==='fixed'?tr('固定往返','Fixed return dates'):tr(`灵活日期 · ${c.nights.join('、')} 晚`,`Flexible dates · ${c.nights.join(', ')} nights`);
  const days=tr(['周一','周二','周三','周四','周五','周六','周日'],['Mon','Tue','Wed','Thu','Fri','Sat','Sun']);
  return [mode,`${c.adults}${tr(' 位成人',' adults')}`,c.weekdays.length?c.weekdays.map(d=>days[d]).join(' / '):'',c.max_stops===0?tr('直飞','Direct'):c.max_stops>0?tr(`最多 ${c.max_stops} 次中转`,`Up to ${c.max_stops} stops`):'',c.budget?`${currencyLabel(c.currency || 'HKD')} ${c.budget}`:'',c.max_duration_hours?tr(`每程 ${c.max_duration_hours} 小时内`,`Up to ${c.max_duration_hours} hours per leg`):''].filter(Boolean).join(' · ');
}
export function presetCards(rows, selected='') {
  return rows.map(row=>{
    const expired=row.config.start<chinaToday();
    const description=presetDescription(row.config),details=presetDetails(row.config);
    return `<div class="saved-query"><button type="button" data-preset="${escape(row.id)}" aria-pressed="${row.id===selected}" title="${escape(details)}"><strong>${escape(row.name || description)}</strong>${row.name?`<span>${escape(description)}</span>`:''}<small>${escape(details)}${expired?tr(' · 日期已过，回填后请调整',' · Past dates: adjust after restoring'):''}</small></button><button type="button" class="preset-remove" data-preset-remove="${escape(row.id)}" aria-label="${escape(tr('移除组合：','Remove saved search: ')+(row.name || description))}">×</button></div>`;
  }).join('');
}

export function setupSearchPresets(form, {capture, apply}) {
  const root=form.querySelector('.saved-searches'),list=root.querySelector('.saved-query-list');
  const save=root.querySelector('[data-preset-save]'),name=root.querySelector('#preset-name'),status=root.querySelector('[role=status]');
  const fixedSection=form.querySelector('.fixed-saved-searches'),fixedList=form.querySelector('.fixed-query-shortcuts');
  let rows=[],selected='',epoch=0,operation=0,revision=0,active=false;
  function syncFixed() {fixedSection.hidden=form.elements.trip_type?.value==='oneway' || form.elements.date_mode.value!=='fixed' || !fixedList.childElementCount;}
  function render() {
    list.innerHTML=rows.length?presetCards(rows,selected):`<p class="preset-empty">${tr('暂无保存的组合','No saved searches')}</p>`;
    fixedList.innerHTML=rows.filter(row=>row.config.trip_type!=='oneway' && row.config.date_mode==='fixed' && !row.config.date_pairs).map(row=>`<button type="button" data-preset="${escape(row.id)}" aria-pressed="${row.id===selected}">${escape(row.name || tr('往返','Return'))} · ${escape(row.config.start.slice(5))}–${escape(row.config.end.slice(5))}</button>`).join('');
    syncFixed();
  }
  async function load() {
    const version=epoch,current=++revision;
    status.textContent=tr('正在加载已保存组合…','Loading saved searches…');
    try {
      const data=await request('/api/search-presets');if(version!==epoch || current!==revision) return;
      rows=data.presets;render();status.textContent='';root.querySelector('[data-preset-retry]').hidden=true;
    } catch(error) {
      if(version!==epoch || current!==revision) return;
      status.textContent=tr('暂时无法加载已保存组合，请重试。','Cannot load saved searches. Please retry.');
      root.querySelector('[data-preset-retry]').hidden=false;
    }
  }
  save.addEventListener('click',async()=>{
    if(!form.reportValidity()) return;
    const version=epoch,current=++revision;save.disabled=true;
    try {
      const data=await request('/api/search-presets',{name:name.value,config:capture()});
      if(version!==epoch || current!==revision) return;
      rows=data.presets;render();name.value='';
      status.textContent=tr('已保存','Saved');
    } catch(error) {if(version===epoch && current===revision) status.textContent=error.message;}
    finally {if(version===epoch) save.disabled=false;}
  });
  form.addEventListener('click',async event=>{
    const button=event.target.closest('[data-preset],[data-preset-remove],[data-preset-retry]');
    if(!button) return;
    if(button.hasAttribute('data-preset-retry')) {load();return;}
    const version=epoch,current=++operation;button.disabled=true;
    const isCurrent=()=>version===epoch && current===operation;
    try {
      if(button.dataset.presetRemove) {
        const mutation=++revision;
        const data=await request('/api/search-presets',{action:'remove',id:button.dataset.presetRemove});
        if(version!==epoch || mutation!==revision) return;rows=data.presets;render();status.textContent=tr('组合已移除。','Saved search removed.');
      } else {
        const row=rows.find(row=>row.id===button.dataset.preset);
        await apply(row.config,isCurrent);if(!isCurrent()) return;
        selected=row.id;render();
        status.textContent=row.config.start<chinaToday()?tr('已填入，请更新过期日期','Restored · Update past dates'):tr('已填入','Restored');
      }
    } catch(error) {if(isCurrent()) status.textContent=error.message;}
    finally {if(version===epoch && button.isConnected) button.disabled=false;}
  });
  form.addEventListener('change',syncFixed);
  for(const event of ['input','change']) form.addEventListener(event,()=>{
    if(!selected || root.contains(document.activeElement)) return;
    selected='';form.querySelectorAll('[data-preset]').forEach(b=>b.setAttribute('aria-pressed','false'));
  });
  document.addEventListener('languagechange',()=>{if(active) render();});
  return {reset(enabled) {
    epoch++;operation++;revision++;active=enabled;rows=[];selected='';save.disabled=false;name.value='';status.textContent='';
    root.querySelector('[data-preset-retry]').hidden=true;render();if(enabled) load();
  }};
}
