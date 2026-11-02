/** Public reference rates only; no account or itinerary information is sent. */
import {currencies} from './preferences.js';
const KEY='fare-scout:exchange-rates', MAX_AGE=86400000;
export function validateRates(value,now=Date.now()) {
  if(!value || !Number.isFinite(value.fetchedAt) || value.fetchedAt>now || now-value.fetchedAt>MAX_AGE || !Array.isArray(value.rows)) return null;
  const result={HKD:{rate:1,date:null}};
  for(const row of value.rows) {
    if(row.base!=='HKD' || !currencies.includes(row.quote) || row.quote==='HKD' || typeof row.rate!=='number' || !Number.isFinite(row.rate) || row.rate<=0 || !/^\d{4}-\d{2}-\d{2}$/.test(row.date)) continue;
    const date=Date.parse(row.date+'T00:00:00Z');
    if(!Number.isFinite(date) || date>now+86400000 || now-date>10*86400000) continue;
    result[row.quote]={rate:row.rate,date:row.date};
  }
  return Object.keys(result).length>1?result:null;
}
export async function loadRates({storage=globalThis.localStorage,fetcher=globalThis.fetch,now=Date.now()}={}) {
  try {const cached=validateRates(JSON.parse(storage.getItem(KEY)),now);if(cached) return cached;}
  catch(error) {console.info('Exchange cache unavailable',error.name);}
  const response=await fetcher(`https://api.frankfurter.dev/v2/rates?base=HKD&quotes=${currencies.filter(c=>c!=='HKD').join(',')}`,{credentials:'omit',signal:AbortSignal.timeout(8000)});
  if(!response.ok) throw new Error(`Exchange rate HTTP ${response.status}`);
  const data={fetchedAt:now,rows:await response.json()},rates=validateRates(data,now);
  if(!rates) throw new Error('Invalid exchange rate response');
  try {storage.setItem(KEY,JSON.stringify(data));} catch(error) {console.info('Exchange cache could not be saved',error.name);}
  return rates;
}
