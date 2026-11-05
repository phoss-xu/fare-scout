import {icon} from './ui-icons.js';
import {escape,price} from './format.js';
import {locationName} from './location-names.js';
import {flightDetails} from './flights.js';
import {tr} from './i18n.js';
import {registerTrip,tripTools,tripAlert,tripNote} from './trip-state.js';
import {datePair,routeOptions} from './route-detail-model.js';
import {legPicker} from './route-leg-picker.js';

const city=(leg,side)=>escape(locationName(leg[side],'city',leg.segments?.[side==='from'?0:leg.segments.length-1]?.[side+'City']));
const dateLabel=key=>key.split('/').map(d=>d.slice(5).replace('-','.')).join(' — ');
export function routeDetailMarkup(offers,selected,context,state) {
  const options=routeOptions(offers,state),currency=selected.currency || context.currency || 'HKD';
  const ref=registerTrip(selected,{...context,checked_at:selected._checked_at ?? context.checked_at});
  const valid=options.includes(selected);
  let booking=`<span class="muted">${tr('暂无核价入口','No booking link available')}</span>`;
  try {const url=new URL(selected.bookingUrl);if(url.protocol==='https:')booking=`<a class="rd-book" href="${escape(url.href)}" target="_blank" rel="noopener noreferrer">${tr('前往核价','Check price')} ↗</a>`;} catch { /* Missing source link is shown above. */ }
  return `<header class="rd-header"><button type="button" class="rd-back" data-rd-close aria-label="${tr('返回搜索结果','Back to search results')}">${icon('back')}</button><div><p class="rd-eyebrow">FARE SCOUT / ${tr('航线详情','ROUTE DETAILS')}</p><h2 id="route-detail-title">${city(selected.outbound,'from')} <span>${selected.inbound?'⇄':'→'}</span> ${city(selected.outbound,'to')}</h2><p>${context.adults || 1}${tr(' 位成人 · 经济舱 · ',' adults · Economy · ')}${selected.inbound?tr('往返总价','Return total'):tr('单程总价','One-way total')}</p></div>${tripTools(ref)}</header>
  <div class="rd-workspace-toolbar"><div class="rd-filters"><span>${tr('选择你的航班','Choose your flights')}</span><label><input type="checkbox" data-rd-direct ${state.onlyDirect?'checked':''}> ${tr('仅看直飞','Direct only')}</label><select data-rd-sort aria-label="${tr('方案排序','Sort options')}">${[['price',tr('价格从低到高','Lowest price')],['departure',tr('出发从早到晚','Earliest departure')],['duration',tr('总时长最短','Shortest duration')]].map(([v,label])=>`<option value="${v}" ${v===state.sort?'selected':''}>${label}</option>`).join('')}</select></div><div class="rd-query-actions"><button type="button" data-rd-reset>${tr('清除筛选','Clear filters')}</button><button type="button" class="rd-load" data-rd-load ${state.loading?'disabled':''}>${state.loading?tr('正在查询…','Searching…'):tr('查询所选日期更多航班','Find more flights for selected dates')}</button></div><p role="status">${escape(state.message || tr('日期与时段可分别调整；新日期需查询。价格均为完整行程总价。','Adjust dates and times separately; search to fetch new dates. Prices are complete itinerary totals.'))}</p></div>
  ${legPicker(offers,options,selected,state,currency)}
  <aside class="rd-selected"${valid?'':' hidden'}><details class="rd-itinerary" ${state.detailsOpen?'open':''}><summary>${tr('航班与行李详情','Flight and baggage details')}<span>${escape(dateLabel(datePair(selected)))} · ${tr('查看所选行程','View selected itinerary')}</span></summary>${flightDetails(selected)}${tripNote(ref)}</details></aside>
  <p class="rd-coverage">${tr('仅展示本次搜索已返回的报价，不代表该航线全部航班；日期价格是对应完整行程的总价，返程日期为目的地起飞日。','Only quotes returned by this search are shown, not all flights. Date prices are complete itinerary totals; return date is the departure date at the destination.')}</p>
  <footer class="rd-footer"${valid?'':' hidden'}><div class="rd-total"><span>${tr('所选行程总价','Selected itinerary total')} · ${escape(dateLabel(datePair(selected)))}</span><strong>${price(selected.price,currency)}</strong><small>${tr('最终价格与行李额度以核价页为准','Confirm final price and baggage on the booking page')}</small></div><div class="rd-footer-actions">${tripAlert(ref)}${booking}</div></footer>`;
}
