import {tr} from './i18n.js';
import {setupWorldBackdrop} from './world-backdrop.js';
import {defaultLandscape, fetchLandscape, landscapeImage, REFRESH_MS} from './landscape-provider.js';
import {setupLandscapeActions} from './landscape-actions.js';

export function setupLandscape(panel) {
  const scene = panel.querySelector('.atlas-scene'), photo = scene.querySelector('.atlas-photo');
  const error = scene.querySelector('#atlas-image-error'), note = scene.querySelector('.atlas-refresh-note');
  const backdrop = setupWorldBackdrop(), actions = setupLandscapeActions(scene);
  const refreshButton=scene.querySelector('#atlas-refresh');
  let attemptedAt = 0, pending = false, timer, currentPlace=defaultLandscape;
  function render(place) {
    currentPlace=place;
    scene.dataset.place = place.id; backdrop.setPlace(place);
    photo.src = landscapeImage(place); photo.alt = place.name; photo.style.objectPosition = place.position;
    const workspacePhoto=document.querySelector('#workspace-scenery-photo');
    if(workspacePhoto){workspacePhoto.src=photo.src;workspacePhoto.style.objectPosition=place.position;}
    for (const key of ['title','name']) scene.querySelector(`#atlas-${key}`).textContent = place[key];
    if(place.id==='forest') {
      scene.querySelector('#atlas-name').textContent=tr(place.name,'Arashiyama Bamboo Grove');
    }
    const credit = document.querySelector('#atlas-credit'), license = document.querySelector('#atlas-license');
    credit.href = place.source; credit.textContent = `${tr("摄影 ","Photo by ")}${place.author}${tr(" · 来源 ↗"," · Source ↗")}`;
    license.href = place.licenseUrl; license.textContent = place.license;
    const source = scene.querySelector('#atlas-source');
    source.href = place.source; source.textContent = credit.textContent;
    source.title = place.license;
    actions.setPhoto(place);
  }
  async function refresh({force=false}={}) {
    if (pending) return;
    clearTimeout(timer);
    if (!document.hidden && (force || Date.now() - attemptedAt >= REFRESH_MS)) {
      pending = true; attemptedAt = Date.now();
      refreshButton.disabled=true;refreshButton.setAttribute('aria-busy','true');
      note.textContent=tr('加载新风景…','Loading scenery…');
      try {
        const place = await fetchLandscape({force,excludeId:force?currentPlace.id:undefined});
        render(place); error.hidden = true; note.textContent = tr("每小时更新","Updated hourly");
      } catch (cause) {
        console.warn('Landscape refresh failed', {error:cause.name, message:cause.message});
        error.hidden = false;
        error.textContent = tr("新风景加载失败，稍后重试。","Could not load new scenery. Try again later.");
        note.textContent = tr('保留当前风景','Keeping current scenery');
      } finally { pending = false;refreshButton.disabled=false;refreshButton.setAttribute('aria-busy','false'); }
    }
    timer = setTimeout(refresh, document.hidden ? REFRESH_MS : Math.max(1000, attemptedAt + REFRESH_MS - Date.now()));
  }
  refreshButton.addEventListener('click',()=>refresh({force:true}));
  photo.addEventListener('error', () => {
    if (scene.dataset.place === defaultLandscape.id) { error.hidden = false; error.textContent = tr("图片未载入，可查看原图。","Image unavailable. View the original photo."); return; }
    render(defaultLandscape); error.hidden = false; error.textContent = tr("图片加载失败 · 已用备用图","Image unavailable · Fallback shown");
    note.textContent = tr("默认风景 · 岚山竹林","Default scenery · Arashiyama Bamboo Grove");
  });
  document.addEventListener('languagechange',()=>{
    render(currentPlace);
    note.textContent=pending?tr('加载新风景…','Loading scenery…'):currentPlace.id==='forest'?tr('默认风景 · 岚山竹林','Default scenery · Arashiyama Bamboo Grove'):tr('每小时更新','Updated hourly');
    if(!error.hidden) {
      error.textContent=tr('新风景加载失败，稍后重试。','Could not load new scenery. Try again later.');
      if(!pending) note.textContent=tr('保留当前风景','Keeping current scenery');
    }
  });
  render(defaultLandscape); refresh();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  window.addEventListener('pageshow', refresh);
}
