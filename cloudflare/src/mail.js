import {all,first,run,now} from './db.js';
import {today} from './domain.js';
export function ready(env) { return env.MAIL_ENABLED==='true' && !!env.RESEND_API_KEY && typeof env.MAIL_FROM==='string' && /^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$/.test(env.MAIL_FROM); }
export function mailStatus(env,recipient) {
  const configured=ready(env);
  return {recipient,configured,message:configured?'邮件服务已配置，投递结果以提醒状态为准。':'发信服务尚未启用，提醒会先保存在这里。'};
}
// External delivery is confined to this adapter; local acceptance leaves MAIL_ENABLED=false.
export async function sendEmail(env,alert,recipient) {
  const c=JSON.parse(alert.config || '{}'),route=alert.route_key?JSON.parse(alert.route_key):[];
  const previous=alert.previous_price==null?'首次采样进入预算。':`上次有效报价：HK$${alert.previous_price}`;
  await sendText(env,recipient,`Fare Scout · ${alert.destination} · HK$${alert.price}`,
    `${route[0] || c.origin || ''} → ${alert.destination}\n出发日期：${alert.departure}\n${c.mode==='weekend'?'返程抵达日期':'返程起飞日期'}：${alert.arrival}\n${c.adults || 1} 位成人 · 经济舱 · 往返总价 HK$${alert.price}\n${previous}\n采样时间：${alert.created_at}\n核价链接：${alert.booking_url||'暂无'}\n报价可能变化，有限结果不代表完整市场最低价。可在网页暂停提醒。`,
    'fare-scout-'+alert.id+'-'+alert.created_at);
}
export async function sendText(env,recipient,subject,text,key) {
  const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':key},
    body:JSON.stringify({from:env.MAIL_FROM,to:[recipient],subject,text}),signal:AbortSignal.timeout(20000)});
  if(!response.ok) { await response.body?.cancel();throw new Error('mail_http_'+response.status); }
  await response.body?.cancel();
}
export async function deliver(env) {
  const db=env.DB,timestamp=now();
  const rows=await all(db,`SELECT a.*,q.attempts,w.deleted_at,s.alerts_enabled,u.notification_email,w.config FROM email_outbox q
    JOIN alerts a ON a.id=q.alert_id JOIN watches w ON w.id=a.watch_id JOIN schedules s ON s.watch_id=w.id JOIN users u ON u.id=w.owner_id
    WHERE (u.password_hash IS NOT NULL OR EXISTS(SELECT 1 FROM passkeys p WHERE p.user_id=u.id)) AND ((q.status IN ('pending','retry','waiting_config') AND q.next_attempt<=?)
    OR (q.status='sending' AND q.lease_until<=?)) ORDER BY a.id LIMIT 3`,[timestamp,timestamp]);
  for(const a of rows) {
    let status=a.deleted_at?'cancelled':!a.alerts_enabled||a.departure<today()||Date.now()-Date.parse(a.created_at)>86400000?'skipped':!ready(env)?'waiting_config':null;
    if(status) { await run(db,"UPDATE email_outbox SET status=? WHERE alert_id=? AND status<>'sent'",[status,a.id]);continue; }
    const fence=crypto.randomUUID();
    const claim=await first(db,`UPDATE email_outbox SET status='sending',lease_token=?,lease_until=? WHERE alert_id=?
      AND (status IN ('pending','retry','waiting_config') OR (status='sending' AND lease_until<=?)) RETURNING alert_id`,[fence,new Date(Date.now()+90000).toISOString(),a.id,timestamp]);
    if(!claim) continue;
    // Recheck immediately before sending; deletion invalidates pending delivery.
    const active=await first(db,`SELECT u.notification_email FROM email_outbox q JOIN alerts a ON a.id=q.alert_id
      JOIN watches w ON w.id=a.watch_id JOIN schedules s ON s.watch_id=w.id JOIN users u ON u.id=w.owner_id
      WHERE q.alert_id=? AND q.lease_token=? AND w.deleted_at IS NULL AND s.alerts_enabled=1`,[a.id,fence]);
    if(!active) continue;
    try {
      await sendEmail(env,a,active.notification_email);
      await run(db,"UPDATE email_outbox SET status='sent',sent_at=?,attempts=attempts+1,lease_token=NULL WHERE alert_id=? AND lease_token=?",[now(),a.id,fence]);
    } catch(error) {
      console.warn('Email delivery failed',a.id,/^mail_http_\d+$/.test(error.message)?error.message:error.name);
      const attempt=a.attempts+1;
      await run(db,'UPDATE email_outbox SET status=?,attempts=?,next_attempt=?,lease_token=NULL WHERE alert_id=? AND lease_token=?',[attempt>=5?'failed':'retry',attempt,new Date(Date.now()+Math.min(60,2**attempt)*60000).toISOString(),a.id,fence]);
    }
  }
}
