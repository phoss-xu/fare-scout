import {tr} from './i18n.js';
import {selectedNights} from './nights.js';
import {selectedWeekends} from './travel-dates.js';

export function captureSearch(form, origin, destinations) {
  if (!origin.values().length) throw new Error(tr('请选择出发地。','Choose a departure location.'));
  const to=form.elements.anywhere.checked ? [] : destinations.values();
  if (!form.elements.anywhere.checked && !to.length) throw new Error(tr('请选择目的地，或勾选不限目的地。','Choose a destination or select Anywhere.'));
  const data={...Object.fromEntries(new FormData(form)),nights:selectedNights(form),origins:origin.values(),destinations:to,
    weekdays:[...form.querySelectorAll('[name=weekday]:checked')].map(e=>Number(e.value))};
  if(data.date_mode==='weekends') {
    data.date_pairs=selectedWeekends(form);
    if(!data.date_pairs.length) throw new Error(tr('请至少选择一个周末。','Select at least one weekend.'));
    data.date_mode='fixed';data.start=data.date_pairs[0].start;data.end=data.date_pairs.at(-1).end;
  } else delete data.date_pairs;
  return data;
}

export async function restoreSearch(form, origin, destinations, config, isCurrent=()=>true) {
  await Promise.all([origin.setValues(config.origins),destinations.setValues(config.destinations)]);
  if(!isCurrent()) return;
  for(const name of ['start','end','adults','budget','max_stops','max_duration_hours']) form.elements[name].value=config[name];
  form.elements.date_mode.value=config.date_pairs?'weekends':config.date_mode;
  form.elements.date_pairs.value=JSON.stringify(config.date_pairs || []);
  form.elements.anywhere.checked=!config.destinations.length;
  for(const [name,values] of [['night',config.nights],['weekday',config.weekdays]]) {
    form.querySelectorAll(`[name=${name}]`).forEach(box=>box.checked=values.includes(Number(box.value)));
  }
  form.dispatchEvent(new Event('change',{bubbles:true}));
}
