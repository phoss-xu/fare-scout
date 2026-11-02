import {getPreferences} from './preferences.js';
import {displayAmount} from './currency.js';
import {tr} from './i18n.js';
export const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const time = value => value ? new Date(value).toLocaleString(getPreferences().language, {month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}) : tr('尚未查询','Not checked yet');
export const money = value => Number(value).toLocaleString(getPreferences().language, {maximumFractionDigits: 0});

// Currency is presentation only: source prices, budgets and comparisons stay in HKD.
export function price(value) {
  const p=displayAmount(value);
  const source=p.converted?`<span class="source-price">${tr('原价','Original')} HK$${money(value)} · ${tr('参考汇率','Reference rate')} ${p.date}</span>`:'';
  return `<small>${p.converted?'≈ ':''}${p.code==='HKD'?'HK$':p.code}</small> ${p.amount}${source}`;
}
export function amount(value) {
  const p=displayAmount(value);
  return `${p.converted?'≈ ':''}${p.code==='HKD'?'HK$':p.code} ${p.amount}`;
}
