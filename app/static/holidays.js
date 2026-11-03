import {tr} from './i18n.js';
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
  if (!range) throw new Error(tr("该假期已结束","This holiday has ended"));
  if (kind === 'deals' && form.elements.date_mode) { form.elements.date_mode.value='range'; form.elements.date_mode.dispatchEvent(new Event('change',{bubbles:true})); }
  if (kind === 'watch') { form.elements.mode.value='fixed'; form.elements.mode.dispatchEvent(new Event('change')); }
  form.elements.start.value=range.start; form.elements.end.value=range.end;
  for (const name of ['start','end']) form.elements[name].dispatchEvent(new Event('change',{bubbles:true}));
  return range;
}
export function setupHolidays(root, form, kind) {
  let calendar, year, selected, version=0, alive=false;
  const trigger=root.closest('details')?.querySelector('[data-holiday-label]');
  const defaultLabel=()=>kind==='watch'?tr("按国内假期选择日期","Choose mainland China holiday dates"):tr("国内假期","Mainland China holidays");
  const today=() => chinaToday();
  document.addEventListener('languagechange',()=>{render();if(trigger && !selected) trigger.textContent=defaultLabel();});
  function render() {
    if (!calendar || !alive) return;
    const row=calendar.years.find(r => r.year === year);
    if (!row) return;
    const reference=row.status !== 'official';
    root.innerHTML=`${tr("<div class=\"holiday-heading\"><strong>国内假期</strong><select aria-label=\"","<div class=\"holiday-heading\"><strong>Mainland China holidays</strong><select aria-label=\"")}${kind === 'watch' ? tr("监控","Watch") : tr("特价搜索","Flight search")}${tr("假期年份\">","Holiday year\">")}${calendar.years.map(r=>`<option value="${r.year}" ${r.year===year?'selected':''}>${r.year}${tr(" 年 · "," · ")}${r.status === 'official' ? tr("已公布","Official dates") : tr("参考日期","Reference dates")}</option>`).join('')}</select></div><p class="holiday-year-note">${reference ? tr("出行参考 · 调休待公布","Reference dates · Make-up workdays unconfirmed") : tr("中国内地 · 正式放假安排","Mainland China · Official holiday dates")}</p><div class="holiday-options">${row.holidays.map(h=>`<button type="button" data-holiday="${h.id}" aria-pressed="${selected===h.id}" ${holidayRange(h,today())?'':'disabled'}><span>${escape(h.name)}</span><small>${h.start.slice(5).replace('-','/')}–${h.end.slice(5).replace('-','/')}${h.end<today()?tr(" · 已结束"," · Ended"):''}</small></button>`).join('')}</div><p class="holiday-selection" role="status">${reference ? escape(row.note) : ''}</p><a class="holiday-source" href="${escape(row.source)}" target="_blank" rel="noopener noreferrer">${reference ? tr("参考依据","Reference source") : '查看官方安排'} ↗</a>`;
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
    if(trigger) trigger.textContent=`${row.year} ${holiday.name}${row.status==='official'?'':tr(" · 调休待公布"," · Make-up workdays unconfirmed")}`;
    const workdays=holiday.workdays.length ? `${tr(" 补班："," Make-up workdays: ")}${holiday.workdays.map(d=>d.slice(5)).join('、')}。` : '';
    root.querySelector('.holiday-selection').textContent=`${row.year}${tr(" 年"," ")}${holiday.name}：${range.start}${tr(" 至 "," to ")}${range.end}${holiday.start<today()?tr("（从今天起）","(from today)"):''}。${row.status==='official'?workdays:tr(" 出行参考，正式放假与调休待公布。"," travel reference; official holidays and make-up workdays unconfirmed.")}${kind==='watch'?tr(" 首日出发 · 末日返程起飞"," Depart on the first day · Return departure on the last day"):tr(" 返程按停留晚数，可能超出假期。"," Return follows the selected nights and may fall outside the holiday.")}`;
  });
  function clearSelection(event) {
    if(event && root.contains(event.target)) return;
    selected=undefined;
    if(trigger) trigger.textContent=defaultLabel();
    root.querySelectorAll('[data-holiday]').forEach(b=>b.setAttribute('aria-pressed','false'));
    const message=root.querySelector('.holiday-selection');
    if(message && calendar) message.textContent=calendar.years.find(r=>r.year===year)?.note || tr("日期已调整","Dates adjusted");
  }
  ['start','end','mode'].forEach(name=>form.elements[name]?.addEventListener('input',clearSelection));
  form.addEventListener('click',event=>{ if(event.target.closest('[data-deal-range]')) clearSelection(event); });
  return {async reset(active) {
    alive=active;selected=undefined;const current=++version;root.replaceChildren();
    if(trigger) trigger.textContent=defaultLabel();
    if(!active) return;
    root.textContent=tr("正在加载假期…","Loading holidays…");
    try { calendarRequest ||= request('/holidays.json').catch(error=>{calendarRequest=undefined;throw error;});
      const data=await calendarRequest;
      if(current!==version) return;
      calendar=data;year=yearFor(calendar,today());render();
    } catch(error) { if(current===version) root.textContent=tr("暂时无法加载假期，请先手动选择日期。","Holidays are unavailable. Choose dates manually."); }
  }, clear:clearSelection};
}
