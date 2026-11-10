import {setIconButton} from './ui-icons.js';
import {request} from './api.js';
import {tr} from './i18n.js';

/** Local password accounts can add passkeys without changing cloud sign-in. */
export function setupLocalPasskeys(signedIn, lifecycle={}) {
  let enabled=false,user,mode='login';
  const login=document.createElement('button');login.type='button';login.className='small-btn local-passkey-login';login.hidden=true;
  document.querySelector('#auth-form').after(login);
  const section=document.createElement('details');section.className='settings-section';section.id='settings-passkeys';section.hidden=true;
  document.querySelector('[data-center-panel=security]').append(section);
  const summary=document.createElement('summary');summary.className='settings-summary';
  const icon=document.createElement('span'),titleWrap=document.createElement('span'),title=document.createElement('strong'),chevron=document.createElement('span');
  icon.className='settings-symbol';icon.textContent='⚿';icon.setAttribute('aria-hidden','true');
  chevron.className='settings-chevron';chevron.textContent='⌄';chevron.setAttribute('aria-hidden','true');
  titleWrap.append(title);summary.append(icon,titleWrap,chevron);
  const content=document.createElement('div');content.className='settings-content';
  const description=document.createElement('p'),add=document.createElement('button'),status=document.createElement('p'),list=document.createElement('div');
  description.className='appearance-hint';
  add.type='button';add.className='small-btn';status.setAttribute('role','status');status.className='form-hint';
  content.append(description,add,status,list);section.append(summary,content);
  function render() {
    login.hidden=!enabled || mode!=='login' || !!user;
    section.hidden=!enabled || !user;
    setIconButton(login,'fingerprint',tr('使用通行密钥登录','Sign in with passkey'));
    title.textContent=tr('登录与通行密钥','Sign-in & passkeys');
    description.textContent=tr('绑定后可用指纹、面容或设备 PIN 登录。建议在另一台设备或密码管理器保留备用通行密钥；仍可使用密码和本机恢复入口。','Use your fingerprint, face or device PIN to sign in. Keep a backup passkey on another device or in your password manager. Password sign-in and local recovery remain available.');
    add.textContent=tr('添加通行密钥','Add passkey');
  }
  async function supported() {
    if(location.hostname!=='localhost') throw new Error(tr(`请打开 http://localhost:${location.port}，登录后绑定通行密钥。`,`Open http://localhost:${location.port}, then sign in to add a passkey.`));
    const api=await import('./vendor/passkeys.js');
    if(!isSecureContext || !api.browserSupportsWebAuthn()) throw new Error(tr('浏览器不支持通行密钥，请使用最新版浏览器。','This browser does not support passkeys. Use an up-to-date browser.'));
    return api;
  }
  function friendly(error) {
    return ['NotAllowedError','AbortError'].includes(error.cause?.name || error.name)
      ? tr('设备验证已取消或超时。你仍可使用密码登录。','Device verification was cancelled or timed out. You can still sign in with your password.')
      : error.message;
  }
  async function load() {
    if(!enabled || !user || location.hostname!=='localhost') return;
    const data=await request('/api/auth/passkey/list',{});list.replaceChildren();
    if(!data.keys.length) {list.textContent=tr('尚未绑定通行密钥。','No passkeys added yet.');return;}
    for(const key of data.keys) {
      const row=document.createElement('p'),label=document.createElement('span'),remove=document.createElement('button');
      label.textContent=tr('通行密钥 · 添加于 ','Passkey · Added ')+new Date(key.created_at).toLocaleDateString();
      remove.type='button';remove.className='text-btn';remove.textContent=tr('移除','Remove');
      remove.addEventListener('click',async()=>{
        remove.disabled=true;
        try {await request('/api/auth/passkey/remove',{id:key.credential_id});await load();status.textContent=tr('已移除，仍可用密码登录。','Removed. You can still sign in with your password.');}
        catch(error) {status.textContent=friendly(error);remove.disabled=false;}
      });
      row.append(label,' ',remove);list.append(row);
    }
  }
  login.addEventListener('click',async()=>{
    lifecycle.start?.();
    login.disabled=true;const errorBox=document.querySelector('#auth-error');errorBox.textContent='';
    try {
      const api=await supported(),{options}=await request('/api/auth/passkey/login/options',{});
      const response=await api.startAuthentication({optionsJSON:options});
      await signedIn(await request('/api/auth/passkey/login/verify',{response,remember:document.querySelector('#auth-remember').checked}));
    } catch(error) {errorBox.textContent=friendly(error);lifecycle.fail?.();}
    finally {lifecycle.end?.();login.disabled=false;}
  });
  add.addEventListener('click',async()=>{
    add.disabled=true;status.textContent='';
    try {
      const api=await supported(),{options}=await request('/api/auth/passkey/bind/options',{});
      const response=await api.startRegistration({optionsJSON:options});
      await request('/api/auth/passkey/bind/verify',{response});await load();
      status.textContent=tr('已绑定，下次可直接使用通行密钥登录。','Passkey added. Use it next time you sign in.');
    } catch(error) {status.textContent=friendly(error);}
    finally {add.disabled=false;}
  });
  section.addEventListener('toggle',()=>{if(section.open)load().catch(error=>{status.textContent=friendly(error);});});
  document.addEventListener('languagechange',render);
  return {
    mode(next){mode=next;render();},
    session(session){if(session)enabled=session.local_passkeys===true;user=session?.user;list.replaceChildren();status.textContent='';render();}
  };
}
