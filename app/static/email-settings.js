import {tr} from './i18n.js';
import {openSettings} from './settings.js';
import {request} from './api.js';
const $ = selector => document.querySelector(selector);
let busy=false;
export function renderEmail(email) {
  $('#email-status').textContent=tr(email.message,!email.verification_available?'Email verification is unavailable. Contact the administrator.':email.verification==='verified'?'Email verified':email.verification==='pending'?'Verification email sent. Open the link in your email.':'Email not verified');
  $('#email-status').className=email.configured?'muted':'muted mail-pending';
  const input=$('#email-recipient'),button=$('#email-form [type=submit]');
  if(document.activeElement!==input && !input.dataset.dirty) input.value=email.recipient;
  button.disabled=busy || !email.verification_available || (email.verification==='verified' && !input.dataset.dirty);
  button.textContent=email.verification==='verified' && !input.dataset.dirty?tr('已验证','Verified'):email.verification==='pending' && !input.dataset.dirty?tr('重新发送验证链接','Resend verification link'):tr('发送验证链接','Send verification link');

}
export function setupEmail(getState,refresh,toast) {
  const sameUser=id=>getState()?.user.id===id;
  async function act(path,body) {
    if(busy) return;
    const userId=getState()?.user.id;if(!userId) return;
    busy=true;$('#email-error').textContent='';
    const buttons=$('#email-form').querySelectorAll('button');buttons.forEach(b=>b.disabled=true);
    try {
      const result=await request(path,body);
      if(!sameUser(userId)) return;
      if(result.email) {delete $('#email-recipient').dataset.dirty;toast(result.email.verification==='verified'?tr('邮箱已验证','Email verified'):tr('验证邮件已发送','Verification email sent'));}
      else toast(result.message);
      await refresh();
    } catch(error) {if(sameUser(userId)) $('#email-error').textContent=error.message;}
    finally {busy=false;buttons.forEach(b=>b.disabled=false);if(getState()) renderEmail(getState().email);}
  }
  $('#email-recipient').addEventListener('input',event=>{
    event.target.dataset.dirty='true';if(getState()) renderEmail(getState().email);
  });
  $('#email-form').addEventListener('submit',event=>{event.preventDefault();act('/api/email/verify',{recipient:$('#email-recipient').value});});
  // The secret stays in the fragment, never in HTTP URLs or server access logs.
  // Confirmation requires the same signed-in user and CSRF, so email scanners cannot activate it.
  const fragment=new URLSearchParams(location.hash.slice(1)),value=fragment.get('email-confirm');
  if(value) {
    history.replaceState(null,'',location.pathname+location.search);
    let timer;
    const confirm=()=>{
      if(!getState()) return;
      clearInterval(timer);
      openSettings('#email-recipient');act('/api/email/confirm',{token:value});
    };
    timer=setInterval(confirm,1000);confirm();
  }
}
