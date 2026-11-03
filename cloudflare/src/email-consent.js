import {first,run,ensure,seconds,now} from './db.js';
import {token,digest} from './auth.js';
import {sendCloudflare} from './cloudflare-email.js';
export const consent = (env,userId,address) => first(env.DB,
  'SELECT * FROM email_consents WHERE user_id=? AND account_id=? AND email=?',[userId,env.CF_EMAIL_ACCOUNT_ID||'',address]);
export async function requestConsent(env,userId,address) {
  const value=token(),at=seconds(),account=env.CF_EMAIL_ACCOUNT_ID;
  const old=await consent(env,userId,address);
  if(old?.confirmed_at || old?.requested_at>at-300) return;
  const origin=new URL(env.PASSKEY_ORIGIN);
  ensure(origin.protocol==='https:' || origin.hostname==='localhost','邮件确认链接尚未配置。',503);
  await run(env.DB,`INSERT INTO email_consents(user_id,account_id,email) VALUES(?,?,?) ON CONFLICT DO NOTHING`,[userId,account,address]);
  const claim=await first(env.DB,`UPDATE email_consents SET token_hash=?,expires_at=?,requested_at=?
    WHERE user_id=? AND account_id=? AND email=? AND confirmed_at IS NULL AND (requested_at IS NULL OR requested_at<=?) RETURNING user_id`,
    [digest(value),at+3600,at,userId,account,address,at-300]);
  if(!claim) return;
  try {
    await sendCloudflare(env,address,'Fare Scout · 确认接收机票提醒',
      `请在你设置提醒的 Fare Scout 账号中打开以下链接，确认接收每日推荐和降价提醒：\n${origin.origin}/#email-confirm=${value}\n\n链接一小时内有效。如果不是你操作，请忽略。可随时在网页暂停每日推荐及监控提醒。`,
      'fare-consent-'+digest(value));
  } catch(error) {
    await run(env.DB,`UPDATE email_consents SET requested_at=NULL,token_hash=NULL,expires_at=NULL
      WHERE user_id=? AND account_id=? AND email=? AND token_hash=?`,[userId,account,address,digest(value)]);
    throw error;
  }
}
export async function confirmConsent(env,userId,value) {
  ensure(env.MAIL_ENABLED==='true' && env.MAIL_PROVIDER==='cloudflare','邮件服务尚未启用。',503);
  ensure(typeof value==='string' && /^[a-f0-9]{64}$/.test(value),'确认链接无效或已过期。');
  const row=await first(env.DB,`UPDATE email_consents SET confirmed_at=?,token_hash=NULL,expires_at=NULL
    WHERE user_id=? AND account_id=? AND token_hash=? AND expires_at>? AND email=(SELECT notification_email FROM users WHERE id=?) RETURNING email`,
    [now(),userId,env.CF_EMAIL_ACCOUNT_ID||'',digest(value),seconds(),userId]);
  ensure(row,'请用设置此收件邮箱的账号登录；链接也可能已过期或已使用。',400);
}
