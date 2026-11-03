import {first,run,batch,now,seconds,ensure,ApiError,report} from './db.js';
import {requestConsent} from './email-consent.js';
import {digest} from './auth.js';
import {verificationReady,findDestination,createDestination,getDestination} from './cloudflare-email.js';
const scope = env => env.CF_EMAIL_ACCOUNT_ID || '';
export const destination = (env,address) => first(env.DB,'SELECT * FROM email_destinations WHERE account_id=? AND email=?',[scope(env),address]);
async function record(env,address,row) {
  ensure(row && row.email?.toLowerCase()===address && typeof row.id==='string' && row.id.length>0 && row.id.length<=32,
    '邮箱服务返回异常，请稍后重试。',502);
  const verified=typeof row.verified==='string' && Number.isFinite(Date.parse(row.verified))?row.verified:null;
  await run(env.DB,`UPDATE email_destinations SET destination_id=?,verified_at=?,checked_at=?,check_error=0
    WHERE account_id=? AND email=?`,[row.id,verified,now(),scope(env),address]);
}
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
export async function refreshDestination(env,address) {
  const row=await destination(env,address);
  if(!row?.destination_id) return false;
  try {
    const remote=await getDestination(env,row.destination_id);
    if(remote) await record(env,address,remote);
    else await run(env.DB,'UPDATE email_destinations SET destination_id=NULL,verified_at=NULL,checked_at=?,check_error=0 WHERE account_id=? AND email=?',[now(),scope(env),address]);
    return !!(await destination(env,address))?.verified_at;
  } catch(error) {
    await run(env.DB,'UPDATE email_destinations SET check_error=1 WHERE account_id=? AND email=?',[scope(env),address]);
    report(error,'Email verification check failed');
    throw new ApiError('暂时无法检查邮箱验证结果，请稍后重试。',503);
  }
}
export async function verifyAction(env,userId,action) {
  ensure(verificationReady(env),'邮件验证服务尚未启用，请稍后再试。',503);
  const user=await first(env.DB,'SELECT notification_email FROM users WHERE id=?',[userId]),address=user.notification_email;
  ensure(address.length<=90,'此邮箱地址过长，邮件服务最多支持 90 个字符。');
  await limit(env,userId,action);
  let row=await destination(env,address);
  if(action==='check') {
    ensure(row?.destination_id,'请先发送验证邮件。',409);
    // A short cache bounds repeated button clicks without calling the control plane on every page poll.
    if(row.check_error || Date.now()-Date.parse(row.checked_at)>=10000) await refreshDestination(env,address);
    if((await destination(env,address))?.verified_at) await requestConsent(env,userId,address);
    return;
  }
  if(row?.destination_id) {
    if(await refreshDestination(env,address)) await requestConsent(env,userId,address);
    return;
  }
  const token=crypto.randomUUID(),at=now();
  await run(env.DB,'INSERT INTO email_destinations(account_id,email) VALUES(?,?) ON CONFLICT DO NOTHING',[scope(env),address]);
  const claim=await first(env.DB,`UPDATE email_destinations SET lease_token=?,lease_until=?,requested_at=?
    WHERE account_id=? AND email=? AND destination_id IS NULL AND (lease_until IS NULL OR lease_until<=?)
    AND (requested_at IS NULL OR requested_at<=?) RETURNING email`,
    [token,new Date(Date.now()+90000).toISOString(),at,scope(env),address,at,new Date(Date.now()-60000).toISOString()]);
  ensure(claim,'验证请求正在处理，请一分钟后再试。',429);
  try {
    const existing=await findDestination(env,address);
    let remote=existing;
    if(!remote) {
      try {remote=await createDestination(env,address);}
      catch(error) {
        // Recover an ambiguous POST or a simultaneous request from another service.
        remote=await findDestination(env,address);if(!remote) throw error;
      }
    }
    await record(env,address,remote);
    if(remote.verified) await requestConsent(env,userId,address);
  } catch(error) {
    await run(env.DB,'UPDATE email_destinations SET check_error=1 WHERE account_id=? AND email=?',[scope(env),address]);
    report(error,'Email verification request failed');
    throw new ApiError('暂时无法申请邮箱验证，可能是服务忙或名额已满，请稍后重试或联系管理员。',503);
  } finally {
    await run(env.DB,'UPDATE email_destinations SET lease_token=NULL,lease_until=NULL WHERE account_id=? AND email=? AND lease_token=?',[scope(env),address,token]);
  }
}
export async function verificationStatus(env,address) {
  const row=await destination(env,address);
  return row?.check_error?'error':row?.verified_at?'verified':row?.destination_id?'pending':'unverified';
}
