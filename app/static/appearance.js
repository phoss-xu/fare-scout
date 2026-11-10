import {tr} from './i18n.js';
import {subscribePreferences,preferencesSaved} from './preferences.js';
import {themes, getAppearance, setAppearance, subscribeAppearance, DEFAULT_APPEARANCE} from './appearance-store.js';

export function setupAppearance() {
  const dialog = document.querySelector('#appearance-dialog'), opener = document.querySelector('#appearance-open');
  const choices = dialog.querySelector('#theme-choices');
  const status = dialog.querySelector('#appearance-status');
  const font = dialog.querySelector('#settings-font-choice');
  font.addEventListener('change', () => setAppearance({font:font.value}));
  let previousOverflow;
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
  let appearanceSaved=true;
  const english={paper:['Old book paper','Warm paper, forest ink and a touch of blue'],moss:['Moss garden','Sage and forest green'],sea:['Sea mist','Mist blue and deep sea grey'],rose:['Rose sand','Dusty pink and deep rose'],mocha:['Cocoa & oats','Oat white and coffee brown'],night:['Pine at night','Dark forest grey and soft white']};
  function render(value, saved = appearanceSaved) {
    appearanceSaved=saved;
    choices.querySelectorAll('button').forEach(button=>{
      const theme=themes.find(t=>t.id===button.dataset.choiceTheme),copy=english[theme.id];
      button.querySelector('strong').textContent=tr(theme.name,copy[0]);
      button.querySelector('small').textContent=tr(theme.description,copy[1]);
      button.setAttribute('aria-label',tr(theme.name,copy[0]));
    });
    choices.querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.choiceTheme === value.theme)));
    font.value = value.font;
    status.textContent = saved && preferencesSaved() ? '' : tr('偏好未保存，仅本页生效','Not saved · Applied to this page');
  }
  subscribePreferences(()=>render(getAppearance()));
  subscribeAppearance(render); render(getAppearance());
  opener.addEventListener('click', () => {
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; dialog.showModal();
    dialog.querySelector('.appearance-body').scrollTop=0;
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
  dialog.querySelector('#appearance-reset').addEventListener('click', () => {
    if (setAppearance(DEFAULT_APPEARANCE)) status.textContent = tr('外观已重置','Appearance reset');
  });
  dialog.addEventListener('close', () => { document.body.style.overflow = previousOverflow || ''; opener.focus(); });
}
