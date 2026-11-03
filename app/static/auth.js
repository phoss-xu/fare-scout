import {tr} from './i18n.js';
import {request, setCsrf} from './api.js';
const $ = selector => document.querySelector(selector);
let mode = 'login', authMode='password';
let setupToken = new URLSearchParams(location.hash.slice(1)).get('token');
if (setupToken) history.replaceState(null, '', '/setup');
let callback;

function chooseMode(next, preserve=false) {
  mode = next;
  const register = mode === 'register';
  const setup = mode === 'activate';
  $('#auth-name-field').hidden = !register;
  $('#auth-email-field').hidden = setup;
  $('#auth-email').required = !setup;
  $('#auth-name').required = register;
  $('#auth-password').minLength = mode === 'login' ? 1 : 6;
  $('#auth-password').autocomplete = mode === 'login' ? 'current-password' : 'new-password';
  if(!preserve) $('#auth-password').value = '';
  $('#auth-mode-label').textContent = setup ? 'YOUR ACCOUNT' : register ? 'YOUR NEXT CHAPTER' : 'WELCOME BACK';
  $('#auth-title').textContent = setup ? tr("为账号设置密码","Set your account password") : register ? tr("创建账号","Create account") : tr("欢迎回来","Welcome back");
  $('#auth-submit').textContent = setup ? tr("设置密码","Set password") : register ? tr("创建账号","Create account") : tr("登录","Sign in");
  $('#auth-hint').textContent = setup || register ? tr("至少 6 位密码","Password: 6+ characters") : '';
  $('#auth-switch').hidden = setup;
  $('#auth-switch').textContent = register ? tr("返回登录","Back to sign in") : tr("创建账号","Create account");
  if(!preserve) $('#auth-error').textContent = '';
  $('.auth-footer').hidden = true;
  $('#auth-hint').hidden = !$('#auth-hint').textContent;
  if(authMode==='passkey') {
    $('#auth-password').closest('label').hidden=true;
    $('#auth-password').required=false;
    $('#auth-email-field').hidden=!register;
    $('#auth-email').required=register;
    $('#auth-submit').textContent=register?tr("创建通行密钥","Create passkey"):tr("通行密钥登录","Sign in with passkey");
    $('#auth-hint').textContent=register?tr("使用指纹、面容或设备 PIN","Use your fingerprint, face or device PIN"):'';
    $('#auth-hint').hidden = !register;
    $('.auth-footer').hidden = !register;
    $('.auth-footer').textContent=tr("请保存通行密钥 · 暂不支持找回","Keep your passkey · No account recovery yet");
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
  document.addEventListener('languagechange',()=>chooseMode(mode,true));
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
    $('#auth-error').textContent = tr("服务连接失败，请刷新重试。","Cannot reach the service. Refresh and try again.");
  }
}
