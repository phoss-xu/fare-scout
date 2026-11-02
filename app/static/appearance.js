import {landscapes, photoPath} from './landscape-data.js';
import {themes, landscapeModes, getAppearance, setAppearance, subscribeAppearance, DEFAULT_APPEARANCE} from './appearance-store.js';

export function setupAppearance() {
  const dialog = document.querySelector('#appearance-dialog'), opener = document.querySelector('#appearance-open');
  const choices = dialog.querySelector('#theme-choices'), frequency = dialog.querySelector('#landscape-frequency');
  const status = dialog.querySelector('#appearance-status');
  const gallery = dialog.querySelector('#landscape-choices'), opacity = dialog.querySelector('#landscape-opacity');
  const motion = dialog.querySelector('#landscape-motion');
  motion.addEventListener('change', () => setAppearance({motion:motion.checked}));
  let previousOverflow;
  gallery.replaceChildren(...landscapes.map(place => {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'landscape-choice'; button.dataset.landscape = place.id;
    button.setAttribute('aria-label', `选择背景：${place.name}`);
    const image = document.createElement('img'); image.src = photoPath(place, true); image.alt = ''; image.loading = 'lazy';
    const name = document.createElement('strong'); name.textContent = place.name;
    const location = document.createElement('small'); location.textContent = place.location;
    const check = document.createElement('span'); check.textContent = '✓'; check.className = 'landscape-check'; check.setAttribute('aria-hidden','true');
    button.append(image, name, location, check);
    return button;
  }));
  function markLandscape(id) {
    gallery.querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.landscape === id)));
  }
  document.addEventListener('landscapechange', event => markLandscape(event.detail.id));
  markLandscape(document.querySelector('.atlas-scene')?.dataset.place);
  gallery.addEventListener('click', event => {
    const button = event.target.closest('[data-landscape]');
    if (!button) return;
    setAppearance({landscape:'fixed'});
    document.dispatchEvent(new CustomEvent('landscapeselect', {detail:{id:button.dataset.landscape}}));
  });
  opacity.addEventListener('input', () => setAppearance({surfaceOpacity:Number(opacity.value)}));
  choices.replaceChildren(...themes.map(theme => {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'theme-choice'; button.dataset.choiceTheme = theme.id;
    const preview = document.createElement('span'); preview.className = 'theme-preview'; preview.setAttribute('aria-hidden','true');
    const type = document.createElement('span'); type.className = 'theme-type'; type.textContent = 'Aa';
    const swatches = document.createElement('span'); swatches.className = 'theme-swatches';
    for (let n = 0; n < 3; n++) swatches.append(document.createElement('i'));
    preview.append(type, swatches);
    const name = document.createElement('strong'); name.textContent = theme.name;
    const description = document.createElement('small'); description.textContent = theme.description;
    const check = document.createElement('span'); check.className = 'theme-check'; check.textContent = '✓'; check.setAttribute('aria-hidden','true');
    button.setAttribute('aria-label', theme.name); button.append(preview, name, description, check);
    return button;
  }));
  function render(value, saved = true) {
    choices.querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.choiceTheme === value.theme)));
    frequency.value = value.landscape; opacity.value = value.surfaceOpacity; motion.checked = value.motion;
    dialog.querySelector('#landscape-opacity-value').value = `${value.surfaceOpacity}%`;
    opacity.setAttribute('aria-valuetext', `${value.surfaceOpacity}%`);
    dialog.querySelector('#landscape-frequency-hint').textContent = landscapeModes[value.landscape];
    status.textContent = saved ? '已保存到此浏览器，下次回来仍会保留。' : '当前浏览器暂时无法保存偏好，本次页面仍可预览。';
  }
  subscribeAppearance(render); render(getAppearance());
  opener.addEventListener('click', () => {
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; dialog.showModal();
  });
  dialog.querySelector('#appearance-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    const button = event.target.closest('[data-choice-theme]');
    if (button) setAppearance({theme:button.dataset.choiceTheme});
    if (event.target === dialog) {
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
    }
  });
  frequency.addEventListener('change', () => setAppearance({landscape:frequency.value}));
  dialog.querySelector('#appearance-reset').addEventListener('click', () => {
    if (setAppearance(DEFAULT_APPEARANCE)) status.textContent = '已恢复旧书纸、通透底色与每小时换景。';
  });
  dialog.addEventListener('close', () => { document.body.style.overflow = previousOverflow || ''; opener.focus(); });
}
