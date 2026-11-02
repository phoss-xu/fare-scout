import {request, setCsrf} from './api.js';
const $ = selector => document.querySelector(selector);
let mode = 'login', authMode='password';
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
  $('#auth-mode-label').textContent = setup ? 'YOUR ACCOUNT' : register ? 'YOUR NEXT CHAPTER' : 'WELCOME BACK';
  $('#auth-title').textContent = setup ? '为账号设置密码' : register ? '创建账号' : '欢迎回来';
  $('#auth-submit').textContent = setup ? '设置密码' : register ? '创建账号' : '登录';
  $('#auth-hint').textContent = setup || register ? '密码至少 6 个字符' : '';
  $('#auth-switch').hidden = setup;
  $('#auth-switch').textContent = register ? '返回登录' : '创建账号';
  $('#auth-error').textContent = '';
  $('.auth-footer').hidden = true;
  $('#auth-hint').hidden = !$('#auth-hint').textContent;
  if(authMode==='passkey') {
    $('#auth-password').closest('label').hidden=true;
    $('#auth-password').required=false;
    $('#auth-email-field').hidden=!register;
    $('#auth-email').required=register;
    $('#auth-submit').textContent=register?'创建通行密钥':'通行密钥登录';
    $('#auth-hint').textContent=register?'使用指纹、面容或设备 PIN':'';
    $('#auth-hint').hidden = !register;
    $('.auth-footer').hidden = !register;
    $('.auth-footer').textContent='请妥善保存通行密钥，目前不支持账号找回。';
  }
}

export function showSession(session) {
  authMode=session?.auth_mode || authMode;
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
  $('#auth-submit').disabled=true;
  $('#auth-switch').disabled=true;
  $('#auth-switch').addEventListener('click', () => chooseMode(mode === 'login' ? 'register' : 'login'));
  $('#auth-form').addEventListener('submit', async event => {
    event.preventDefault();
    const button = $('#auth-submit');
    button.disabled = true;
    $('#auth-error').textContent = '';
    try {
      const data = Object.fromEntries(new FormData(event.target));
      if (setupToken) data.token = setupToken;
      const session = authMode==='passkey'
        ? await (await import('./passkey_auth.js')).passkeySession(mode,event.target)
        : await request(`/api/auth/${mode}`, data);
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
    if(session.auth_mode==='passkey') setupToken=null;
    if (setupToken && !session.user) chooseMode('activate');
    showSession(session);
    $('#auth-submit').disabled=false;
    $('#auth-switch').disabled=false;
  } catch {
    showSession(null);
    $('#auth-error').textContent = '服务连接失败，请刷新重试。';
  }
}
