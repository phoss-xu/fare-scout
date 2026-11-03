import {getPreferences} from './preferences.js';
import {displayAmount,currencyLabel} from './currency.js';
import {tr} from './i18n.js';
export const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const time = value => value ? new Date(value).toLocaleString(getPreferences().language, {month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}) : tr('尚未查询','Not checked yet');
export const money = value => Number(value).toLocaleString(getPreferences().language, {maximumFractionDigits: 0});

// Numbers keep their source currency. Only older/differently denominated quotes convert.
export function price(value,currency='HKD') {
  const p=displayAmount(value,currency);
  const source=p.converted?`<span class="source-price">${tr('数据源报价','Source quote')} ${currencyLabel(currency)} ${money(value)} · ${tr('参考汇率','Reference rate')} ${p.date}</span>`:'';
  return `<small>${p.converted?'≈ ':''}${currencyLabel(p.code)}</small> ${p.amount}${source}`;
}
export function amount(value,currency='HKD') {
  const p=displayAmount(value,currency);
  return `${p.converted?'≈ ':''}${currencyLabel(p.code)} ${p.amount}`;
}
