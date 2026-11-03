import {currencyLabel} from './currency.js';
import {setupOfferViews} from './offer-views.js';
import {getPreferences,subscribePreferences} from './preferences.js';
import {tr} from './i18n.js';
import {openSettings} from './settings.js';
import {request} from './api.js';
import {dealCards,watchDraft} from './deal_views.js';
const $=s=>document.querySelector(s);
const time=value=>value?new Date(value).toLocaleString(getPreferences().language,{timeZone:'Asia/Shanghai',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}):tr("尚未查询","Not checked yet");
const delivery={get pending(){return tr("等待推送时间","Awaiting delivery time");},get waiting_config(){return tr("等待发信服务启用","Waiting for email service");},get waiting_verification(){return tr("等待收件邮箱验证与确认","Awaiting email verification & consent");},get retry(){return tr("邮件失败，稍后重试","Email failed; retrying later");},get failed(){return tr("邮件发送失败","Email failed");},get sent(){return tr("邮件已发送","Email sent");},get cancelled(){return tr("邮件已取消","Email cancelled");},get skipped(){return tr("邮件已过期，已跳过","Email expired; skipped");},get sending(){return tr("邮件投递中","Sending email");}};

export function dailyCards(offers,adults) {
  return dealCards(offers,offers,adults,true);
}

export function setupDaily(refresh,toast,openWatch,applyPreferences) {
  const offerViews=setupOfferViews($('#daily-offers'));
  const form=$('#daily-form');let formCurrency=getPreferences().currency;let dirty=false,initialized=false,epoch=0,enabled=false,edition;
  function selectView(name) {
    $('#daily-content').hidden=name!=='daily';$('#search-content').hidden=name!=='search';
    document.querySelectorAll('[data-discovery-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.discoveryView===name)));
  }
  document.querySelectorAll('[data-discovery-view]').forEach(b=>b.addEventListener('click',()=>selectView(b.dataset.discoveryView)));
  $('#deals-form').addEventListener('submit',()=>selectView('search'));
  subscribePreferences(()=>{if(formCurrency!==getPreferences().currency){form.elements.budget.value='';formCurrency=getPreferences().currency;dirty=true;}form.elements.budget.closest('label').firstChild.textContent=tr('总预算 · ','Total budget · ')+currencyLabel(formCurrency);});
  $('#daily-settings-open').addEventListener('click',()=>$('#daily-dialog').showModal());
  $('#daily-offers').addEventListener('click',async event=>{
    const button=event.target.closest('[data-daily-watch]');if(!button || !edition) return;
    const offer=edition.offers[Number(button.dataset.dailyWatch)];if(!offer) return;
    button.disabled=true;try {await openWatch(watchDraft(offer,edition.config));} catch(error){toast(error.message);} finally{button.disabled=false;}
  });
  form.addEventListener('input',()=>dirty=true);
  form.addEventListener('change',()=>dirty=true);
  $('#daily-email-settings').addEventListener('click',()=>{$('#daily-dialog').close();openSettings('#email-recipient');});
  form.addEventListener('submit',async event=>{
    event.preventDefault();const button=form.querySelector('[type=submit]'),generation=epoch;
    button.disabled=true;$('#daily-error').textContent='';
    const body={...Object.fromEntries(new FormData(form)),currency:formCurrency};
    body.origins=new FormData(form).getAll('origins');
    body.enabled=form.elements.enabled.checked;body.prefer_red_eye=form.elements.prefer_red_eye.checked;
    try {
      await request('/api/daily',body);
      if(generation!==epoch) return;
      dirty=false;$('#daily-dialog').close();toast(body.enabled?tr("偏好已保存","Preferences saved"):tr("每日推送已暂停","Daily delivery paused"));await refresh();
    } catch(error) {if(generation===epoch) $('#daily-error').textContent=error.message;}
    finally {if(generation===epoch) button.disabled=false;}
  });
  return {
    reset(){offerViews.clear();epoch++;dirty=false;initialized=false;enabled=false;edition=undefined;form.reset();form.querySelector('[type=submit]').disabled=false;$('#daily-error').textContent='';$('#daily-offers').replaceChildren();$('#daily-status').textContent='';$('#daily-settings-open').hidden=true;$('#discovery-views').hidden=true;selectView('search');},
    render(state) {
      $('#daily-settings-open').hidden=!state.daily;$('#discovery-views').hidden=!state.daily;
      if(!state.daily) return;
      const {settings:c,edition:e,next_due}=state.daily;edition=e;
      applyPreferences(c);
      if(!enabled) {selectView('daily');enabled=true;}
      $('#daily-settings-open').textContent=c.enabled?`${tr("每天 ","Daily at ")}${c.push_time}${tr(" 推送 · 修改偏好 ↗"," delivery · Edit preferences ↗")}`:tr("开启每日推送 ↗","Enable daily delivery ↗");
      $('#daily-preference-summary').textContent=`${c.origins.map(o=>o==='airport:HKG'?tr("香港","Hong Kong"):tr("深圳","Shenzhen")).join(' / ')}${tr("出发 · 周末与节假日 · "," · Weekends & holidays · ")}${c.max_leave_days?`${tr("最多请假 ","Leave days: up to ")}${c.max_leave_days}${tr(" 天"," days")}`:tr("不请假","No leave")}${tr(" · 至少玩 "," · Minimum full days: ")}${c.min_full_days}${tr(" 个白天"," full days")}${c.prefer_red_eye?tr(" · 凌晨往返优先"," · Overnight flights preferred"):''}`;
      $('#daily-extra-summary').textContent=`${tr("机场、预算与游玩时间 · ","Airports, budget & time away · ")}${c.budget?`${currencyLabel(c.currency || 'HKD')} ${c.budget}${tr(" 内"," or less")}`:tr("预算不限","No budget limit")}${tr(" · 至少 "," · At least ")}${c.min_full_days}${tr(" 个白天"," full days")}`;
      if(!initialized || !dirty) {
        initialized=true;formCurrency=c.currency || 'HKD';
        form.elements.budget.closest('label').firstChild.textContent=tr('总预算 · ','Total budget · ')+currencyLabel(formCurrency);
        for(const [key,value] of Object.entries(c)) {
          if(key==='origins') {form.querySelectorAll('[name=origins]').forEach(el=>el.checked=value.includes(el.value));continue;}
          const el=form.elements[key];if(!el) continue;
          if(el.type==='checkbox') el.checked=value;else el.value=value;
        }
      }
      $('#daily-next').textContent=c.enabled?`${tr("下次推送 ","Next delivery ")}${time(next_due)}${tr(" · 北京时间"," · Beijing time")}`:tr("每日推荐已暂停","Daily recommendations paused");
      $('#daily-mail-status').textContent=(state.query_enabled===false?tr("当前环境未开启真实查价。","Live price checks are disabled in this environment."):'')+(state.email.configured?`${tr("推送至 ","Delivering to ")}${state.email.recipient}`:state.email.message);
      $('#daily-status').textContent=!e?(c.enabled?`${tr("每天 ","Daily at ")}${c.push_time}${tr(" 更新 · 等待首次查价"," update · Waiting for first check")}`:tr("每日推荐未开启","Daily recommendations off")):e.status==='preparing'?`${e.day}${tr(" 查价中…"," checking…")}`:
        `${e.day} · ${e.status==='error'?tr("本轮查询失败","This round failed"):e.offers.length?`${e.offers.length}${tr(" 个目的地"," destinations")}`:tr("本次无匹配","No matches in these results")} · ${e.failures}/${e.total}${tr(" 组失败 · 最近查询 "," failed groups · Last checked ")}${time(e.checked_at)} · ${delivery[e.mail_status] || ''}`;
      const view=e?.status==='error'?'error':e?.status==='preparing'?'preparing':e?'empty':'initial';
      const copy={initial:[tr("暂无推荐","No recommendations yet"),''],empty:[tr("本次无匹配行程","No matching itinerary in these results"),tr("无匹配不代表无票","No match does not mean no flights")],error:[tr("查询失败","Check failed"),tr("数据源暂不可用，请重试","Flight data unavailable · Retry")],preparing:[tr("查价中…","Checking…"),'']}[view];
      if(e?.status==='ready' && e.offers.length) offerViews.render(e.offers,e.offers,e.config.adults,true,{...e.config,checked_at:e.checked_at || e.completed_at});
      else {offerViews.clear();$('#daily-offers').innerHTML=`<div class="discovery-empty"><div><h3>${copy[0]}</h3>${copy[1]?`<p>${copy[1]}</p>`:''}</div><div class="empty-route" aria-hidden="true"><span>周末</span><img src="/assets/airplane-tilt.svg" alt=""><span>远方</span></div></div>`;}
    }
  };
}
