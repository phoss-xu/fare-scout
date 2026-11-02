import {setupWorldBackdrop} from './world-backdrop.js';
import {defaultLandscape, fetchLandscape, landscapeImage, REFRESH_MS} from './landscape-provider.js';
import {setupLandscapeActions} from './landscape-actions.js';

export function setupLandscape(panel) {
  const scene = panel.querySelector('.atlas-scene'), photo = scene.querySelector('.atlas-photo');
  const error = scene.querySelector('#atlas-image-error'), note = scene.querySelector('.atlas-refresh-note');
  const backdrop = setupWorldBackdrop(), actions = setupLandscapeActions(scene);
  let attemptedAt = 0, pending = false, timer;
  function render(place) {
    scene.dataset.place = place.id; backdrop.setPlace(place);
    photo.src = landscapeImage(place); photo.style.objectPosition = place.position;
    for (const key of ['title','name','location','description','kind']) scene.querySelector(`#atlas-${key}`).textContent = place[key];
    const credit = scene.querySelector('#atlas-credit'), license = scene.querySelector('#atlas-license');
    credit.href = place.source; credit.textContent = `摄影 ${place.author} · 来源 ↗`;
    license.href = place.licenseUrl; license.textContent = place.license;
    actions.setPhoto(place);
  }
  async function refresh() {
    clearTimeout(timer);
    if (pending) return;
    if (!document.hidden && Date.now() - attemptedAt >= REFRESH_MS) {
      pending = true; attemptedAt = Date.now();
      try {
        const place = await fetchLandscape();
        const preload = new Image(); preload.src = place.imageUrl;
        let timeout;
        try { await Promise.race([preload.decode(), new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('Image load timed out')), 12000); })]); }
        finally { clearTimeout(timeout); }
        render(place); error.hidden = true; note.textContent = '每小时更新';
      } catch (cause) {
        console.warn('Landscape refresh failed', {error:cause.name, message:cause.message});
        render(defaultLandscape); error.hidden = false;
        error.textContent = '新风景加载失败，稍后重试。';
        note.textContent = '默认风景 · 岚山竹林';
      } finally { pending = false; }
    }
    timer = setTimeout(refresh, document.hidden ? REFRESH_MS : Math.max(1000, attemptedAt + REFRESH_MS - Date.now()));
  }
  photo.addEventListener('error', () => {
    if (scene.dataset.place === defaultLandscape.id) { error.hidden = false; error.textContent = '图片未载入，可查看原图。'; return; }
    render(defaultLandscape); error.hidden = false; error.textContent = '图片加载失败，已用默认风景。';
    note.textContent = '默认风景 · 岚山竹林';
  });
  render(defaultLandscape); refresh();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  window.addEventListener('pageshow', refresh);
}
