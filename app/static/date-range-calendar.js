import {chinaToday} from './holidays.js';
import {tr} from './i18n.js';
import {escape,flightDate} from './format.js';

export function monthOffset(month,offset) {
  const d=new Date(month+'-01T12:00:00Z');d.setUTCMonth(d.getUTCMonth()+offset);
  return d.toISOString().slice(0,7);
}
export function monthDays(month) {
  const first=new Date(month+'-01T12:00:00Z'),count=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0)).getUTCDate();
  return {offset:(first.getUTCDay()+6)%7,days:Array.from({length:count},(_,i)=>`${month}-${String(i+1).padStart(2,'0')}`)};
}
export function chooseDate(start,end,day,edge,single=false) {
  if(single || edge==='start' || !start || day<start)return {start:day,end:day,edge:single?'start':'end'};
  return {start,end:day,edge:'start'};
}
export function calendarMonth(month,start,end,today,{min=today,max=''}={}) {
  const {offset,days}=monthDays(month),date=new Date(month+'-01T12:00:00Z');
  const title=tr(`${date.getUTCFullYear()}年${date.getUTCMonth()+1}月`,new Intl.DateTimeFormat('en',{month:'long',year:'numeric',timeZone:'UTC'}).format(date));
  return `<section class="range-month" aria-label="${escape(title)}"><h4>${escape(title)}</h4><div class="range-weekdays" aria-hidden="true">${tr(['一','二','三','四','五','六','日'],['M','T','W','T','F','S','S']).map(d=>`<span>${d}</span>`).join('')}</div><div class="range-days">${'<span></span>'.repeat(offset)}${days.map(day=>{
    const endpoint=day===start || day===end,inside=start && end && day>start && day<end;
    return `<button type="button" data-calendar-day="${day}" class="${endpoint?'range-endpoint ':''}${inside?'range-between ':''}${day===start?'range-start ':''}${day===end?'range-end':''}" aria-label="${escape(flightDate(day))}" aria-pressed="${endpoint}"${day===today?' aria-current="date"':''}${day<min || (max && day>max)?' disabled':''}><span>${Number(day.slice(8))}</span></button>`;
  }).join('')}</div></section>`;
}
export function setupDateRangeCalendar(form) {
  const fields=form.querySelector('.date-fields'),root=document.createElement('div');
  root.className='date-range-calendar';fields.after(root);fields.classList.add('calendar-native-fields');
  const editor=fields.closest('.date-editor'),disclosure=form.querySelector('.journey-date');
  const heading=document.createElement('div');heading.className='range-editor-heading';
  heading.innerHTML=`<span>${tr('出行日期','Travel dates')}</span><button type="button" data-journey-done aria-label="${tr('关闭日期选择','Close date selection')}">×</button>`;editor.prepend(heading);
  function position() {
    const desktop=matchMedia('(min-width:761px)').matches;
    if(desktop){editor.setAttribute('popover','manual');if(disclosure.open && !editor.matches(':popover-open'))editor.showPopover();if(!disclosure.open && editor.matches(':popover-open'))editor.hidePopover();}
    else {if(editor.matches(':popover-open'))editor.hidePopover();editor.removeAttribute('popover');}
  }
  disclosure.addEventListener('toggle',position);window.addEventListener('resize',position);position();
  let month=(form.elements.start.value || chinaToday()).slice(0,7),edge='start',selecting=false;
  const single=()=>form.elements.trip_type.value==='oneway' && form.elements.date_mode.value==='fixed';
  function render(focusDay) {
    const mode=form.elements.date_mode.value;root.hidden=!['range','fixed'].includes(mode);
    const start=form.elements.start.value,end=single()?start:form.elements.end.value,today=chinaToday();
    const fixed=mode==='fixed',labels=fixed?[tr('出发','Departure'),tr('返程','Return')]:[tr('最早出发','Earliest departure'),tr('最晚出发','Latest departure')];
    root.innerHTML=`<div class="range-selection" role="group" aria-label="${tr('出行日期','Travel dates')}">${['start',...(single()?[]:['end'])].map((key,i)=>`<button type="button" data-calendar-edge="${key}" aria-pressed="${edge===key}"><small>${labels[i]}</small><strong>${escape((i?end:start)?flightDate(i?end:start,true):tr('选择日期','Choose date'))}</strong></button>`).join('')}</div><div class="range-months"><nav class="range-navigation" aria-label="${tr('切换月份','Change month')}"><button type="button" data-calendar-page="-1" aria-label="${tr('上个月','Previous month')}"${month<=today.slice(0,7)?' disabled':''}>‹</button><button type="button" data-calendar-page="1" aria-label="${tr('下个月','Next month')}">›</button></nav>${calendarMonth(month,start,end,today)}${calendarMonth(monthOffset(month,1),start,end,today)}</div>`;
    if(focusDay)root.querySelector(`[data-calendar-day="${focusDay}"]`)?.focus({preventScroll:true});
  }
  root.addEventListener('click',event=>{
    const page=event.target.closest('[data-calendar-page]'),edgeButton=event.target.closest('[data-calendar-edge]'),day=event.target.closest('[data-calendar-day]');
    if(page){month=monthOffset(month,Number(page.dataset.calendarPage));render();root.querySelector(`[data-calendar-page="${page.dataset.calendarPage}"]`)?.focus({preventScroll:true});}
    if(edgeButton){edge=edgeButton.dataset.calendarEdge;month=(form.elements[edge].value || form.elements.start.value || chinaToday()).slice(0,7);render();root.querySelector(`[data-calendar-edge="${edge}"]`)?.focus({preventScroll:true});}
    if(day){const next=chooseDate(form.elements.start.value,form.elements.end.value,day.dataset.calendarDay,edge,single());form.elements.start.value=next.start;form.elements.end.value=next.end;edge=next.edge;selecting=true;form.dispatchEvent(new Event('change',{bubbles:true}));selecting=false;render(day.dataset.calendarDay);}
  });
  root.addEventListener('keydown',event=>{
    const button=event.target.closest('[data-calendar-day]');if(!button)return;
    const shifts={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7};if(!(event.key in shifts))return;
    event.preventDefault();const date=new Date(button.dataset.calendarDay+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+shifts[event.key]);const day=date.toISOString().slice(0,10);if(day<chinaToday())return;
    if(day.slice(0,7)!==button.dataset.calendarDay.slice(0,7))month=day.slice(0,7);render(day);
  });
  form.addEventListener('change',event=>{if(!selecting && !root.contains(event.target)){month=(form.elements.start.value || chinaToday()).slice(0,7);edge='start';}render();});
  form.querySelector('.journey-date').addEventListener('toggle',()=>{month=(form.elements.start.value || chinaToday()).slice(0,7);edge='start';render();});
  document.addEventListener('languagechange',()=>render());
  render();
}
