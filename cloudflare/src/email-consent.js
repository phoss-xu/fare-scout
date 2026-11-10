import {first,run,ensure,seconds,now} from './db.js';
import {token,digest} from './auth.js';
import {sendCloudflare} from './cloudflare-email.js';
export const consent = (env,userId,address) => first(env.DB,
  'SELECT * FROM email_consents WHERE user_id=? AND account_id=? AND email=?',[userId,env.CF_EMAIL_ACCOUNT_ID||'',address]);
export async function requestConsent(env,userId,address) {
  const value=token(),at=seconds(),account=env.CF_EMAIL_ACCOUNT_ID || '';
  const old=await consent(env,userId,address);
  if(old?.confirmed_at) return;
  ensure(!(old?.requested_at>at-60),'验证邮件已发送，请检查收件箱或垃圾邮件，1分钟后可重发。',429);
  const origin=new URL(env.PASSKEY_ORIGIN);
  ensure(origin.protocol==='https:' || origin.hostname==='localhost','邮件确认链接尚未配置。',503);
  await run(env.DB,`INSERT INTO email_consents(user_id,account_id,email) VALUES(?,?,?) ON CONFLICT DO NOTHING`,[userId,account,address]);
  const claim=await first(env.DB,`UPDATE email_consents SET token_hash=?,expires_at=?,requested_at=?
    WHERE user_id=? AND account_id=? AND email=? AND confirmed_at IS NULL AND (requested_at IS NULL OR requested_at<=?) RETURNING user_id`,
    [digest(value),at+3600,at,userId,account,address,at-60]);
  if(!claim) return;
  try {
    const receipt=await sendCloudflare(env,address,'Fare Scout · 验证你的邮箱',
      `点击以下链接，验证你在 Fare Scout 设置的邮箱：\n${origin.origin}/#email-confirm=${value}\n\n链接一小时内有效。如果不是你操作，请忽略。请使用设置此邮箱的账号登录。验证后可接收机票提醒，随时可在网页关闭。`,
      'fare-consent-'+digest(value));
    console.info('Email verification accepted',userId,receipt?.messageId || 'no-message-id');
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
