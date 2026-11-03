import {tr} from './i18n.js';
import {price} from './format.js';
import {request} from './api.js';
import {renderEmail,setupEmail} from './email-settings.js';
import {escape, money, time} from './views.js';
const $ = selector => document.querySelector(selector);
const delivery = {get pending(){return tr("邮件排队中","Email queued");}, get waiting_config(){return tr("等待发信配置","Waiting for email configuration");}, get waiting_verification(){return tr("等待收件邮箱验证与确认","Awaiting email verification & consent");}, get retry(){return tr("邮件发送失败，稍后重试","Email failed; retrying later");},
  get failed(){return tr("邮件发送失败，已停止重试","Email failed; retries exhausted");}, get cancelled(){return tr("邮件已取消","Email cancelled");}, get sent(){return tr("邮件已发送","Email sent");}, get skipped(){return tr("邮件已跳过（已过期或提醒已关闭）","Email skipped (expired or alerts off)");}};

function link(value) {
  try {
    const url = new URL(value);
    if (url.protocol === 'https:') return `<a class="small-btn" href="${escape(url.href)}${tr("\" target=\"_blank\" rel=\"noopener noreferrer\">前往核价 ↗</a>","\" target=\"_blank\" rel=\"noopener noreferrer\">Check price ↗</a>")}`;
  } catch { /* Missing links do not prevent showing the saved alert. */ }
  return tr("<span class=\"muted\">暂无核价链接</span>","<span class=\"muted\">No booking link available</span>");
}

let alertOwner,olderAlerts=[],olderDestinations={},olderCursor;
export function renderAutomation(state) {
  if(alertOwner!==state.user?.id) {alertOwner=state.user?.id;olderAlerts=[];olderDestinations={};olderCursor=undefined;}
  const alerts=[...new Map([...olderAlerts,...state.alerts].map(a=>[a.id,a])).values()].filter(a=>state.watches.some(w=>w.id===a.watch_id)).sort((a,b)=>b.id-a.id);
  const destinations={...olderDestinations,...state.destinations};
  $('#alert-count').textContent = state.alert_page?.unread ?? state.alerts.filter(a => !a.read_at).length;
  $('#read-alerts').disabled = !(state.alert_page?.unread ?? state.alerts.filter(a=>!a.read_at).length);
  renderEmail(state.email);
  $('#alerts').innerHTML = alerts.map(a => {
    const w = state.watches.find(w => w.id === a.watch_id);
    const route = a.route_key ? JSON.parse(a.route_key) : [];
    const drop = a.previous_price == null ? '' : `${tr("降价 HK$","Price drop HK$")}${money(a.previous_price - a.price)}`;
    return `<article class="card alert-card ${a.read_at ? '' : 'unread'}"><div class="card-top"><span class="badge">${a.reason === 'budget' ? tr("进入你的预算","Within your budget") : tr("发现降价","Price drop")}${a.read_at ? tr(" · 已读"," · Read") : tr(" · 未读"," · Unread")}</span><span class="muted">${time(a.created_at)}</span></div><h3>${escape(route[0] || w.origin)} <span class="arrow">↗</span> ${escape(destinations[a.destination])}</h3><p class="trip-dates">${a.departure} — ${a.arrival}${w.mode === 'weekend' ? tr(" 返程抵达"," return arrival") : tr(" 返程起飞"," return departure")}</p><div class="price">${price(a.price)}<span> / ${w.adults}${tr(" 人往返</span></div><p class=\"muted\">"," travellers, return</span></div><p class=\"muted\">")}${drop || tr("首次采样已在预算内","First observed fare is within budget")}</p><p class="muted">${delivery[a.email_status] || tr("邮件尚未排队","Email not queued yet")}${tr("</p><div class=\"card-bottom\"><span class=\"muted\">预订前核价</span>","</p><div class=\"card-bottom\"><span class=\"muted\">Confirm price before booking</span>")}${link(a.booking_url)}</div></article>`;
  }).join('') || tr("<div class=\"empty\"><span class=\"empty-icon\">↘</span><h3>暂无提醒</h3></div>","<div class=\"empty\"><span class=\"empty-icon\">↘</span><h3>No alerts yet</h3></div>");
  if((olderCursor===undefined?state.alert_page?.next_before:olderCursor)) $('#alerts').insertAdjacentHTML('beforeend',`<button type="button" class="small-btn" data-alerts-more>${tr('加载更早的提醒','Load earlier alerts')}</button>`);
}

export function setupAutomation(getState, refresh, toast) {
  document.addEventListener('click', async event => {
    const more=event.target.closest('[data-alerts-more]');
    if(more) {
      const state=getState(),owner=state.user.id,cursor=olderCursor===undefined?state.alert_page?.next_before:olderCursor;
      more.disabled=true;
      try {
        const page=await request('/api/alerts?before='+cursor);
        if(getState()?.user.id!==owner) return;
        olderAlerts=[...olderAlerts,...state.alerts,...page.alerts];olderDestinations={...olderDestinations,...state.destinations,...page.destinations};olderCursor=page.next_before;renderAutomation(getState());
      } catch(error) {toast(error.message);more.disabled=false;}
      return;
    }
    const settings = event.target.closest('[data-settings]');
    if (!settings) return;
    const w = getState().watches.find(w => w.id === Number(settings.dataset.settings));
    const form = $('#settings-form');
    form.elements.watch_id.value = w.id;
    form.elements.auto_enabled.checked = w.auto_enabled;
    form.elements.alerts_enabled.checked = w.alerts_enabled;
    form.elements.interval_hours.value = w.interval_hours;
    form.elements.min_drop.value = w.min_drop;
    $('#settings-error').textContent = '';
    $('#settings-dialog').showModal();
  });
  $('#settings-form').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.target;
    const button = form.querySelector('[type=submit]');
    button.disabled = true;
    try {
      await request(`/api/watches/${form.elements.watch_id.value}/settings`, {
        auto_enabled:form.elements.auto_enabled.checked, alerts_enabled:form.elements.alerts_enabled.checked,
        interval_hours:form.elements.interval_hours.value, min_drop:form.elements.min_drop.value,
      });
      $('#settings-dialog').close();
      toast(tr("设置已保存","Settings saved"));
      await refresh();
    } catch (error) { $('#settings-error').textContent = error.message; }
    finally { button.disabled = false; }
  });
  $('#read-alerts').addEventListener('click', async () => {
    const ids = getState().alerts.map(a => a.id);
    if (!ids.length) return;
    try { await request('/api/alerts/read', {through_id:Math.max(...ids)});olderAlerts=[];olderCursor=undefined;await refresh(); }
    catch (error) { toast(error.message); }
  });
  setupEmail(getState,refresh,toast);
}
