import {getPreferences} from './preferences.js';
import {loadRates} from './exchange-rates.js';
let rates={HKD:{rate:1,date:null}},status='idle',pending;
const listeners=new Set();
export function exchangeState() {return {status,...rates[getPreferences().currency]};}
export function subscribeCurrency(listener) {listeners.add(listener);return ()=>listeners.delete(listener);}
export async function ensureRates(source='HKD') {
  if(getPreferences().currency==='HKD' && source==='HKD') return;
  if(pending) return pending;
  status='loading';listeners.forEach(fn=>fn());
  pending=(async()=>{
    try {rates=await loadRates();status='ready';}
    catch(error) {status='error';console.info('Reference exchange rates unavailable',error.message);}
    finally {pending=undefined;listeners.forEach(fn=>fn());}
  })();
  return pending;
}
const symbols={CNY:'¥',JPY:'¥',USD:'$',HKD:'HK$',EUR:'€',GBP:'£',SGD:'S$',AUD:'A$',CAD:'C$'};
export const currencySymbol=code=>symbols[code] || code;
const labels={HKD:'港币',CNY:'人民币',USD:'美元',EUR:'欧元',JPY:'日元',GBP:'英镑',SGD:'新加坡元',AUD:'澳元',CAD:'加元'};
export function currencyLabel(code) {return getPreferences().language==='zh-CN'?(labels[code] || code):code;}
export function displayAmount(value,source='HKD') {
  const {currency,language}=getPreferences();
  const direct=source===currency,available=direct || (rates[source] && rates[currency]);
  const code=available?currency:source,converted=code!==source;
  const rate=converted?rates[code].rate/rates[source].rate:1;
  return {code,date:converted?(rates[code].date || rates[source].date):null,converted,amount:new Intl.NumberFormat(language,{maximumFractionDigits:code==='JPY'?0:2}).format(Number(value)*rate)};
}
