export const PREFERENCES_KEY = 'fare-scout:preferences';
export const currencies = ['HKD','CNY','USD','EUR','JPY','GBP','SGD','AUD','CAD'];
export const DEFAULT_PREFERENCES = Object.freeze({language:'zh-CN',currency:'CNY'});
export function normalizePreferences(value) {
  return {language:['zh-CN','en'].includes(value?.language)?value.language:'zh-CN',
    currency:currencies.includes(value?.currency)?value.currency:DEFAULT_PREFERENCES.currency};
}
let current, saved=true;
const listeners=new Set();
export function getPreferences() {
  if(!current) {
    try {current=normalizePreferences(JSON.parse(localStorage.getItem(PREFERENCES_KEY)));}
    catch(error) {current={...DEFAULT_PREFERENCES};console.info('Preferences unavailable',error.name);}
  }
  return {...current};
}
export function setPreferences(patch) {
  current=normalizePreferences({...getPreferences(),...patch});
  try {localStorage.setItem(PREFERENCES_KEY,JSON.stringify(current));saved=true;}
  catch(error) {saved=false;console.info('Preferences could not be saved',error.name);}
  listeners.forEach(listener=>listener({...current},saved));
  return saved;
}
export function subscribePreferences(listener) {listeners.add(listener);return ()=>listeners.delete(listener);}

export const preferencesSaved=()=>saved;
