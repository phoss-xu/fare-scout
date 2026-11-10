import {icon} from './ui-icons.js';
import {request} from './api.js';
import {tr} from './i18n.js';
import {currencyLabel} from './currency.js';
import {escape,time} from './format.js';
import {tripSnapshot} from './trip-snapshot.js';
import {tripWatch,tripAccount,expired} from './trip-state.js';
import {shareURL,shareMarkup,bindShare} from './trip-sharing.js';
function dialog(id,title) {
  let d=document.getElementById(id);if(!d){d=document.createElement('dialog');d.id=id;d.className='trip-dialog';document.body.append(d);}
  d.setAttribute('aria-labelledby',id+'-title');
  d.innerHTML=`<div class="dialog-head"><div><p class="eyebrow">FARE SCOUT / YOUR NEXT TRIP</p><h2 id="${id}-title">${title}</h2></div><button type="button" class="icon-btn" aria-label="${tr('关闭','Close')}">${icon('close')}</button></div><div class="trip-dialog-body"></div>`;
  d.querySelector('.icon-btn').onclick=()=>d.close();return d;
}
export async function openShare(snapshot,isCurrent=()=>true) {
  const s=tripSnapshot(snapshot),result=await request('/api/shared-trips',s);if(!isCurrent())return;
  const url=shareURL(result.id),d=dialog('trip-share-dialog',tr('一起商量，下一站','Plan the next trip together'));
  d.querySelector('.trip-dialog-body').innerHTML=shareMarkup(s,url);bindShare(d,s,url);d.showModal();
}
export function openTripAlert(snapshot,refresh,toast,isCurrent=()=>true) {
  const s=tripSnapshot(snapshot),w=tripWatch(s),o=s.offer.outbound,b=s.offer.inbound;
  if(expired(s)) {toast(tr('出行日期已过，请重新搜索。','This trip has expired. Search for new dates.'));return;}
  const d=dialog('trip-alert-dialog',w?tr('管理降价提醒','Manage price alerts'):tr('让好价格来找你','Let a good fare find you'));
  const verified=tripAccount?.email?.configured;
  d.querySelector('.trip-dialog-body').innerHTML=`<p class="trip-alert-route"><span>${escape(o.from)} → ${escape(o.to)}</span>${b?`<span>${escape(b.from)} → ${escape(b.to)}</span>`:''}</p><p>${escape(o.departureTime.slice(0,10))}${b?' — '+escape(b.departureTime.slice(0,10)):''} · ${s.adults}${b?tr(' 人往返',' travellers, return'):tr(' 人单程',' travellers, one-way')} · ${tr('经济舱','Economy')}</p><div class="trip-scope-note">${tr('同机场、同日期，更便宜的航班也可以。','Same airports and dates. Other cheaper flights can qualify.')}<small>${tr('沿用本次中转与时长筛选，不锁定航班号。','Keeps stop and duration filters; does not lock flight numbers.')}</small></div><form class="trip-alert-form"><label>${tr('目标总价 · ','Target total price · ')+currencyLabel(s.currency)+tr('（可不填）',' (optional)')}<input name="budget" type="number" min="0" max="1000000" step="1" value="${w?.budget || ''}" ${w?'disabled':''} placeholder="${tr('进入目标价时提醒','Alert when within budget')}"></label>${w?`<p class="form-hint">${tr('此监控的目标价沿用创建时设置。','This watch keeps its original target price.')}</p>`:''}<div class="two-col"><label>${tr('至少降价 · ','Minimum drop · ')+currencyLabel(s.currency)}<input name="min_drop" type="number" min="1" max="1000000" value="${w?.min_drop ?? 100}" required></label><label>${tr('查价间隔','Check interval')}<select name="interval_hours">${[1,3,6,12,24].map(n=>`<option value="${n}" ${n===(w?.interval_hours ?? 6)?'selected':''}>${n}${tr(' 小时',' hr')}</option>`).join('')}</select></label></div><label class="toggle"><input name="auto_enabled" type="checkbox" ${!w || w.auto_enabled?'checked':''}>${tr('自动查价','Automatic checks')}</label><label class="toggle"><input name="alerts_enabled" type="checkbox" ${!w || w.alerts_enabled?'checked':''}>${tr('降价或首次进入目标价时提醒','Alert on drops or first entry into budget')}</label><p class="form-hint">${tr('网页提醒会保留在提醒中心。邮件需先验证收件邮箱。','Alerts appear in your alert centre. Email requires a verified recipient.')}${verified?' ✓':''}${w?.last_finished?' · '+tr('最近查询 ','Last checked ')+time(w.last_finished):''}</p><p class="error" role="alert"></p><button class="primary wide" type="submit">${w?tr('保存设置','Save settings'):tr('开启降价提醒','Enable price alerts')}</button></form>`;
  d.querySelector('form').onsubmit=async event=>{
    event.preventDefault();const form=event.target,button=form.querySelector('[type=submit]'),error=form.querySelector('.error');button.disabled=true;error.textContent='';
    const data=Object.fromEntries(new FormData(form));data.auto_enabled=form.elements.auto_enabled.checked;data.alerts_enabled=form.elements.alerts_enabled.checked;
    try {
      if(w)await request(`/api/watches/${w.id}/settings`,data);
      else await request('/api/watches',{...data,currency:s.currency,trip_type:b?'roundtrip':'oneway',...(b?{return_route:{from:b.from,to:b.to}}:{}),origin:'airport:'+o.from,destinations:['airport:'+o.to],mode:'fixed',start:o.departureTime.slice(0,10),end:(b?.departureTime || o.departureTime).slice(0,10),adults:s.adults,...s.filters});
      if(!isCurrent())return;d.close();toast(tr('降价提醒已保存','Price alerts saved'));await refresh();
    } catch(e){if(isCurrent())error.textContent=e.message;}finally{button.disabled=false;}
  };
  d.showModal();
}
