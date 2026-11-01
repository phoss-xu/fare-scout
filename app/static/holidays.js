import {request} from './api.js';
import {escape} from './format.js';

let calendarRequest;
export function chinaToday(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
}
export function holidayRange(holiday, today) {
  if (holiday.end < today) return null;
  return {start:holiday.start < today ? today : holiday.start, end:holiday.end};
}
export function yearFor(data, today) {
  return data.years.find(row => row.holidays.some(day => day.end >= today))?.year ?? data.years.at(-1)?.year;
}
export function applyHoliday(form, holiday, today, kind) {
  const range=holidayRange(holiday,today);
  if (!range) throw new Error('这个假期已经结束，请选择尚未结束的假期。');
  if (kind === 'watch') { form.elements.mode.value='fixed'; form.elements.mode.dispatchEvent(new Event('change')); }
  form.elements.start.value=range.start; form.elements.end.value=range.end;
  for (const name of ['start','end']) form.elements[name].dispatchEvent(new Event('change',{bubbles:true}));
  return range;
}
export function setupHolidays(root, form, kind) {
  let calendar, year, selected, version=0, alive=false;
  const trigger=root.closest('details')?.querySelector('[data-holiday-label]');
  const defaultLabel=kind==='watch'?'按国内假期选择日期':'国内假期';
  const today=() => chinaToday();
  function render() {
    if (!calendar || !alive) return;
    const row=calendar.years.find(r => r.year === year);
    if (!row) return;
    const reference=row.status !== 'official';
    root.innerHTML=`<div class="holiday-heading"><strong>国内假期快捷选</strong><select aria-label="${kind === 'watch' ? '监控' : '特价搜索'}假期年份">${calendar.years.map(r=>`<option value="${r.year}" ${r.year===year?'selected':''}>${r.year} 年 · ${r.status === 'official' ? '已公布' : '参考日期'}</option>`).join('')}</select></div><p class="holiday-year-note">${reference ? '出行参考 · 调休待公布' : '中国内地 · 正式放假安排'}</p><div class="holiday-options">${row.holidays.map(h=>`<button type="button" data-holiday="${h.id}" aria-pressed="${selected===h.id}" ${holidayRange(h,today())?'':'disabled'}><span>${escape(h.name)}</span><small>${h.start.slice(5).replace('-','/')}–${h.end.slice(5).replace('-','/')}${h.end<today()?' · 已结束':''}</small></button>`).join('')}</div><p class="holiday-selection" role="status">${reference ? escape(row.note) : '选择后仍可修改日期。'}</p><a class="holiday-source" href="${escape(row.source)}" target="_blank" rel="noopener noreferrer">${reference ? '参考依据' : '查看官方安排'} ↗</a>`;
  }
  root.addEventListener('change',event=>{
    if(event.target.tagName==='SELECT') { year=Number(event.target.value);selected=undefined;render(); }
  });
  root.addEventListener('click',event=>{
    const button=event.target.closest('[data-holiday]');
    if(!button || button.disabled) return;
    const row=calendar.years.find(r=>r.year===year), holiday=row.holidays.find(h=>h.id===button.dataset.holiday);
    const range=applyHoliday(form,holiday,today(),kind);
    if(kind==='deals') form.querySelectorAll('[name=weekday]').forEach(box=>box.checked=false);
    selected=holiday.id;render();
    if(trigger) trigger.textContent=`${row.year} ${holiday.name}${row.status==='official'?'':' · 调休待公布'}`;
    const workdays=holiday.workdays.length ? ` 补班：${holiday.workdays.map(d=>d.slice(5)).join('、')}。` : '';
    root.querySelector('.holiday-selection').textContent=`${row.year} 年${holiday.name}：${range.start} 至 ${range.end}${holiday.start<today()?'（从今天起）':''}。${row.status==='official'?workdays:' 出行参考，正式放假与调休待公布。'}${kind==='watch'?' 已设为固定日期监控：首日出发、末日返程起飞。':' 已填出发日期范围；返程仍按停留晚数寻找，可能晚于假期结束。'}`;
  });
  function clearSelection(event) {
    if(event && root.contains(event.target)) return;
    selected=undefined;
    if(trigger) trigger.textContent=defaultLabel;
    root.querySelectorAll('[data-holiday]').forEach(b=>b.setAttribute('aria-pressed','false'));
    const message=root.querySelector('.holiday-selection');
    if(message && calendar) message.textContent=calendar.years.find(r=>r.year===year)?.note || '日期已调整，可重新选择假期。';
  }
  ['start','end','mode'].forEach(name=>form.elements[name]?.addEventListener('input',clearSelection));
  form.addEventListener('click',event=>{ if(event.target.closest('[data-deal-range]')) clearSelection(event); });
  return {async reset(active) {
    alive=active;selected=undefined;const current=++version;root.replaceChildren();
    if(trigger) trigger.textContent=defaultLabel;
    if(!active) return;
    root.textContent='正在加载假期…';
    try { calendarRequest ||= request('/holidays.json').catch(error=>{calendarRequest=undefined;throw error;});
      const data=await calendarRequest;
      if(current!==version) return;
      calendar=data;year=yearFor(calendar,today());render();
    } catch(error) { if(current===version) root.textContent='暂时无法加载假期，请先手动选择日期。'; }
  }, clear:clearSelection};
}
