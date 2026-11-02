import {setupLandscape} from './landscape.js';
/** Progressive travel controls alongside automatically selected static photography. */
export function setupJourney(form, panel) {
  setupLandscape(panel);
  function sync() {
    const origins = [...form.querySelectorAll('#deal-origin .place-current strong')].map(e => e.textContent);
    const destinations = [...form.querySelectorAll('#deal-destination .place-current strong')].map(e => e.textContent);
    panel.querySelector('#journey-origin-value').textContent = origins.length ? origins[0] + (origins.length > 1 ? ` 等 ${origins.length} 处` : '') : '选择出发地';
    panel.querySelector('#journey-destination-value').textContent = form.elements.anywhere.checked ? '任何地方' : (destinations.length ? destinations[0] + (destinations.length > 1 ? ` 等 ${destinations.length} 处` : '') : '') || '选择目的地';
    const start = form.elements.start.value, end = form.elements.end.value;
    const yearLabel = panel.querySelector('.date-copy .choice-action');
    yearLabel.textContent = start && end ? `${start.slice(0,4) === end.slice(0,4) ? start.slice(0,4) : start.slice(0,4) + '–' + end.slice(0,4)} 年 · 灵活出发` : '日期可以灵活一点';
    const date = start ? new Date(`${start}T12:00:00`) : null;
    panel.querySelector('#journey-month').textContent = date ? new Intl.DateTimeFormat('en', {month:'short'}).format(date).toUpperCase() : 'DATE';
    panel.querySelector('#journey-day').textContent = date ? String(date.getDate()).padStart(2, '0') : '＋';
    panel.querySelector('#journey-date-value').textContent = start && end ? `${start.slice(5).replace('-', '月')}日 — ${end.slice(5).replace('-', '月')}日` : '选一段空闲';
    const preferences = [`${form.elements.min_nights.value}–${form.elements.max_nights.value} 晚`, `${form.elements.adults.value} 位成人`];
    if (form.elements.max_stops.value !== '-1') preferences.push(form.elements.max_stops.value === '0' ? '直飞' : '最多 1 次中转');
    if (Number(form.elements.budget.value)) preferences.push(`HK$${form.elements.budget.value} 内`);
    if (Number(form.elements.max_duration_hours.value)) preferences.push(`每程 ${form.elements.max_duration_hours.value} 小时内`);
    const days = form.querySelectorAll('[name=weekday]:checked').length;
    if (days) preferences.push(`${days} 个出发星期`);
    panel.querySelector('#journey-extras-value').textContent = preferences.join(' · ');
  }
  ['input', 'change', 'journey:locations'].forEach(name => form.addEventListener(name, sync));
  const choices = [...form.querySelectorAll('.journey-choices>details')];
  panel.addEventListener('click', event => {
    [...choices, form.querySelector('.journey-extras')].forEach(details => {
      if (details.open && !details.contains(event.target)) details.open = false;
    });
  });
  choices.forEach(details => details.addEventListener('toggle', () => {
    details.querySelector('summary').setAttribute('aria-expanded', String(details.open));
    if (details.open) choices.forEach(other => { if (other !== details) other.open = false; });
  }));
  // Hidden invalid fields need their containing disclosures opened before focus.
  form.addEventListener('invalid', event => {
    let node = event.target.parentElement;
    while (node && node !== form) { if (node.tagName === 'DETAILS') node.open = true; node = node.parentElement; }
  }, true);
  form.addEventListener('submit', () => panel.querySelector('.discovery-results').classList.add('results-requested'));
  return {reset() {
    form.querySelectorAll('details').forEach(details => { details.open = false; });
    panel.querySelector('.discovery-results').classList.remove('results-requested');
    sync();
  }};
}
