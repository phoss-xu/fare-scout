import {setupWorldBackdrop} from './world-backdrop.js';
import {landscapes, photoPath} from './landscape-data.js';
import {startLandscapeRotation} from './landscape-rotation.js';
import {getAppearance, subscribeAppearance} from './appearance-store.js';

/** Static photography with saved rotation, manual selection and a scenic header background. */
export function setupLandscape(panel) {
  const scene = panel.querySelector('.atlas-scene'), photo = scene.querySelector('.atlas-photo');
  const error = scene.querySelector('#atlas-image-error');
  const text = (id, value) => { scene.querySelector(`#${id}`).textContent = value; };
  const backdrop = setupWorldBackdrop();
  let version = 0;
  const items = ['forest','sculpture','beach','city','harbour','rice'].map(id => landscapes.find(place => place.id === id));
  async function render(place) {
    const current = ++version;
    scene.dataset.place = place.id; backdrop.setPlace(place);
    document.dispatchEvent(new CustomEvent('landscapechange', {detail:{id:place.id}}));
    error.hidden = true;
    photo.src = photoPath(place); photo.style.objectPosition = place.position;
    text('atlas-title', place.title); text('atlas-name', place.name);
    text('atlas-location', place.location); text('atlas-description', place.description);
    text('atlas-kind', place.kind);
    const credit = scene.querySelector('#atlas-credit'); credit.href = place.source; credit.textContent = `摄影 ${place.author} · 原图 ↗`;
    try {
      await photo.decode();
      if (current !== version) return;
      const next = items[(items.indexOf(place) + 1) % items.length];
      const preload = new Image(); preload.src = photoPath(next);
    } catch (cause) {
      if (current !== version) return;
      error.hidden = false;
      console.warn('Landscape photo could not be loaded', {place:place.id, error:cause.name});
    }
  }
  const rotation = startLandscapeRotation({items, render, mode:getAppearance().landscape});
  document.addEventListener('landscapeselect', event => rotation.select(event.detail.id));
  const note = scene.querySelector('.atlas-refresh-note');
  function syncPreference(value) {
    rotation.setMode(value.landscape);
    photo.style.opacity = '1';
    note.textContent = {hourly:'偶遇一处风景 · 每小时更新',daily:'一日一景 · 每天更新',visit:'偶遇一处风景 · 进入时更新',fixed:'把这处风景，留在眼前'}[value.landscape];
  }
  subscribeAppearance(syncPreference); syncPreference(getAppearance());
}
