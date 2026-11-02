import {tr} from './i18n.js';
import {openSettings} from './settings.js';
import {request} from './api.js';
const $ = selector => document.querySelector(selector);
let busy=false;
export function renderEmail(email) {
  const englishStatus=email.configured?'Email service ready':!email.verification_available?'Email unavailable · Web alerts are available':
    ({pending:'Waiting for email verification',confirm:'Waiting for recipient consent',error:'Email verification failed; try again',verified:'Email verified; waiting for email service'})[email.verification] || 'Verify your recipient email to enable delivery';
  $('#email-status').textContent=tr(email.message,englishStatus);
  $('#email-status').className=email.configured?'muted':'muted mail-pending';
  const input=$('#email-recipient'),button=$('#email-verify');
  if(document.activeElement!==input && !input.dataset.dirty) input.value=email.recipient;
  button.hidden=!email.verification_available || email.verification==='verified';
  button.disabled=busy || !!input.dataset.dirty;
  button.textContent=email.verification==='pending'?tr("检查验证结果","Check verification status"):email.verification==='confirm'?tr("发送接收确认邮件","Send consent confirmation email"):email.verification==='error'?tr("重试邮箱验证","Retry email verification"):tr("发送验证邮件","Send verification email");
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
      if(path==='/api/email') {delete $('#email-recipient').dataset.dirty;toast(tr("邮箱已保存","Email saved"));}
      else if(result.email) toast(result.email.verification==='confirm'?tr("请打开接收确认邮件中的链接。","Open the consent confirmation link in your email."):tr("验证状态已更新","Verification status updated"));
      else toast(result.message);
      await refresh();
    } catch(error) {if(sameUser(userId)) $('#email-error').textContent=error.message;}
    finally {busy=false;buttons.forEach(b=>b.disabled=false);if(getState()) renderEmail(getState().email);}
  }
  $('#email-recipient').addEventListener('input',event=>{
    event.target.dataset.dirty='true';$('#email-verify').disabled=true;
  });
  $('#email-form').addEventListener('submit',event=>{event.preventDefault();act('/api/email',{recipient:$('#email-recipient').value});});
  $('#email-verify').addEventListener('click',()=>{
    const phase=getState()?.email.verification;
    act(phase==='pending'?'/api/email/check':'/api/email/verify',{});
  });
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
