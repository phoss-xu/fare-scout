export const APPEARANCE_KEY = 'fare-scout:appearance';
export const DEFAULT_APPEARANCE = Object.freeze({font:'serif', theme:'paper', landscape:'hourly', surfaceOpacity:65, motion:true});
export const themes = [
  {id:'paper',name:'旧书纸',description:'暖纸与墨绿，点一笔蓝'},
  {id:'moss',name:'苔藓庭院',description:'鼠尾草与森林绿'},
  {id:'sea',name:'海盐雾蓝',description:'雾蓝与深海灰'},
  {id:'rose',name:'玫瑰沙',description:'灰粉与深玫瑰'},
  {id:'mocha',name:'可可燕麦',description:'燕麦白与咖啡棕'},
  {id:'night',name:'松林夜色',description:'深绿灰与柔白'}
];
export const landscapeModes = {
  hourly:'打开时换一处，停留时每到整点更新。',
  daily:'同一天保留同一处，每天北京时间零点更新。',
  visit:'每次重新打开或刷新时更新，停留时保持静态。',
  fixed:'保留当前风景，重新打开页面也不更换。'
};
export function normalizeAppearance(value) {
  return {font:['momo','serif','source-hans'].includes(value?.font) ? value.font : DEFAULT_APPEARANCE.font,
    theme:themes.some(theme => theme.id === value?.theme) ? value.theme : DEFAULT_APPEARANCE.theme,
    landscape:Object.hasOwn(landscapeModes, value?.landscape) ? value.landscape : DEFAULT_APPEARANCE.landscape,
    surfaceOpacity:typeof value?.surfaceOpacity === 'number' && Number.isFinite(value.surfaceOpacity) ? Math.min(100, Math.max(0, Math.round(value.surfaceOpacity))) : DEFAULT_APPEARANCE.surfaceOpacity,
    motion:typeof value?.motion === 'boolean' ? value.motion : DEFAULT_APPEARANCE.motion};
}
let current, lastSaved = true;
const subscribers = new Set();
export function getAppearance() {
  if (!current) {
    try { current = normalizeAppearance(JSON.parse(localStorage.getItem(APPEARANCE_KEY))); }
    catch (error) { current = {...DEFAULT_APPEARANCE}; console.info('Appearance preference unavailable', error.name); }
  }
  return {...current};
}
export function setAppearance(patch) {
  current = normalizeAppearance({...getAppearance(), ...patch});
  document.documentElement.dataset.theme = current.theme;
  document.documentElement.dataset.font = current.font;
  try { localStorage.setItem(APPEARANCE_KEY, JSON.stringify(current)); lastSaved = true; }
  catch (error) { lastSaved = false; console.info('Appearance preference could not be saved', error.name); }
  subscribers.forEach(listener => listener({...current}, lastSaved));
  return lastSaved;
}
export function subscribeAppearance(listener) {
  subscribers.add(listener); return () => subscribers.delete(listener);
}
