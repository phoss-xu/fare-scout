import {alertPage} from './alert-pages.js';
import {currentObservations,removedOffers} from './observation-history.js';
export {history} from './observation-history.js';
import {all,first,run,batch,now,email,ensure} from './db.js';
import {today,policy} from './domain.js';
import {label,stats} from './locations.js';
import {mailStatus} from './mail.js';
import {dailyState} from './daily.js';
const WATCH = 'SELECT w.*,s.* FROM watches w JOIN schedules s ON s.watch_id=w.id';
export function decode(row) {
  return row && {...JSON.parse(row.config),...row,running:!!row.running,auto_enabled:!!row.auto_enabled,alerts_enabled:!!row.alerts_enabled};
}
export async function watch(db,id,userId) {
  return decode(await first(db,WATCH+' WHERE w.id=?'+(userId===undefined?'':' AND w.owner_id=? AND w.deleted_at IS NULL'),userId===undefined?[id]:[id,userId]));
}
export async function create(db,c,userId) {
  const rows=await batch(db,[['INSERT INTO watches(config,created_at,owner_id) VALUES(?,?,?) RETURNING id',[JSON.stringify(c),now(),userId]],
    ['INSERT INTO schedules(watch_id,auto_enabled,alerts_enabled,interval_hours,min_drop,next_check) VALUES(last_insert_rowid(),?,?,?,?,?)',[Number(c.auto_enabled),Number(c.alerts_enabled),c.interval_hours,c.min_drop,now()]]]);
  return rows[0].results[0].id;
}
export async function settings(db,id,userId,data) {
  const c=policy(data), existing=await watch(db,id,userId);
  ensure(existing,'这条监控不存在。',404);
  let due=existing.next_check;
  if(c.auto_enabled && (!existing.auto_enabled || c.interval_hours!==existing.interval_hours)) due=new Date((existing.last_finished?Date.parse(existing.last_finished):Date.now())+c.interval_hours*3600000).toISOString();
  await run(db,'UPDATE schedules SET auto_enabled=?,alerts_enabled=?,interval_hours=?,min_drop=?,next_check=? WHERE watch_id=?',[Number(c.auto_enabled),Number(c.alerts_enabled),c.interval_hours,c.min_drop,due,id]);
}
export async function remove(db,kind,id,userId,restore) {
  if(kind==='watches') {
    ensure(await first(db,'SELECT id FROM watches WHERE id=? AND owner_id=?',[id,userId]),'这条记录不存在。',404);
    const changes=[['UPDATE watches SET deleted_at=? WHERE id=? AND owner_id=?',[restore?null:now(),id,userId]]];
    if(!restore) changes.push(
      ['UPDATE watches SET running=0 WHERE id=?',[id]],
      ['UPDATE schedules SET auto_enabled=0,alerts_enabled=0 WHERE watch_id=?',[id]],
      ["UPDATE search_tasks SET status='cancelled',lease_token=NULL,lease_until=NULL WHERE run_id IN (SELECT id FROM search_runs WHERE watch_id=? AND status='running')",[id]],
      ["UPDATE search_runs SET status='cancelled',finished_at=? WHERE watch_id=? AND status='running'",[now(),id]],
      ["UPDATE email_outbox SET status='cancelled',lease_token=NULL WHERE alert_id IN (SELECT id FROM alerts WHERE watch_id=?) AND status IN ('pending','retry','waiting_config','waiting_verification','sending')",[id]]);
    await batch(db,changes);
  } else {
    const changed=await run(db,`UPDATE observations SET dismissed_at=? WHERE id=? AND status='ok' AND watch_id IN
      (SELECT id FROM watches WHERE owner_id=? AND deleted_at IS NULL)`,[restore?null:now(),id,userId]);
    ensure(changed.meta.changes,'这条记录不存在。',404);
  }
}
export async function markRead(db,userId,id) {
  ensure(Number.isInteger(id) && id>0,'请选择有效的提醒记录。');
  await run(db,'UPDATE alerts SET read_at=? WHERE id<=? AND read_at IS NULL AND watch_id IN (SELECT id FROM watches WHERE owner_id=?)',[now(),id,userId]);
}
export async function recipient(db,userId,address) {
  await run(db,'UPDATE users SET notification_email=? WHERE id=?',[email(address),userId]);
}
export async function state(env,user) {
  const db=env.DB;
  const [watchRows,observations,removed,alertData,daily,emailStatus]=await Promise.all([
    all(db,WATCH+' WHERE w.owner_id=? ORDER BY w.id DESC',[user.id]),
    currentObservations(db,user.id),removedOffers(db,user.id),alertPage(db,user.id),
    dailyState(db,user.id),mailStatus(env,user.notification_email,user.id)
  ]);
  const watches=watchRows.map(decode),alerts=alertData.alerts;
  const codes=new Set();
  for(const a of alerts) codes.add(a.destination);
  for(const w of watches) { codes.add(w.origin);for(const d of w.destinations) codes.add(d); }
  for(const o of observations) { codes.add(o.destination);for(const leg of [o.offer?.outbound,o.offer?.inbound]) if(leg) { codes.add(leg.from);codes.add(leg.to); } }
  return {history_api:true,removed_offers:removed.offers,removed_next_before:removed.next_before,alert_page:{unread:alertData.unread,next_before:alertData.next_before},watches:watches.filter(w=>!w.deleted_at),deleted_watches:watches.filter(w=>w.deleted_at),observations,alerts,
    daily,query_enabled:env.QUERY_ENABLED==='true',email:emailStatus,user,today:today(),location_stats:stats(),destinations:Object.fromEntries([...codes].filter(Boolean).map(c=>[c,label(c)]))};
}
