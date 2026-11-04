import {icon,setIconButton} from './ui-icons.js';
import {tr} from './i18n.js';
import {request, setCsrf} from './api.js';
import {setupLocalPasskeys} from './local-passkeys.js';
import {setupPasswordConfirmation} from './password-confirmation.js';
import {setupAuthMotion} from './auth-motion.js';
import {setupAuthFilms} from './auth-films.js';
const $ = selector => document.querySelector(selector);
let mode = 'login', authMode='password', availableMethods=['password'], localPasswordRecovery=false;
let setupToken = new URLSearchParams(location.hash.slice(1)).get('token');
if (setupToken) history.replaceState(null, '', '/setup');
let callback;
const confirmation=setupPasswordConfirmation($('#auth-password'),$('#auth-password-confirm'),$('#auth-confirm-error'));
const motion=setupAuthMotion();
setupAuthFilms();
$('.auth-card').append($('.auth-journey'));
const localPasskeys=setupLocalPasskeys(completeSession,{start:()=>motion.start(),fail:()=>motion.fail(),end:()=>motion.end()});
async function completeSession(session) {
  if(session?.user) await motion.success();
  showSession(session);
  if(session?.user) document.querySelector('#workspace [role=tab][aria-selected=true]')?.focus({preventScroll:true});
}
const recovery=document.createElement('details');
recovery.className='auth-recovery';
$('#auth-switch').after(recovery);
function recoveryHelp() {
  recovery.hidden=!localPasswordRecovery || authMode!=='password' || mode!=='login';
  recovery.replaceChildren();
  const summary=document.createElement('summary'),text=document.createElement('p'),command=document.createElement('code');
  summary.textContent=tr('忘记密码？','Forgot password?');
  text.textContent=tr('本地账号：在本项目终端运行下方命令，将邮箱替换为你的登录邮箱，然后打开生成的一次性链接设置新密码。原有行程保留。','Local account: run this command in the project terminal with your sign-in email, then open the one-time link to set a new password. Your trips are preserved.');
  command.textContent=`python3 -m app.accounts reset-password-link you@example.com --port ${location.port || '8765'}`;
  recovery.append(summary,text,command);
}


function chooseMode(next, preserve=false) {
  mode = next;
  $('#auth-view').dataset.authMode=authMode;
  $('#auth-view').dataset.formMode=mode;
  recoveryHelp();
  localPasskeys.mode(mode);
  const register = mode === 'register';
  const setup = mode === 'activate';
  $('#auth-method-switch').hidden=availableMethods.length<2 || mode==='activate';
  $('#auth-method-switch').textContent=mode==='register'
    ? authMode==='passkey'?tr('改用邮箱密码','Use email and password'):tr('改用通行密钥','Use a passkey')
    : authMode==='passkey'?tr('邮箱密码登录','Email and password'):tr('通行密钥登录','Use a passkey');
  $('#auth-password').closest('label').hidden=authMode==='passkey';
  $('#auth-password').required=authMode==='password';
  confirmation.mode(authMode==='password' && (register || setup),preserve);
  $('#auth-name-field').hidden = !register;
  $('#auth-remember-row').hidden = mode !== 'login';
  $('#auth-email-field').hidden = setup;
  $('#auth-email').required = !setup;
  $('#auth-name').required = register;
  $('#auth-password').minLength = mode === 'login' ? 1 : 6;
  $('#auth-password').autocomplete = mode === 'login' ? 'current-password' : 'new-password';
  if(!preserve) $('#auth-password').value = '';
  $('#auth-mode-label').textContent = setup ? 'YOUR ACCOUNT' : register ? 'YOUR NEXT CHAPTER' : 'WELCOME BACK';
  $('#auth-title').textContent = setup ? tr("为账号设置密码","Set your account password") : register ? tr("创建账号","Create account") : tr("登录","Sign in");
  $('#auth-submit').textContent = setup ? tr("设置密码","Set password") : register ? tr("创建账号","Create account") : tr("登录","Sign in");
  $('#auth-hint').textContent = setup || register ? tr("至少 6 位密码","Password: 6+ characters") : '';
  $('#auth-switch').hidden = setup;
  $('#auth-switch').textContent = register ? tr("返回登录","Back to sign in") : tr("注册","Register");
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
  setIconButton($('#auth-submit'),setup?'key':register?'userPlus':authMode==='passkey'?'fingerprint':'login');
  setIconButton($('#auth-method-switch'),authMode==='passkey'?'mail':'fingerprint');
  setIconButton($('#auth-switch'),register?'back':'userPlus');
  const remember=$('#auth-remember-row');
  if(!remember.querySelector('svg')) remember.insertAdjacentHTML('beforeend',icon('clock'));
  if(preserve) motion.sync();else motion.reset();
}

export function showSession(session) {
  if(session?.auth_methods) availableMethods=session.auth_methods.filter(method=>['passkey','password'].includes(method));
  else if(session?.auth_mode) availableMethods=[session.auth_mode];
  if(session?.auth_mode==='mixed') {if(setupToken) authMode='password';else if(!availableMethods.includes(authMode) || authMode==='password') authMode='passkey';}
  else authMode=session?.auth_mode || authMode;
  localPasswordRecovery=session?.local_passkeys===true;
  const user = session?.user;
  localPasskeys.session(session);
  setCsrf(session?.csrf_token);
  document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close());
  $('#workspace').hidden = !user;
  $('#auth-view').hidden = Boolean(user);
  $('#account-bar').hidden = !user;
  $('#account-bar').open = false;
  $('#account-error').textContent = '';
  $('#account-name').textContent = user?.name || '';
  $('#account-name').title = user?.email || '';
  if (!user) {chooseMode(setupToken ? 'activate' : 'login');motion.reset();}
  callback?.(user);
}

export async function setupAuth(onChange) {
  callback = onChange;
  document.addEventListener('languagechange',()=>chooseMode(mode,true));
  $('#auth-method-switch').addEventListener('click',()=>{
    if(motion.busy) return;
    authMode=authMode==='passkey'?'password':'passkey';chooseMode(mode);
  });
  $('#auth-submit').disabled=true;
  $('#auth-switch').disabled=true;
  $('#auth-switch').addEventListener('click', () => chooseMode(mode === 'login' ? 'register' : 'login'));
  $('#auth-form').addEventListener('submit', async event => {
    event.preventDefault();
    if(motion.busy || !confirmation.check()) return;
    $('#auth-error').textContent = '';
    try {
      const data = Object.fromEntries(new FormData(event.target));
      delete data.password_confirmation;
      data.remember = $('#auth-remember').checked;
      if (setupToken) data.token = setupToken;
      motion.start(mode);
      const session = authMode==='passkey'
        ? await (await import('./passkey_auth.js')).passkeySession(mode,event.target)
        : await request(`/api/auth/${mode}`, data);
      setupToken = null;
      $('#auth-password').value = '';
      confirmation.clear();
      const sharedTrip=new URLSearchParams(location.search).get('trip');
      history.replaceState(null, '', sharedTrip?'/?trip='+encodeURIComponent(sharedTrip):'/');
      await completeSession(session);
    } catch (error) { $('#auth-error').textContent = error.message; motion.fail(); }
    finally { motion.end(); }
  });
  const account = $('#account-bar');
  document.addEventListener('click', event => {
    if (!account.contains(event.target)) account.open = false;
  });
  account.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      account.open = false;
      account.querySelector('summary').focus();
    }
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
