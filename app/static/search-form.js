import {getPreferences,setPreferences} from './preferences.js';
import {tr} from './i18n.js';
import {selectedNights} from './nights.js';
import {captureWindows,restoreWindows} from './time-windows.js';
import {selectedWeekends} from './travel-dates.js';

export function captureSearch(form, origin, destinations, excludedDestinations={values:()=>[]}) {
  if (!origin.values().length) throw new Error(tr('请选择出发地。','Choose a departure location.'));
  const to=form.elements.anywhere.checked ? [] : destinations.values();
  if (!form.elements.anywhere.checked && !to.length) throw new Error(tr('请选择目的地，或勾选不限目的地。','Choose a destination or select Anywhere.'));
  const data={...Object.fromEntries(new FormData(form)),currency:getPreferences().currency,locale:getPreferences().language,nights:selectedNights(form),origins:origin.values(),destinations:to,excluded_destinations:excludedDestinations.values(),
    weekdays:[...form.querySelectorAll('[name=weekday]:checked')].map(e=>Number(e.value))};
  if(data.trip_type==='oneway' && data.date_mode==='fixed') data.end=data.start;
  if(data.trip_type==='oneway') data.nights=[];
  if(data.date_mode==='weekends') {
    data.date_pairs=selectedWeekends(form);
    if(!data.date_pairs.length) throw new Error(tr('请至少选择一个周末。','Select at least one weekend.'));
    data.date_mode='fixed';data.start=data.date_pairs[0].start;data.end=data.date_pairs.at(-1).end;
  } else delete data.date_pairs;
  if(data.date_mode==='windows') {
    data.time_windows=captureWindows(form);
    data.start=data.time_windows.outbound.start.slice(0,10);
    data.end=(data.time_windows.inbound || data.time_windows.outbound).end.slice(0,10);
    data.nights=[];data.weekdays=[];
  }
  for(const key of Object.keys(data)) if(/^(outbound|inbound)_/.test(key) || key==='return_basis') delete data[key];
  return data;
}

export async function restoreSearch(form, origin, destinations, config, isCurrent=()=>true, excludedDestinations={setValues:async()=>{}}) {
  await Promise.all([origin.setValues(config.origins),destinations.setValues(config.destinations),excludedDestinations.setValues(config.excluded_destinations || [])]);
  if(!isCurrent()) return;
  setPreferences({currency:config.currency || 'HKD'});
  for(const name of ['start','end','adults','budget','max_stops','max_duration_hours']) form.elements[name].value=config[name];
  if(form.elements.trip_type) form.elements.trip_type.value=config.trip_type || 'roundtrip';
  form.elements.date_mode.value=config.date_pairs?'weekends':config.date_mode;
  form.elements.date_pairs.value=JSON.stringify(config.date_pairs || []);
  restoreWindows(form,config.time_windows);
  form.elements.anywhere.checked=!config.destinations.length;
  for(const [name,values] of [['night',config.nights],['weekday',config.weekdays]]) {
    form.querySelectorAll(`[name=${name}]`).forEach(box=>box.checked=(values || []).includes(Number(box.value)));
  }
  form.dispatchEvent(new Event('change',{bubbles:true}));
}
