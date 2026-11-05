import {calendarMonth,monthOffset} from './date-range-calendar.js';
import {chinaToday} from './holidays.js';
import {escape,flightDate} from './format.js';
import {tr} from './i18n.js';

const pairs={start:['start','end'],end:['start','end'],outbound_start_date:['outbound_start_date','outbound_end_date'],outbound_end_date:['outbound_start_date','outbound_end_date'],inbound_start_date:['inbound_start_date','inbound_end_date'],inbound_end_date:['inbound_start_date','inbound_end_date']};
export function datePairFields(input) {
  const names=pairs[input.name],form=input.form;
  if(!names || !form)return [input];
  const fields=names.map(name=>form.elements[name]);
  return fields.every(el=>el && !el.disabled && !el.closest('[hidden]'))?fields:[input];
}
const labelFor=input=>input.getAttribute('aria-label') || input.closest('label')?.querySelector(':scope > span')?.textContent || [...(input.closest('label')?.childNodes || [])].filter(n=>n.nodeType===3).map(n=>n.textContent.trim()).join('') || tr('日期','Date');
export function setupDateInputs(doc=document) {
  const controls=new WeakMap();let active,panel,month,fields,edge=0;
  function close(focus=true) {
    const previous=active;if(panel?.matches(':popover-open'))panel.hidePopover();panel?.remove();panel=undefined;active=undefined;
    if(previous){previous.dispatchEvent(new Event('date-picker-close',{bubbles:true}));controls.get(previous)?.setAttribute('aria-expanded','false');if(focus && previous.isConnected)controls.get(previous)?.focus({preventScroll:true});}
  }
  function sync() {
    if(active && !active.isConnected)close(false);
    doc.querySelectorAll('input[type=date]').forEach(input=>{
      if(input.closest('.calendar-native-fields'))return;
      let button=controls.get(input);
      if(!button){
        button=doc.createElement('button');button.type='button';button.className='themed-date-trigger';button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-expanded','false');
        button.innerHTML='<span data-date-value></span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 10h18"/></svg>';
        input.classList.add('themed-date-native');input.setAttribute('aria-hidden','true');input.tabIndex=-1;input.after(button);controls.set(input,button);
        button.addEventListener('click',()=>open(input));
      }
      const text=input.value?flightDate(input.value,true):tr('选择日期','Choose date'),value=button.querySelector('[data-date-value]');
      if(value.textContent!==text)value.textContent=text;
      const label=labelFor(input)+' '+text;if(button.getAttribute('aria-label')!==label)button.setAttribute('aria-label',label);
      if(button.disabled!==input.disabled)button.disabled=input.disabled;
    });
  }
  function render(focusDay) {
    const today=chinaToday(),start=fields[0].value,end=fields.length===2?fields[1].value:start;
    const min=edge===1?[fields[0].value,fields[1].min || today].sort().at(-1):fields[0].min || today,max=fields.at(-1).max;
    const current=fields[edge];
    panel.innerHTML=`<div class="range-editor-heading"><span>${tr('日期','Dates')}</span><button type="button" data-date-close aria-label="${tr('关闭日期选择','Close date selection')}">×</button></div><div class="range-selection" role="group" aria-label="${tr('出行日期','Travel dates')}">${fields.map((input,index)=>`<button type="button" data-date-edge="${index}" aria-pressed="${edge===index}"><small>${escape(labelFor(input))}</small><strong>${escape(input.value?flightDate(input.value,true):tr('选择日期','Choose date'))}</strong></button>`).join('')}</div><div class="range-months"><nav class="range-navigation" aria-label="${tr('切换月份','Change month')}"><button type="button" data-date-page="-1" aria-label="${tr('上个月','Previous month')}"${month<=min.slice(0,7)?' disabled':''}>‹</button><button type="button" data-date-page="1" aria-label="${tr('下个月','Next month')}"${max && month>=max.slice(0,7)?' disabled':''}>›</button></nav>${calendarMonth(month,start,end,today,{min,max})}${calendarMonth(monthOffset(month,1),start,end,today,{min,max})}</div>`;
    panel.setAttribute('aria-label',labelFor(current));
    if(focusDay)panel.querySelector(`[data-calendar-day="${focusDay}"]`)?.focus({preventScroll:true});
  }
  function open(input) {
    close(false);sync();active=input;fields=datePairFields(input);edge=Math.max(0,fields.indexOf(input));month=(input.value || input.min || chinaToday()).slice(0,7);
    panel=doc.createElement('div');panel.className='date-input-calendar';panel.setAttribute('popover','manual');panel.setAttribute('role','dialog');
    // Keep nested calendars within the active modal/disclosure for focus and dismissal.
    (input.closest('dialog[open],.date-editor') || doc.body).append(panel);
    panel.addEventListener('click',event=>{
      if(event.target.closest('[data-date-close]')){close();return;}
      const page=event.target.closest('[data-date-page]'),edgeButton=event.target.closest('[data-date-edge]'),dayButton=event.target.closest('[data-calendar-day]');
      if(page){month=monthOffset(month,Number(page.dataset.datePage));render();panel.querySelector(`[data-date-page="${page.dataset.datePage}"]`)?.focus({preventScroll:true});}
      if(edgeButton){edge=Number(edgeButton.dataset.dateEdge);month=(fields[edge].value || fields[edge].min || chinaToday()).slice(0,7);render();panel.querySelector(`[data-date-edge="${edge}"]`)?.focus({preventScroll:true});}
      if(dayButton){
        const day=dayButton.dataset.calendarDay,chosen=fields[edge];
        chosen.value=day;
        if(fields.length===2 && edge===0 && fields[1].value<day)fields[1].value=day;
        chosen.dispatchEvent(new Event('input',{bubbles:true}));chosen.dispatchEvent(new Event('change',{bubbles:true}));sync();
        if(fields.length===1 || edge===1){close();return;}
        edge=1;render(day);
      }
    });
    panel.addEventListener('keydown',event=>{
      if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();return;}
      const button=event.target.closest('[data-calendar-day]'),offset={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7}[event.key];if(!button || !offset)return;
      event.preventDefault();const date=new Date(button.dataset.calendarDay+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+offset);const day=date.toISOString().slice(0,10),min=fields[edge].min || chinaToday(),max=fields[edge].max;
      if(day<min || (max && day>max))return;month=day.slice(0,7);render(day);
    });
    render();panel.showPopover();controls.get(input)?.setAttribute('aria-expanded','true');
    const selected=panel.querySelector(`[data-calendar-day="${input.value || input.min || chinaToday()}"]:not(:disabled)`);(selected || panel.querySelector('[data-date-close]'))?.focus({preventScroll:true});
  }
  doc.addEventListener('pointerdown',event=>{if(panel && !event.composedPath().includes(panel) && !event.composedPath().includes(controls.get(active)))close(false);},true);
  doc.addEventListener('invalid',event=>{if(event.target.matches('input.themed-date-native')){event.preventDefault();open(event.target);}},true);
  doc.addEventListener('change',()=>sync());doc.addEventListener('input',()=>sync());doc.addEventListener('reset',()=>queueMicrotask(sync),true);
  doc.addEventListener('languagechange',()=>{sync();if(panel)render();});
  new MutationObserver(sync).observe(doc.body,{childList:true,subtree:true,attributes:true,attributeFilter:['open','disabled','min','max','hidden']});
  sync();
}
