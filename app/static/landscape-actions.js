import {tr} from './i18n.js';
const KEY = 'fare-scout:landscape:likes:v1';
export function readLikes(storage) {
  try { storage ??= localStorage; const value = JSON.parse(storage.getItem(KEY)); return Array.isArray(value) ? value.filter(item => typeof item?.id === 'string') : []; }
  catch (error) { console.info('Landscape likes unavailable', error.name); return []; }
}
export function toggleLike(photo, storage = localStorage) {
  const likes = readLikes(storage), liked = likes.some(item => item.id === photo.id);
  const next = liked ? likes.filter(item => item.id !== photo.id) : [...likes, {id:photo.id, name:photo.name, source:photo.source, author:photo.author}];
  storage.setItem(KEY, JSON.stringify(next));
  return !liked;
}
function safeSource(value) {
  try { const url = new URL(value); return url.protocol === 'https:' && ['commons.wikimedia.org','unsplash.com'].includes(url.hostname); }
  catch { return false; }
}
export function setupLandscapeActions(scene) {
  const heart = scene.querySelector('#atlas-like'), download = scene.querySelector('#atlas-download');
  const status = scene.querySelector('#atlas-action-status'), list = scene.querySelector('#atlas-likes');
  let photo;
  document.addEventListener('languagechange',()=>sync());
  function sync() {
    const likes = readLikes(), liked = likes.some(item => item.id === photo?.id);
    heart.setAttribute('aria-pressed', String(liked)); heart.textContent = liked ? tr("♥ 已喜欢","♥ Liked") : tr("♡ 喜欢","♡ Like");
    scene.querySelector('#atlas-likes-count').textContent = tr(`我的喜欢（${likes.length}）`,`My favourites (${likes.length})`);
    list.replaceChildren();
    if (!likes.length) list.textContent = tr("暂无喜欢 · 仅保存在此浏览器","No favourites yet · Saved in this browser");
    for (const item of [...likes].reverse()) {
      if (!safeSource(item.source)) continue;
      const row = document.createElement('li'), link = document.createElement('a'), remove = document.createElement('button');
      link.href = item.source; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = `${item.name} · ${item.author}`;
      remove.type = 'button'; remove.textContent = tr("取消喜欢","Unlike"); remove.setAttribute('aria-label', `${tr("取消喜欢：","Unlike: ")}${item.name}`);
      remove.addEventListener('click', () => {
        try { toggleLike(item); sync(); } catch (error) { console.warn('Landscape like failed', error.name); status.textContent = tr("浏览器暂时无法保存喜欢，请重试。","Unable to save favourites in this browser. Try again."); }
      });
      row.append(link, remove); list.append(row);
    }
  }
  heart.addEventListener('click', () => {
    if (!photo) return;
    try { status.textContent = toggleLike(photo) ? tr("已喜欢","Added to favourites") : tr("已取消喜欢。","Removed from favourites."); sync(); }
    catch (error) { console.warn('Landscape like failed', error.name); status.textContent = tr("浏览器暂时无法保存喜欢，请重试。","Unable to save favourites in this browser. Try again."); }
  });
  // Download the licensed displayed size. The original and its terms remain linked beside it.
  download.addEventListener('click', async () => {
    if (!photo?.downloadUrl || download.disabled) return;
    const selected = photo; download.disabled = true; status.textContent = tr("正在准备图片…","Preparing image…");
    try {
      const response = await fetch(selected.downloadUrl, {credentials:'omit', signal:AbortSignal.timeout(20000)});
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob(), type = blob.type.split(';')[0];
      if (!['image/jpeg','image/png'].includes(type) || blob.size > 15 * 1024 * 1024) throw new Error('Unsupported download');
      const url = URL.createObjectURL(blob), link = document.createElement('a');
      link.href = url; link.download = `fare-scout-${selected.id.replace(/[^a-z0-9-]/gi,'-')}.${type === 'image/png' ? 'png' : 'jpg'}`;
      document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      status.textContent = `${tr("下载已准备 · 使用须遵循 ","Download ready · Subject to ")}${selected.license}`;
    } catch (error) {
      console.warn('Landscape download failed', error.name); status.textContent = tr("下载失败，可查看原图。","Download failed. View the original photo.");
    } finally { download.disabled = !photo?.downloadUrl; }
  });
  window.addEventListener('storage', event => { if (event.key === KEY) sync(); });
  return {setPhoto(value) { photo = value; download.hidden = !photo.downloadUrl; download.disabled = false; status.textContent = ''; sync(); }};
}
