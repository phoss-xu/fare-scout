import {tr} from './i18n.js';
export const selectedNights = form => [...form.querySelectorAll('[name=night]:checked')].map(box=>Number(box.value));
export function nightsLabel(values) {
  return values.length ? values.join(tr('、', ', '))+tr(' 晚',' nights') : tr('请选择停留晚数','Choose nights');
}
export function setupNights(form) {
  const boxes=[...form.querySelectorAll('[name=night]')];
  function render() {
    const values=selectedNights(form);
    form.querySelector('#night-value').textContent=nightsLabel(values);
    boxes[0].setCustomValidity(form.elements.date_mode.value!=='range' || values.length ? '' : tr('请至少选择一个停留晚数。','Select at least one stay length.'));
  }
  form.addEventListener('change',render);
  document.addEventListener('languagechange',render);
  render();return {reset:render};
}
