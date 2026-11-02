import {getPreferences} from './preferences.js';
import {loadRates} from './exchange-rates.js';
let rates={HKD:{rate:1,date:null}},status='idle',pending;
const listeners=new Set();
export function exchangeState() {return {status,...rates[getPreferences().currency]};}
export function subscribeCurrency(listener) {listeners.add(listener);return ()=>listeners.delete(listener);}
export async function ensureRates() {
  if(getPreferences().currency==='HKD') return;
  if(pending) return pending;
  status='loading';listeners.forEach(fn=>fn());
  pending=(async()=>{
    try {rates=await loadRates();status='ready';}
    catch(error) {status='error';console.info('Reference exchange rates unavailable',error.message);}
    finally {pending=undefined;listeners.forEach(fn=>fn());}
  })();
  return pending;
}
export function displayAmount(value) {
  const {currency,language}=getPreferences(),rate=rates[currency];
  const code=rate?currency:'HKD';
  return {code,date:rate?.date,converted:code!=='HKD',amount:new Intl.NumberFormat(language,{maximumFractionDigits:code==='HKD'||code==='JPY'?0:2}).format(Number(value)*(rate?.rate || 1))};
}
