import {renderCenter,setupCenter,selectCenter} from './account-center.js';
import {getPreferences,setPreferences,subscribePreferences} from './preferences.js';
import {getAppearance,setAppearance,subscribeAppearance} from './appearance-store.js';
import {ensureRates,exchangeState,subscribeCurrency,currencyLabel} from './currency.js';
import {tr} from './i18n.js';
const $=s=>document.querySelector(s);
export function openSettings(focus) {
  const dialog=$('#appearance-dialog');
  if(!dialog.open) $('#appearance-open').click();
  if(focus) {
    const target=$(focus);
    const pane=target.closest('[data-center-panel]');if(pane)selectCenter(pane.dataset.centerPanel);
    for(let parent=target.parentElement;parent && parent!==dialog;parent=parent.parentElement) {
      if(parent.tagName==='DETAILS') parent.open=true;
    }
    target.scrollIntoView({block:'center'});target.focus();
  }
}
export function renderSettings(state) {
  renderCenter(state);
  $('#settings-daily').hidden=!state?.daily;
}
export function setupSettings(refresh) {
  setupCenter(refresh);
  function render() {
    const p=getPreferences(),exchange=exchangeState();
    document.querySelectorAll('[name=settings_language]').forEach(input=>input.checked=input.value===p.language);
    $('#settings-currency').value=p.currency;
    $('#settings-landscape').value=getAppearance().landscape;
    $('#currency-status').textContent=tr(`新查询使用${currencyLabel(p.currency)}报价；已有报价保留原币，必要时参考换算。`,`New searches request ${p.currency}. Existing quotes keep their source currency and may use reference conversion.`);
    $('#currency-retry').hidden=exchange.status!=='error';
  }
  document.querySelectorAll('[name=settings_language]').forEach(input=>input.addEventListener('change',e=>setPreferences({language:e.target.value})));
  $('#settings-currency').addEventListener('change',e=>{const budget=document.querySelector('#deals-form [name=budget]');if(budget && e.target.value!==getPreferences().currency) budget.value='';setPreferences({currency:e.target.value});ensureRates();});
  $('#settings-landscape').addEventListener('change',e=>setAppearance({landscape:e.target.value}));
  $('#currency-retry').addEventListener('click',()=>ensureRates());
  subscribePreferences(render);subscribeAppearance(render);subscribeCurrency(render);
  $('#settings-daily').addEventListener('click',()=>{$('#appearance-dialog').close();$('#daily-dialog').showModal();});
  $('#settings-watches').addEventListener('click',()=>{$('#appearance-dialog').close();$('[data-tab="watches"]').click();});
  $('#alerts-email-settings').addEventListener('click',()=>openSettings('#email-recipient'));
  render();ensureRates();
}
