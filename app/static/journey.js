import {getPreferences,subscribePreferences} from './preferences.js';
import {currencyLabel} from './currency.js';
import {selectedWeekends} from './travel-dates.js';
import {tr} from './i18n.js';
import {selectedNights,nightsLabel} from './nights.js';
import {flightDate} from './format.js';
import {setupJourneyDisclosures} from './journey-disclosures.js';
import {setupTimeWindows,captureWindows,windowDescription} from './time-windows.js';
import {setupDateRangeCalendar} from './date-range-calendar.js';
import {setupLandscape} from './landscape.js';
/** Progressive travel controls alongside automatically selected static photography. */
export function setupJourney(form, panel) {
  setupLandscape(panel);
  const timeWindows=setupTimeWindows(form);
  function sync() {
    const currency=getPreferences().currency,label=currencyLabel(currency);
    const watchForm=document.querySelector('#watch-form');
    if(watchForm) for(const [name,title] of [['budget',tr('总预算 · ','Total budget · ')],['min_drop',tr('至少降价 · ','Minimum drop · ')]]) watchForm.elements[name].closest('label').firstChild.textContent=title+label;
    panel.querySelector('.search-cabin').textContent=tr('经济舱 · ','Economy · ')+label;
    const budgetLabel=form.elements.budget.closest('label');
    budgetLabel.firstChild.textContent=tr('总预算 · ','Total budget · ')+label;
    const origins = [...form.querySelectorAll('#deal-origin .place-current strong')].map(e => e.textContent);
    const destinations = [...form.querySelectorAll('#deal-destination .place-current strong')].map(e => e.textContent);
    panel.querySelector('#journey-origin-value').textContent = origins.length ? origins[0] + (origins.length > 1 ? `${tr(" 等 "," and more · ")}${origins.length}${tr(" 处"," places")}` : '') : tr("选择出发地","Choose departure");
    panel.querySelector('#journey-destination-value').textContent = form.elements.anywhere.checked ? tr("任何地方","Anywhere") : (destinations.length ? destinations[0] + (destinations.length > 1 ? `${tr(" 等 "," and more · ")}${destinations.length}${tr(" 处"," places")}` : '') : '') || tr("选择目的地","Choose destinations");
    const oneWay=form.elements.trip_type.value==='oneway';
    if(oneWay && form.elements.date_mode.value==='weekends') form.elements.date_mode.value='range';
    const weekendOption=form.querySelector('[name=date_mode][value=weekends]');
    weekendOption.closest('label').hidden=oneWay;weekendOption.disabled=oneWay;
    form.querySelector('.date-weekends').hidden=oneWay || form.elements.date_mode.value==='windows';
    const fixedLabel=form.querySelector('[name=date_mode][value=fixed]').nextElementSibling.querySelector('strong');
    fixedLabel.textContent=oneWay?tr('固定日期','Fixed date'):tr('固定往返','Fixed return dates');
    const start = form.elements.start.value, end = form.elements.end.value;
    const windowMode=form.elements.date_mode.value==='windows';
    timeWindows.sync();
    const weekendMode=form.elements.date_mode.value==='weekends';
    const fixed=form.elements.date_mode.value!=='range';
    form.querySelector('.date-fields').hidden=weekendMode || windowMode;
    form.querySelectorAll('.date-fields input').forEach(input=>input.disabled=weekendMode || windowMode);
    panel.querySelector('#deal-start-label').textContent=fixed?tr('出发日期','Departure date'):tr('最早出发','Earliest departure');
    panel.querySelector('#deal-end-label').textContent=fixed?tr('返程起飞日期','Return departure date'):tr('最晚出发','Latest departure');
    panel.querySelector('#deal-date-hint').textContent=fixed?tr('当地起飞日期','Local departure dates'):'';
    form.elements.end.min=start || form.elements.start.min;
    form.querySelector('.search-nights').hidden=fixed || oneWay;
    form.querySelector('.search-footer').hidden=windowMode;
    form.elements.end.closest('label').hidden=oneWay && fixed;
    form.elements.end.disabled=weekendMode || windowMode || (oneWay && fixed);
    form.querySelector('.date-connector').hidden=oneWay && fixed;
    form.querySelector('.deal-presets').hidden=fixed;
    form.querySelector('.date-weekdays').hidden=fixed;
    form.querySelectorAll('[name=weekday]').forEach(box=>{box.disabled=fixed;});
    const yearLabel = panel.querySelector('.date-copy .choice-action');
    yearLabel.textContent = start && end ? `${start.slice(0,4) === end.slice(0,4) ? start.slice(0,4) : start.slice(0,4) + '–' + end.slice(0,4)}${tr(" 年"," ")}` : tr("选择日期","Choose dates");
    const stamp=windowMode?form.elements.outbound_start_date.value:start;
    const date = stamp ? new Date(`${stamp}T12:00:00`) : null;
    panel.querySelector('#journey-month').textContent = date ? tr(`${date.getMonth()+1}月`,new Intl.DateTimeFormat('en', {month:'short'}).format(date).toUpperCase()) : tr('日期','DATE');
    panel.querySelector('#journey-day').textContent = date ? String(date.getDate()).padStart(2, '0') : '＋';
    const crossesYear=start && end && start.slice(0,4)!==end.slice(0,4);
    panel.querySelector('#journey-date-value').textContent = start && end ? `${flightDate(start,!crossesYear)} → ${flightDate(end,!crossesYear)}` : tr("选一段空闲","Choose some time away");
    if(oneWay && fixed) panel.querySelector('#journey-date-value').textContent=start?flightDate(start,true):tr('选择出发日期','Choose departure date');
    const weekdays=[...form.querySelectorAll('[name=weekday]:checked')].map(box=>Number(box.value));
    const weekdaySummary=panel.querySelector('#journey-weekday-summary');
    weekdaySummary.hidden=fixed || !weekdays.length;
    const weekdayNames=tr(['周一','周二','周三','周四','周五','周六','周日'],['Mon','Tue','Wed','Thu','Fri','Sat','Sun']);
    const weekdayText=weekdayNames.filter((_,index)=>weekdays.includes(index)).join('、');
    panel.querySelector('#journey-weekday-value').textContent=weekdayText;
    panel.querySelector('#weekday-value').textContent=weekdayText;
    const stayNights=selectedNights(form);
    panel.querySelector('#journey-nights-summary').hidden=fixed || oneWay || !stayNights.length;
    panel.querySelector('#journey-nights-value').textContent=nightsLabel(stayNights);
    if(weekendMode) {
      const pairs=selectedWeekends(form);
      panel.querySelector('#journey-date-value').textContent=pairs.length ? pairs.map(p=>`${p.start.slice(5)}–${p.end.slice(5)}`).join(' · ') : tr('请选择周末','Choose weekends');
      panel.querySelector('#deal-date-hint').textContent=tr(`已选 ${pairs.length} 个周末`,`${pairs.length} weekends selected`);
    }
    const dateSummary=panel.querySelector('#journey-date-value');
    dateSummary.classList.toggle('window-summary',windowMode);
    if(windowMode) {
      const windows=captureWindows(form,false);
      dateSummary.textContent=windowDescription(windows).replace(' · ','\n');
      panel.querySelector('#deal-date-hint').textContent=tr('每程分别设置日期范围；不限制时刻时接受全天航班。','Set dates for each leg. Leave times off to accept any time of day.');
    }
    const preferences = [`${form.elements.adults.value}${tr(" 位成人"," adults")}`];
    if (form.elements.max_stops.value !== '-1') preferences.push(form.elements.max_stops.value === '0' ? tr("直飞","Direct") : tr("最多 1 次中转","Up to 1 stop"));
    if (Number(form.elements.budget.value)) preferences.push(`${currencyLabel(getPreferences().currency)} ${form.elements.budget.value}${tr(" 内"," or less")}`);
    if (Number(form.elements.max_duration_hours.value)) preferences.push(`${tr("每程 ","Per leg: ")}${form.elements.max_duration_hours.value}${tr(" 小时内"," hours per leg")}`);
    panel.querySelector('#journey-extras-value').textContent = preferences.join(' · ');
  }
  document.addEventListener('languagechange',sync);
  subscribePreferences(sync);
  ['input', 'change', 'journey:locations'].forEach(name => form.addEventListener(name, sync));
  setupJourneyDisclosures(form);
  setupDateRangeCalendar(form);
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
