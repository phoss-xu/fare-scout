const HOUR = 60 * 60 * 1000, DAY = 24 * HOUR, SHANGHAI = 8 * HOUR;
export const hourKey = time => Math.floor(time / HOUR);
export const nextHourDelay = time => HOUR - time % HOUR;
export const dayKey = time => Math.floor((time + SHANGHAI) / DAY);
export const nextDayDelay = time => DAY - (time + SHANGHAI) % DAY;
export function nextSceneIndex(length, previous, initial = 0) {
  if (!Number.isInteger(length) || length < 1) throw new RangeError('No landscape available');
  return Number.isInteger(previous) && previous >= 0 && previous < length ? (previous + 1) % length : Math.abs(Math.trunc(initial)) % length;
}
const periodAt = (mode, time) => mode === 'daily' ? `daily:${dayKey(time)}` : `hourly:${hourKey(time)}`;

export function startLandscapeRotation({items, render, now = Date.now, storage, mode = 'hourly'}) {
  const key = 'fare-scout:landscape:last', stampKey = 'fare-scout:landscape:period';
  let previous, savedPeriod;
  try { storage ??= globalThis.localStorage; previous = items.findIndex(item => item.id === storage.getItem(key)); savedPeriod = storage.getItem(stampKey); }
  catch (error) { console.info('Landscape preference storage unavailable', error.name); }
  let period = periodAt(mode, now()), timer;
  const keep = previous >= 0 && (mode === 'fixed' || (mode === 'daily' && savedPeriod === period));
  let index = keep ? previous : nextSceneIndex(items.length, previous, crypto.getRandomValues(new Uint32Array(1))[0]);
  function save() {
    try { storage.setItem(key, items[index].id); storage.setItem(stampKey, period); }
    catch (error) { console.info('Landscape preference could not be saved', error.name); }
  }
  function show() { render(items[index]); save(); }
  function check() {
    clearTimeout(timer);
    if (!['hourly','daily'].includes(mode)) return;
    const current = periodAt(mode, now());
    if (!document.hidden && current !== period) {
      index = nextSceneIndex(items.length, index); period = current; show();
    }
    timer = setTimeout(check, (mode === 'daily' ? nextDayDelay(now()) : nextHourDelay(now())) + 25);
  }
  function setMode(next) {
    if (mode === next) return;
    mode = next; period = periodAt(mode, now()); save(); check();
  }
  function select(id) {
    const selected = items.findIndex(item => item.id === id);
    if (selected < 0) return false;
    index = selected; period = periodAt(mode, now()); show(); check();
    return true;
  }
  document.addEventListener('visibilitychange', check);
  window.addEventListener('pageshow', check);
  show(); check();
  return {check, setMode, select};
}
