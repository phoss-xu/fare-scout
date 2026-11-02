import {request} from './api.js';
import {escape, money, time} from './views.js';
const $ = selector => document.querySelector(selector);
const delivery = {pending:'邮件排队中', waiting_config:'等待发信配置', retry:'邮件发送失败，稍后重试',
  failed:'邮件发送失败，已停止重试', cancelled:'邮件已取消', sent:'邮件已发送', skipped:'邮件已跳过（已过期或提醒已关闭）'};

function link(value) {
  try {
    const url = new URL(value);
    if (url.protocol === 'https:') return `<a class="small-btn" href="${escape(url.href)}" target="_blank" rel="noopener noreferrer">前往核价 ↗</a>`;
  } catch { /* Missing links do not prevent showing the saved alert. */ }
  return '<span class="muted">暂无核价链接</span>';
}

export function renderAutomation(state) {
  $('#alert-count').textContent = state.alerts.filter(a => !a.read_at).length;
  $('#read-alerts').disabled = !state.alerts.some(a => !a.read_at);
  $('#email-status').textContent = state.email.message;
  $('#email-status').className = state.email.configured ? 'muted' : 'muted mail-pending';
  const input = $('#email-recipient');
  if (document.activeElement !== input && !input.dataset.dirty) input.value = state.email.recipient;
  $('#alerts').innerHTML = state.alerts.map(a => {
    const w = state.watches.find(w => w.id === a.watch_id);
    const route = a.route_key ? JSON.parse(a.route_key) : [];
    const drop = a.previous_price == null ? '' : `较上次有效报价下降 HK$${money(a.previous_price - a.price)}`;
    return `<article class="card alert-card ${a.read_at ? '' : 'unread'}"><div class="card-top"><span class="badge">${a.reason === 'budget' ? '进入你的预算' : '发现降价'}${a.read_at ? ' · 已读' : ' · 未读'}</span><span class="muted">${time(a.created_at)}</span></div><h3>${escape(route[0] || w.origin)} <span class="arrow">↗</span> ${escape(state.destinations[a.destination])}</h3><p class="trip-dates">${a.departure} — ${a.arrival}${w.mode === 'weekend' ? ' 返程抵达' : ' 返程起飞'}</p><div class="price"><small>HK$</small> ${money(a.price)}<span> / ${w.adults} 人往返</span></div><p class="muted">${drop || '首次采样已在预算内'}</p><p class="muted">${delivery[a.email_status] || '邮件尚未排队'}</p><div class="card-bottom"><span class="muted">采样报价，预订前请核价</span>${link(a.booking_url)}</div></article>`;
  }).join('') || '<div class="empty"><span class="empty-icon">↘</span><h3>有好价格时，这里会告诉你</h3><p>同一行程达到降价门槛，或首次进入预算时生成提醒。首次采样不会被当作降价。</p></div>';
}

export function setupAutomation(getState, refresh, toast) {
  document.addEventListener('click', event => {
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
      toast('自动查价与提醒设置已保存。');
      await refresh();
    } catch (error) { $('#settings-error').textContent = error.message; }
    finally { button.disabled = false; }
  });
  $('#read-alerts').addEventListener('click', async () => {
    const ids = getState().alerts.map(a => a.id);
    if (!ids.length) return;
    try { await request('/api/alerts/read', {through_id:Math.max(...ids)}); await refresh(); }
    catch (error) { toast(error.message); }
  });
  $('#email-recipient').addEventListener('input', event => event.target.dataset.dirty = 'true');
  $('#email-form').addEventListener('submit', async event => {
    event.preventDefault();
    const button = event.target.querySelector('[type=submit]');
    button.disabled = true;
    $('#email-error').textContent = '';
    try {
      await request('/api/email', {recipient:$('#email-recipient').value});
      delete $('#email-recipient').dataset.dirty;
      toast('收件邮箱已保存。');
      await refresh();
    } catch (error) { $('#email-error').textContent = error.message; }
    finally { button.disabled = false; }
  });
}
