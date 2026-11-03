import {all,ensure} from './db.js';
const SIZE=25;
const mask=value=>value ? `${value.slice(0,1)}***@${value.split('@')[1]||'***'}` : '未设置';
function number(value) {
  if(value===null) return null;
  ensure(/^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value)),'分页或用户编号无效。');
  return Number(value);
}
function filters(params,statuses,column='t.status') {
  const sql=[],args=[],status=params.get('status'),user=number(params.get('user'));
  if(status) {ensure(statuses.includes(status),'状态筛选无效。');sql.push(`${column}=?`);args.push(status);}
  if(user) {sql.push('r.owner_id=?');args.push(user);}
  return {sql,args};
}
function page(rows,key) {
  const more=rows.length>SIZE,items=rows.slice(0,SIZE);
  return {items,next:more?String(key(items.at(-1))):null};
}
export async function adminUsers(env,params) {
  const before=number(params.get('before'));
  const rows=await all(env.DB,`SELECT u.id,u.name,u.email,u.notification_email,u.created_at,
    (SELECT COUNT(*) FROM watches w WHERE w.owner_id=u.id AND w.deleted_at IS NULL) AS watch_count,
    (SELECT COUNT(*) FROM passkeys p WHERE p.user_id=u.id) AS passkey_count,
    EXISTS(SELECT 1 FROM email_destinations d WHERE d.email=u.notification_email AND d.account_id=? AND d.verified_at IS NOT NULL) AS email_verified,
    EXISTS(SELECT 1 FROM email_consents c WHERE c.user_id=u.id AND c.email=u.notification_email AND c.account_id=? AND c.confirmed_at IS NOT NULL) AS email_confirmed
    FROM users u ${before?'WHERE u.id<?':''} ORDER BY u.id DESC LIMIT ?`,
    [env.CF_EMAIL_ACCOUNT_ID||'',env.CF_EMAIL_ACCOUNT_ID||'',...(before?[before]:[]),SIZE+1]);
  return page(rows.map(r=>({...r,email:mask(r.email),notification_email:mask(r.notification_email)})),r=>r.id);
}
export async function adminTasks(db,params) {
  const {sql,args}=filters(params,['pending','running','done','error','cancelled']);
  const before=number(params.get('before'));
  if(before) {sql.push('t.rowid<?');args.push(before);}
  const rows=await all(db,`SELECT t.rowid AS sequence,t.id,t.run_id,r.owner_id,r.kind,r.watch_id,r.created_at,
    t.status,t.attempts,t.error_code,t.available_at,t.lease_until,t.source_checked_at,t.cache_hit,
    json_array_length(t.offers) AS offer_count FROM search_tasks t JOIN search_runs r ON r.id=t.run_id
    ${sql.length?'WHERE '+sql.join(' AND '):''} ORDER BY t.rowid DESC LIMIT ?`,[...args,SIZE+1]);
  return page(rows,r=>r.sequence);
}
export async function adminMail(db,params) {
  const conditions=[],args=[],status=params.get('status'),user=number(params.get('user'));
  if(status) {
    ensure(['pending','retry','waiting_config','waiting_verification','sending','sent','failed','cancelled','skipped'].includes(status),'状态筛选无效。');
    conditions.push('status=?');args.push(status);
  }
  if(user) {conditions.push('user_id=?');args.push(user);}
  const before=params.get('before');
  if(before) {
    let cursor;
    try {cursor=JSON.parse(atob(before));} catch {ensure(false,'分页参数无效。');}
    ensure(Array.isArray(cursor) && cursor.length===2 && typeof cursor[0]==='string' && cursor[0].length<=40 &&
      typeof cursor[1]==='string' && cursor[1].length<=160,'分页参数无效。');
    conditions.push('(created_at<? OR (created_at=? AND identity<?))');args.push(cursor[0],cursor[0],cursor[1]);
  }
  const rows=await all(db,`WITH messages AS (
    SELECT 'alert:'||q.alert_id AS identity,'降价提醒' AS kind,w.owner_id AS user_id,u.notification_email,
      a.created_at,q.status,q.attempts,q.next_attempt,q.sent_at,a.watch_id,NULL AS run_id
      FROM email_outbox q JOIN alerts a ON a.id=q.alert_id JOIN watches w ON w.id=a.watch_id
      JOIN users u ON u.id=w.owner_id
    UNION ALL
    SELECT 'daily:'||e.id,'每日推荐',e.user_id,u.notification_email,e.scheduled_at,e.mail_status,e.attempts,
      e.next_attempt,e.sent_at,NULL,e.run_id FROM daily_editions e JOIN users u ON u.id=e.user_id
    ) SELECT * FROM messages ${conditions.length?'WHERE '+conditions.join(' AND '):''}
    ORDER BY created_at DESC,identity DESC LIMIT ?`,[...args,SIZE+1]);
  return page(rows.map(r=>({...r,notification_email:mask(r.notification_email)})),r=>btoa(JSON.stringify([r.created_at,r.identity])));
}
