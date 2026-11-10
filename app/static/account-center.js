import {renderAvatar,setupAvatar} from './account-avatar.js';
import {request} from './api.js';
import {tr} from './i18n.js';
const $=s=>document.querySelector(s);
let user=null,active='preferences',snapshot=null;
const labels=()=>({profile:tr('个人资料','Profile'),preferences:tr('偏好设置','Preferences'),notifications:tr('通知','Notifications'),security:tr('安全与登录','Security & sign-in')});
export function selectCenter(name='preferences') {
  active=!user && name!=='preferences'?'preferences':name;
  document.querySelectorAll('[data-center-panel]').forEach(p=>p.hidden=p.dataset.centerPanel!==active);
  document.querySelectorAll('.center-navigation [data-center-view]').forEach(b=>{if(b.dataset.centerView===active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
  $('#appearance-title').textContent=labels()[active];
  $('.center-main').scrollTop=0;
}
export function renderCenter(state) {
  snapshot=state;
  const changed=user?.id!==state?.user?.id;user=state?.user || null;
  document.querySelectorAll('[data-center-auth]').forEach(e=>e.hidden=!user);
  $('#appearance-open').hidden=!!user;
  $('#center-name').textContent=user?.name || '';
  const initial=[...(user?.name || '')][0] || '';
  $('#center-avatar').textContent=initial;$('#account-avatar').textContent=initial;
  $('#center-login-email').textContent=user?.email || '';
  const email=state?.email;
  $('#center-email-state').textContent=email?`${email.recipient} · ${email.verification==='verified'?tr('已验证','Verified'):tr('待验证','Unverified')}`:'';
  renderAvatar(state);
  if(user) $('#account-name').textContent=user.name;
  if(changed){$('#center-profile-form').reset();$('#center-profile-form').hidden=true;$('#center-profile-error').textContent='';selectCenter('preferences');}
}
export function setupCenter(refresh) {
  setupAvatar(refresh);
  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-center-view]');if(!button)return;
    $('#account-bar').open=false;
    if(!$('#appearance-dialog').open) $('#appearance-open').click();
    selectCenter(button.dataset.centerView);
  });
  $('#appearance-open').addEventListener('click',()=>selectCenter('preferences'));
  $('#center-edit-name').onclick=()=>{const form=$('#center-profile-form');form.hidden=!form.hidden;if(!form.hidden){form.elements.name.value=user?.name || '';form.elements.name.focus();}};
  $('#center-profile-form').onsubmit=async event=>{
    event.preventDefault();if(!user)return;const owner=user.id,form=event.target,button=form.querySelector('button');button.disabled=true;$('#center-profile-error').textContent='';
    try{await request('/api/profile',{name:form.elements.name.value});if(user?.id!==owner)return;form.hidden=true;await refresh();}
    catch(error){if(user?.id===owner)$('#center-profile-error').textContent=error.message;}
    finally{button.disabled=false;}
  };
  $('#center-logout').onclick=()=>{$('#appearance-dialog').close();$('#logout').click();};
  $('#center-release').onclick=()=>{$('#appearance-dialog').close();$('#changelog-open').click();};
  document.addEventListener('languagechange',()=>{renderCenter(snapshot);selectCenter(active);});
}
