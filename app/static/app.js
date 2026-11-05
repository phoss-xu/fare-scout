import {setupDateInputs} from './date-input-picker.js';
import {loadDestinationPhotos} from './route-card-views.js';
import {setupTripActions} from './trip-actions.js';
import {updateTripState} from './trip-state.js';
import {visibilityPoll} from './polling.js';
import {historyPanel} from './history-panel.js';
import {tr,setupLanguage} from './i18n.js';
import {getPreferences,subscribePreferences} from './preferences.js';
import {subscribeCurrency} from './currency.js';
import {setupSettings,renderSettings} from './settings.js';
import {request} from './api.js';
import {latest, watchCards, offerCards, removedItems} from './views.js';
import {renderAutomation, setupAutomation} from './automation.js';
import {setupAuth, showSession} from './auth.js';
import {setupLocations} from './locations.js';
import {resetHistory} from './location_history.js';
import {setupDeals} from './deals.js';
import {setupHolidays} from './holidays.js';
import {setupWorkspace} from './ui.js';
import {setupDaily} from './daily.js';
import {setupAppearance} from './appearance.js';
const $ = selector => document.querySelector(selector);
let state, refreshing = false, currentUser, generation = 0;
let lastSnapshot,refreshFailed=false;
let formInitialized = false;
let toastTimer;
function toast(message) {
  $('#toast').textContent = message;
  $('#toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('#toast').hidden = true, 4500);
}
async function refresh() {
  if (refreshing || !currentUser) return;
  const requestGeneration = generation;
  refreshing = true;
  try {
    const result = await request('/api/state');
    if (requestGeneration !== generation) return;
    if (result.user.id !== currentUser.id) {
      showSession(await request('/api/auth/session'));
      return;
    }
    state = result;refreshFailed=false;
    updateTripState(state);
    renderSettings(state);
    $('#page-error').hidden = true;
    $('#summary').textContent = `${state.watches.length}${tr(" 份出行计划 · "," travel watches · ")}${state.watches.filter(w => w.running).length}${tr(" 份查询中"," checking prices")}`;
    const snapshot = JSON.stringify(state);
    if (snapshot === lastSnapshot) return;
    lastSnapshot = snapshot;
    $('#watches').innerHTML = watchCards(state)+removedItems(state,'watches');
    $('#offers').innerHTML = offerCards(state)+removedItems(state,'offers');
    renderAutomation(state);
    daily.render(state);
    $('#watch-count').textContent = state.watches.length;
    $('#offer-count').textContent = latest(state.observations).filter(o => o.status === 'ok' && !o.dismissed_at).length;
    sampleHistory.render();
    if (!formInitialized) {
      formInitialized = true;
      const start = new Date(`${state.today}T12:00:00`);
      start.setDate(start.getDate() + ((6 - start.getDay() + 7) % 7));
      const fmt = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      form.elements.start.value = fmt(start);
      start.setDate(start.getDate() + 2);
      form.elements.end.value = fmt(start);
      form.elements.start.min = form.elements.end.min = state.today;
    }
  } catch (error) {
    refreshFailed=true;
    if (requestGeneration !== generation) return;
    if (error.status === 401) { showSession(null); return; }
    $('#page-error').textContent = error.status
      ? tr('暂时无法读取行程数据，页面会自动重试。','Could not load your trip data. Retrying automatically.')
      : tr("暂时连接不上服务，页面会自动重试。","Cannot reach the service. Retrying automatically.");
    $('#page-error').hidden = false;
    $('#summary').textContent = error.status
      ? tr('数据暂时无法读取','Trip data unavailable')
      : tr("连接中断","Connection lost");
  } finally { refreshing = false; }
}
loadDestinationPhotos().then(()=>{
  if(!state)return;
  $('#watches').innerHTML=watchCards(state)+removedItems(state,'watches');
  $('#offers').innerHTML=offerCards(state)+removedItems(state,'offers');
});
setupLanguage();
setupWorkspace();
setupAppearance();
setupSettings();
const tripActions=setupTripActions(refresh,toast);
const daily=setupDaily(refresh,toast,openWatch,c=>discovery.applyPreferences(c));
const sampleHistory=historyPanel($('#history'),$('#history-dialog'),()=>state);
const form = $('#watch-form');
const placeControls = setupLocations(form);
const holidays = setupHolidays($('#watch-holidays'), form, 'watch');
async function openWatch(data) {
  form.reset();
  holidays.clear();
  await placeControls.fill(data.origin, data.destinations);
  for (const [key,value] of Object.entries(data)) if (form.elements[key] && !['origin','destinations'].includes(key)) form.elements[key].value = value;
  form.elements.auto_enabled.checked = false;
  form.elements.mode.dispatchEvent(new Event('change'));
  $('#create-dialog').showModal();
}
const discovery = setupDeals(openWatch);
setupDateInputs();
$('#new-watch').addEventListener('click', () => $('#create-dialog').showModal());
document.addEventListener('click', async event => {
  const moreRemoved=event.target.closest('[data-removed-more]');
  if(moreRemoved && state?.removed_next_before) {
    const owner=currentUser.id;moreRemoved.disabled=true;
    try {
      const page=await request('/api/removed-offers?before='+state.removed_next_before);
      if(currentUser?.id!==owner) return;
      state.removed_offers.push(...page.offers);state.removed_next_before=page.next_before;
      $('#offers').innerHTML=offerCards(state)+removedItems(state,'offers');
      $('#offers .removed-items').open=true;
    } catch(error) {toast(error.message);moreRemoved.disabled=false;}
    return;
  }
  const removal=event.target.closest('[data-remove-kind],[data-restore-kind]');
  if(removal) {
    removal.disabled=true;
    try {
      const restoring=Boolean(removal.dataset.restoreKind),kind=removal.dataset.restoreKind || removal.dataset.removeKind;
      await request(`/api/${kind}/${removal.dataset.removeId}/${restoring?'restore':'delete'}`,{});
      toast(restoring?(kind==='watches'?tr("监控已恢复，自动查价保持暂停。","Watch restored. Automatic checks remain paused."):tr("机票机会已恢复。","Flight opportunity restored.")):tr("已删除，可在「最近删除」恢复","Removed. Restore from Recently removed."));
      await refresh();
    } catch(error) {toast(error.message);removal.disabled=false;}
    return;
  }
  const close = event.target.closest('[data-close]');
  if (close) $(`#${close.dataset.close}`).close();
  const history = event.target.closest('[data-history]');
  if (history && state) {
    sampleHistory.open(Number(history.dataset.history));
  }
  const check = event.target.closest('[data-check]');
  if (check) {
    check.disabled = true;
    try { await request(`/api/watches/${check.dataset.check}/check`, {}); toast(tr("已加入查价队列","Added to price-check queue")); await refresh(); }
    catch (error) { toast(error.message); check.disabled = false; }
  }
});
form.elements.mode.addEventListener('change', () => {
  const weekend = form.elements.mode.value === 'weekend';
  $('#end-field').hidden = weekend;
  form.elements.end.required = !weekend;
  $('#weeks-field').hidden = !weekend;
  $('#start-label').textContent = weekend ? tr("起始日期","Start date") : tr("出发日期","Departure date");
});
form.addEventListener('submit', async event => {
  event.preventDefault();
  const button = form.querySelector('[type=submit]');
  button.disabled = true;
  $('#form-error').textContent = '';
  const data = {...Object.fromEntries(new FormData(form)),currency:getPreferences().currency};
  data.auto_enabled = form.elements.auto_enabled.checked;
  data.alerts_enabled = form.elements.alerts_enabled.checked;
  if (data.mode === 'weekend') data.end = data.start;
  try {
    Object.assign(data, placeControls.values());
    await request('/api/watches', data);
    $('#create-dialog').close();
    toast(data.auto_enabled ? tr("监控已保存，开始查价","Watch saved; checking prices") : tr("监控已保存","Watch saved"));
    await refresh();
  } catch (error) { $('#form-error').textContent = error.message; }
  finally { button.disabled = false; }
});
setupAutomation(() => state, refresh, toast);
const statePoller=visibilityPoll(refresh,{delay:()=>refreshFailed?60000:state?.watches.some(w=>w.running)?4000:30000});
await setupAuth(user => {
  generation += 1;
  currentUser = user;
  tripActions.reset(user);
  resetHistory(user);
  state = null;
  renderSettings(null);
  daily.reset();
  lastSnapshot = undefined;
  sampleHistory.reset();
  ['watches','offers','alerts','history'].forEach(id => $(`#${id}`).replaceChildren());
  ['watch-count','offer-count','alert-count'].forEach(id => $(`#${id}`).textContent = '0');
  $('#summary').textContent = tr("正在加载…","Loading…");
  $('#email-status').textContent = '';
  ['form-error','settings-error','email-error','account-error'].forEach(id => $(`#${id}`).textContent = '');
  form.reset();
  formInitialized = false;
  placeControls.reset(Boolean(user));
  discovery.reset(Boolean(user));
  holidays.reset(Boolean(user));
  form.elements.mode.dispatchEvent(new Event('change'));
  $('#email-form').reset();
  delete $('#email-recipient').dataset.dirty;
  $('#page-error').hidden = true;
  statePoller.stop();
  if (user) statePoller.start();
});


function renderPreferences() {
  if(!state) return;
  $('#summary').textContent=tr(`${state.watches.length} 份出行计划 · ${state.watches.filter(w=>w.running).length} 份查询中`,`${state.watches.length} travel watches · ${state.watches.filter(w=>w.running).length} checking prices`);
  form.elements.mode.dispatchEvent(new Event('change'));
  $('#watches').innerHTML=watchCards(state)+removedItems(state,'watches');
  $('#offers').innerHTML=offerCards(state)+removedItems(state,'offers');
  renderAutomation(state);daily.render(state);
  sampleHistory.render();
}
subscribePreferences(renderPreferences);subscribeCurrency(renderPreferences);
