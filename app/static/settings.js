import {getPreferences,setPreferences,subscribePreferences} from './preferences.js';
import {getAppearance,setAppearance,subscribeAppearance} from './appearance-store.js';
import {ensureRates,exchangeState,subscribeCurrency} from './currency.js';
import {tr} from './i18n.js';
const $=s=>document.querySelector(s);
export function openSettings(focus) {
  const dialog=$('#appearance-dialog');
  if(!dialog.open) $('#appearance-open').click();
  if(focus) {
    const target=$(focus);
    for(let parent=target.parentElement;parent && parent!==dialog;parent=parent.parentElement) {
      if(parent.tagName==='DETAILS') parent.open=true;
    }
    target.scrollIntoView({block:'center'});target.focus();
  }
}
export function renderSettings(state) {
  $('#settings-account').hidden=!state?.user;
  $('#settings-daily').hidden=!state?.daily;
}
export function setupSettings() {
  function render() {
    const p=getPreferences(),exchange=exchangeState();
    document.querySelectorAll('[name=settings_language]').forEach(input=>input.checked=input.value===p.language);
    $('#settings-currency').value=p.currency;
    $('#settings-motion').checked=getAppearance().motion;
    $('#currency-status').textContent=p.currency==='HKD'?tr('港币原价','Original HKD quotes'):
      exchange.rate?tr(`参考汇率 ${exchange.date} · ${p.currency}`,`Reference rate dated ${exchange.date}; displaying ${p.currency}.`):
      exchange.status==='loading'?tr('汇率加载中 · 暂用港币原价','Loading rates · Showing HKD'):
      tr('汇率不可用 · 显示港币原价','Rates unavailable · Showing HKD');
    $('#currency-retry').hidden=p.currency==='HKD' || exchange.status==='loading' || Boolean(exchange.rate);
  }
  document.querySelectorAll('[name=settings_language]').forEach(input=>input.addEventListener('change',e=>setPreferences({language:e.target.value})));
  $('#settings-currency').addEventListener('change',e=>{setPreferences({currency:e.target.value});ensureRates();});
  $('#settings-motion').addEventListener('change',e=>setAppearance({motion:e.target.checked}));
  $('#currency-retry').addEventListener('click',()=>ensureRates());
  subscribePreferences(render);subscribeAppearance(render);subscribeCurrency(render);
  $('#settings-daily').addEventListener('click',()=>{$('#appearance-dialog').close();$('#daily-dialog').showModal();});
  $('#settings-watches').addEventListener('click',()=>{$('#appearance-dialog').close();$('[data-tab="watches"]').click();});
  $('#alerts-email-settings').addEventListener('click',()=>openSettings('#email-recipient'));
  render();ensureRates();
}
