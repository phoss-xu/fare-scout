import {tr} from './i18n.js';
export const selectedNights = form => [...form.querySelectorAll('[name=night]:checked')].map(box=>Number(box.value));
export function nightsLabel(values) {
  return values.length ? values.join(tr('、', ', '))+tr(' 晚',' nights') : '';
}
export function setupNights(form) {
  function render() {
    const values=selectedNights(form);
    form.querySelector('#night-value').textContent=nightsLabel(values);
  }
  form.addEventListener('change',render);
  document.addEventListener('languagechange',render);
  render();return {reset:render};
}
