import {first,batch,seconds,ensure} from './db.js';
import {requestConsent} from './email-consent.js';
import {digest} from './auth.js';
import {verificationReady} from './cloudflare-email.js';
const scope=env=>env.CF_EMAIL_ACCOUNT_ID || '';
async function limit(env,userId,action) {
  const at=seconds(),window=Math.floor(at/3600)*3600;
  const output=await batch(env.DB,[['DELETE FROM email_verification_limits WHERE window_start<?',[at-7200]],
    ...[`user:${userId}:${action}`,`account:${action}`].map(key=>[
      `INSERT INTO email_verification_limits(key,count,window_start) VALUES(?,1,?)
       ON CONFLICT(key) DO UPDATE SET count=CASE WHEN window_start<>excluded.window_start THEN 1 ELSE count+1 END,
       window_start=excluded.window_start RETURNING count`,[digest(key+':'+scope(env)),window]])]);
  ensure(output[1].results[0].count<=(action==='start'?10:120) && output[2].results[0].count<=(action==='start'?100:10000),
    '操作较频繁，请稍后再试。',429);
}
export async function verifyAction(env,userId,action) {
  ensure(verificationReady(env),'邮件验证服务尚未启用，请稍后再试。',503);
  const user=await first(env.DB,'SELECT notification_email FROM users WHERE id=?',[userId]);
  ensure(user?.notification_email,'请先输入收件邮箱。');
  await limit(env,userId,action);
  if(action!=='check') await requestConsent(env,userId,user.notification_email);
}
