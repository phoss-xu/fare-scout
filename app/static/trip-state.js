import {icon} from './ui-icons.js';
import {tr} from './i18n.js';
import {escape,time} from './format.js';
import {tripIdentity,watchForTrip} from './trip-snapshot.js';
const records=new Map(),refs=new Map();let sequence=0;
export let savedTrips=[],tripWatches=[],tripAccount=null;
export {icons,icon} from './ui-icons.js';
export function registerTrip(offer,context={}) {
  const snapshot={offer,adults:context.adults || 1,currency:offer.currency || context.currency || 'HKD',cabin:'M',checked_at:context.checked_at ?? null,
    filters:{max_stops:context.max_stops ?? context.filters?.max_stops ?? -1,max_duration_hours:context.max_duration_hours || context.filters?.max_duration_hours || 0}};
  const key=tripIdentity(snapshot),signature=JSON.stringify(snapshot);let ref=refs.get(signature);
  if(!ref){ref=String(++sequence);refs.set(signature,ref);}
  records.set(ref,{key,snapshot});return ref;
}
export const tripRecord=ref=>records.get(ref);
export const isSaved=key=>savedTrips.some(t=>t.key===key);
export const tripWatch=s=>watchForTrip(s,tripWatches);
export const expired=s=>s.offer.outbound.departureTime.slice(0,10)<new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export function watchLabel(s) {
  const w=tripWatch(s);
  return expired(s)?tr('日期已过','Trip expired'):!w?tr('降价提醒','Price alerts'):w.last_status==='expired'?tr('已过期','Expired'):!w.auto_enabled?tr('监控已暂停','Checks paused'):!w.alerts_enabled?tr('提醒已关闭','Alerts off'):tr('已监控','Watching');
}
export function tripTools(ref) {
  const record=tripRecord(ref),saved=isSaved(record.key);
  return `<div class="trip-tools"><button type="button" class="trip-tool trip-save" data-trip-save="${ref}" aria-pressed="${saved}" aria-label="${saved?tr('取消收藏','Remove saved trip'):tr('收藏行程','Save trip')}" title="${saved?tr('取消收藏','Remove saved trip'):tr('收藏行程','Save trip')}">${icon('heart')}</button><button type="button" class="trip-tool" data-trip-share="${ref}" aria-label="${tr('分享行程','Share trip')}" title="${tr('分享行程','Share trip')}">${icon('share')}</button></div>`;
}
export function tripAlert(ref) {
  const s=tripRecord(ref).snapshot;
  return `<button type="button" class="trip-alert ${tripWatch(s)?'is-watching':''}" data-trip-alert="${ref}" ${expired(s)?'disabled':''}>${icon('bell')}<span>${watchLabel(s)}</span></button>`;
}
export function tripNote(ref) {
  const s=tripRecord(ref).snapshot,w=tripWatch(s);
  const quote=s.checked_at?tr('报价查询于 ','Quote checked ')+time(s.checked_at):tr('报价查询时间暂缺','Quote time unavailable');
  const watch=w?.last_status==='error'?tr('最近查询失败，将重试','Last check failed; will retry'):w?.running?tr('正在查价','Checking prices'):w?.last_finished?tr('监控最近查询 ','Watch last checked ')+time(w.last_finished):'';
  return `<p class="trip-state-note" data-trip-note="${ref}">${escape(quote)}${watch?' · '+escape(watch):''}</p>`;
}
export function updateSaved(trips){savedTrips=trips;document.dispatchEvent(new Event('tripschange'));}
export function updateTripState(state){tripWatches=state?.watches || [];tripAccount=state;document.dispatchEvent(new Event('tripschange'));}
export function resetTrips(){savedTrips=[];tripWatches=[];tripAccount=null;records.clear();refs.clear();document.dispatchEvent(new Event('tripschange'));}
export function syncTripButtons() {
  document.querySelectorAll('[data-trip-save]').forEach(b=>{const r=tripRecord(b.dataset.tripSave);if(!r)return;const saved=isSaved(r.key);b.setAttribute('aria-pressed',String(saved));b.title=b.ariaLabel=saved?tr('取消收藏','Remove saved trip'):tr('收藏行程','Save trip');});
  document.querySelectorAll('[data-trip-alert]').forEach(b=>{const r=tripRecord(b.dataset.tripAlert);if(!r)return;b.querySelector('span').textContent=watchLabel(r.snapshot);b.disabled=expired(r.snapshot);b.classList.toggle('is-watching',!!tripWatch(r.snapshot));});
  document.querySelectorAll('[data-trip-note]').forEach(p=>{if(tripRecord(p.dataset.tripNote))p.outerHTML=tripNote(p.dataset.tripNote);});
}
