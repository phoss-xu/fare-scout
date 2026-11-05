import {tr} from './i18n.js';

const field=(form,name)=>form.elements[name];
export function captureWindows(form,validate=true) {
  const result={};
  for(const leg of form.elements.trip_type.value==='oneway'?['outbound']:['outbound','inbound']) {
    const timed=field(form,`${leg}_timed`).checked;
    result[leg]={start:field(form,`${leg}_start_date`).value+'T'+(timed?field(form,`${leg}_start_time`).value:'00:00'),
      end:field(form,`${leg}_end_date`).value+'T'+(timed?field(form,`${leg}_end_time`).value:'23:59')};
    if(leg==='inbound') result[leg].basis=field(form,'return_basis').value;
    if(validate && result[leg].end<result[leg].start) throw new Error(tr('最晚时间不能早于最早时间，跨午夜请调整结束日期。','The latest time must follow the earliest time. For overnight windows, change the end date.'));
  }
  return result;
}
export function restoreWindows(form,windows) {
  for(const leg of ['outbound','inbound']) {
    const window=windows?.[leg];
    for(const edge of ['start','end']) {
      field(form,`${leg}_${edge}_date`).value=window?.[edge].slice(0,10) || '';
      field(form,`${leg}_${edge}_time`).value=window?.[edge].slice(11,16) || (edge==='start'?'00:00':'23:59');
    }
    field(form,`${leg}_timed`).checked=!!window && (window.start.slice(11)!=='00:00' || window.end.slice(11)!=='23:59');
  }
  field(form,'return_basis').value=windows?.inbound?.basis || 'departure';
}
export function windowDescription(windows) {
  const range=w=>`${w.start.replace('T',' ')} ～ ${w.end.replace('T',' ')}`;
  return [tr('去程起飞 ','Outbound departure ')+range(windows.outbound),windows.inbound?
    (windows.inbound.basis==='arrival'?tr('返程抵达 ','Return arrival '):tr('返程起飞 ','Return departure '))+range(windows.inbound):''].filter(Boolean).join(' · ');
}
export function setupTimeWindows(form) {
  const root=form.querySelector('.time-window-editor');
  root.innerHTML=['outbound','inbound'].map(leg=>`<fieldset class="flight-window" data-window="${leg}">
    <legend><span data-window-title></span></legend>
    ${leg==='inbound'?'<label class="return-basis"><span data-return-label></span><select name="return_basis"><option value="departure"></option><option value="arrival"></option></select></label>':''}
    <label class="window-toggle"><input type="checkbox" name="${leg}_timed"><span data-timed-label></span></label>
    <div class="window-edges">${['start','end'].map(edge=>`<div class="window-edge"><label><span data-edge-label="${edge}"></span><input type="date" name="${leg}_${edge}_date" required></label><label class="window-clock"><span data-clock-label="${edge}"></span><input type="time" name="${leg}_${edge}_time" value="${edge==='start'?'00:00':'23:59'}" step="60" required></label></div>`).join('')}</div>
    <p class="form-hint" data-local-hint></p>
  </fieldset>`).join('');
  function sync() {
    const active=form.elements.date_mode.value==='windows',oneWay=form.elements.trip_type.value==='oneway';
    root.hidden=!active;
    for(const leg of ['outbound','inbound']) {
      const section=root.querySelector(`[data-window=${leg}]`),enabled=active && !(leg==='inbound' && oneWay);
      section.hidden=leg==='inbound' && oneWay;
      section.querySelectorAll('input,select').forEach(input=>input.disabled=!enabled);
      const timed=field(form,`${leg}_timed`).checked;
      section.querySelectorAll('.window-clock').forEach(label=>{label.hidden=!timed;label.querySelector('input').disabled=!enabled || !timed;});
      if(enabled) for(const edge of ['start','end']) {
        const input=field(form,`${leg}_${edge}_date`);
        input.min=form.elements.start.min;
        if(!input.value) input.value=leg==='outbound'?form.elements.start.value:form.elements.end.value;
        input.setCustomValidity('');
      }
      if(enabled) {
        const first=field(form,`${leg}_start_date`).value+(timed?'T'+field(form,`${leg}_start_time`).value:'T00:00');
        const last=field(form,`${leg}_end_date`).value+(timed?'T'+field(form,`${leg}_end_time`).value:'T23:59');
        field(form,`${leg}_end_date`).setCustomValidity(last<first?tr('最晚时间不能早于最早时间，跨午夜请调整结束日期。','For an overnight window, change the end date.'): '');
      }
      section.querySelector('[data-window-title]').textContent=leg==='outbound'?tr('去程起飞','Outbound departure'):tr('返程','Return');
      section.querySelector('[data-timed-label]').textContent=tr('限制时刻','Set times');
      section.querySelectorAll('[data-edge-label]').forEach(el=>el.textContent=el.dataset.edgeLabel==='start'?tr('最早日期','Earliest date'):tr('最晚日期','Latest date'));
      section.querySelectorAll('[data-clock-label]').forEach(el=>el.textContent=el.dataset.clockLabel==='start'?tr('最早时刻','Earliest time'):tr('最晚时刻','Latest time'));
      section.querySelector('[data-local-hint]').textContent=leg==='outbound'?tr('出发机场当地时间 · 可跨日期','Departure airport local time · May span dates'):
        field(form,'return_basis').value==='arrival'?tr('返回机场当地时间 · 按抵达筛选','Arrival airport local time · Filter by arrival'):tr('返程出发机场当地时间 · 按起飞筛选','Return departure airport local time · Filter by departure');
    }
    root.querySelector('[data-return-label]').textContent=tr('按什么时间筛选','Filter return by');
    field(form,'return_basis').options[0].textContent=tr('起飞时间','Departure time');
    field(form,'return_basis').options[1].textContent=tr('抵达时间','Arrival time');
  }
  return {sync};
}
