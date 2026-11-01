import {request, setCsrf} from './api.js';
const $ = selector => document.querySelector(selector);
let mode = 'login';
let setupToken = new URLSearchParams(location.hash.slice(1)).get('token');
if (setupToken) history.replaceState(null, '', '/setup');
let callback;

function chooseMode(next) {
  mode = next;
  const register = mode === 'register';
  const setup = mode === 'activate';
  $('#auth-name-field').hidden = !register;
  $('#auth-email-field').hidden = setup;
  $('#auth-email').required = !setup;
  $('#auth-name').required = register;
  $('#auth-password').minLength = mode === 'login' ? 1 : 6;
  $('#auth-password').autocomplete = mode === 'login' ? 'current-password' : 'new-password';
  $('#auth-password').value = '';
  $('#auth-title').textContent = setup ? '给你的出行雷达，一把钥匙' : register ? '开启自己的出行雷达' : '欢迎回来，下一程在等你';
  $('#auth-submit').textContent = setup ? '设置密码并进入 ↗' : register ? '创建账号 ↗' : '登录我的雷达 ↗';
  $('#auth-hint').textContent = setup ? '为已有账号设置至少 6 个字符的密码，原有监控与价格记录会保留。' : register ? '昵称、出行监控和提醒设置会保存在你的账号下。密码至少 6 个字符。' : '登录后，查看你的监控、价格记录与专属提醒。';
  $('#auth-switch').hidden = setup;
  $('#auth-switch').textContent = register ? '已有账号？去登录' : '第一次来？创建账号';
  $('#auth-error').textContent = '';
}

export function showSession(session) {
  const user = session?.user;
  setCsrf(session?.csrf_token);
  document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close());
  $('#workspace').hidden = !user;
  $('#auth-view').hidden = Boolean(user);
  $('#account-bar').hidden = !user;
  $('#account-name').textContent = user?.name || '';
  $('#account-name').title = user?.email || '';
  if (!user) chooseMode(setupToken ? 'activate' : 'login');
  callback?.(user);
}

export async function setupAuth(onChange) {
  callback = onChange;
  $('#auth-switch').addEventListener('click', () => chooseMode(mode === 'login' ? 'register' : 'login'));
  $('#auth-form').addEventListener('submit', async event => {
    event.preventDefault();
    const button = $('#auth-submit');
    button.disabled = true;
    $('#auth-error').textContent = '';
    try {
      const data = Object.fromEntries(new FormData(event.target));
      if (setupToken) data.token = setupToken;
      const session = await request(`/api/auth/${mode}`, data);
      setupToken = null;
      $('#auth-password').value = '';
      history.replaceState(null, '', '/');
      showSession(session);
    } catch (error) { $('#auth-error').textContent = error.message; }
    finally { button.disabled = false; }
  });
  $('#logout').addEventListener('click', async () => {
    const button = $('#logout');
    button.disabled = true;
    try { await request('/api/auth/logout', {}); showSession(null); }
    catch (error) { $('#account-error').textContent = error.message; }
    finally { button.disabled = false; }
  });
  try {
    const session = await request('/api/auth/session');
    if (setupToken && !session.user) chooseMode('activate');
    showSession(session);
  } catch {
    showSession(null);
    $('#auth-error').textContent = '暂时连接不上服务，请刷新页面重试。';
  }
}
