import {chinaToday} from './holidays.js';
import {tr} from './i18n.js';

const shift = (iso, days) => {
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};
// On Sundays, offer the next complete Saturday–Sunday trip.
export function upcomingWeekends(today, count = 4) {
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
  const saturday = shift(today, (6 - weekday + 7) % 7);
  return Array.from({length: count}, (_, index) => {
    const start = shift(saturday, index * 7);
    return {start, end: shift(start, 1)};
  });
}

export function selectedWeekends(form) {
  return JSON.parse(form.elements.date_pairs.value || '[]');
}
export function applyWeekend(form, weekend) {
  const selected = form.elements.date_mode.value === 'weekends' ? selectedWeekends(form) : [];
  const next = selected.some(pair=>pair.start===weekend.start)
    ? selected.filter(pair=>pair.start!==weekend.start) : [...selected, weekend];
  next.sort((a,b)=>a.start.localeCompare(b.start));
  form.elements.date_pairs.value = JSON.stringify(next);
  form.elements.date_mode.value = 'weekends';
  if (next.length) {
    form.elements.start.value = next[0].start;
    form.elements.end.value = next.at(-1).end;
  }
  form.querySelectorAll('[name=weekday]').forEach(box => box.checked = false);
  form.dispatchEvent(new Event('change', {bubbles: true}));
}

export function setupTravelDates(form) {
  const root = form.querySelector('#weekend-options');
  let renderedKey;
  function render() {
    const weekends = upcomingWeekends(chinaToday());
    form.querySelector('[data-clear-weekends]').hidden=form.elements.date_mode.value!=='weekends' || !selectedWeekends(form).length;
    const key = JSON.stringify([weekends, tr('zh','en')]);
    if (key !== renderedKey) root.innerHTML = weekends.map((weekend, index) => {
      const selected = form.elements.date_mode.value === 'weekends' && selectedWeekends(form).some(pair=>pair.start===weekend.start);
      const label = index === 0 ? tr('最近周末','Next weekend') : tr(`第 ${index + 1} 个周末`,`Weekend ${index + 1}`);
      return `<button type="button" data-weekend="${index}" aria-pressed="${selected}"><strong>${label}</strong><span>${weekend.start.slice(5).replace('-', '/')} – ${weekend.end.slice(5).replace('-', '/')}</span></button>`;
    }).join('');
    renderedKey = key;
    root.querySelectorAll('[data-weekend]').forEach((button, index) => {
      const weekend = weekends[index];
      button.setAttribute('aria-pressed', String(form.elements.date_mode.value === 'weekends' && selectedWeekends(form).some(pair=>pair.start===weekend.start)));
    });
  }
  form.querySelector('[data-clear-weekends]').addEventListener('click',()=>{
    form.elements.date_pairs.value='[]';
    form.dispatchEvent(new Event('change',{bubbles:true}));
  });
  root.addEventListener('click', event => {
    const button = event.target.closest('[data-weekend]');
    if (!button) return;
    applyWeekend(form, upcomingWeekends(chinaToday())[Number(button.dataset.weekend)]);
  });
  form.addEventListener('change', () => {
    const pairs=selectedWeekends(form);
    if(form.elements.date_mode.value==='weekends' && pairs.length) {
      form.elements.start.value=pairs[0].start;
      form.elements.end.value=pairs.at(-1).end;
    }
  }, true);
  form.addEventListener('change', render);
  form.addEventListener('input', render);
  // Refresh across midnight when the date panel is opened again.
  form.querySelector('.journey-date').addEventListener('toggle', render);
  document.addEventListener('languagechange', render);
  render();
  return {reset() {form.elements.date_pairs.value='[]';render();}};
}
