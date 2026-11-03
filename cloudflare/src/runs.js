import {all,first,batch,run,now,ensure} from './db.js';
import {jobs,today} from './domain.js';
import {origins,destinations,resolve} from './locations.js';
import {watch} from './store.js';
export async function enqueueWatch(db,id,automatic=false) {
  const c=await watch(db,id);
  if(!c || c.deleted_at || (automatic && !c.auto_enabled)) return null;
  const pending=jobs(c).filter(j=>j.departure>=today());
  const cursor=pending.length?(c.query_cursor||0)%pending.length:0;
  const selected=[...pending.slice(cursor),...pending.slice(0,cursor)].slice(0,12);
  const identity=crypto.randomUUID(),timestamp=now();
  const output=await batch(db,[
    [`INSERT OR IGNORE INTO search_runs(id,kind,owner_id,watch_id,config,automatic,total,cursor_start,job_count,created_at,status,finished_at)
     SELECT ?,'watch',owner_id,id,config,?,?,?,?,?,?,? FROM watches
     WHERE id=? AND running=0 AND deleted_at IS NULL AND (?=0 OR EXISTS(SELECT 1 FROM schedules WHERE watch_id=? AND auto_enabled=1))`,
    [identity,Number(automatic),selected.length,cursor,pending.length,timestamp,selected.length?'running':'expired',selected.length?null:timestamp,id,Number(automatic),id]],
    ...selected.map(j=>[`INSERT INTO search_tasks(id,run_id,job,available_at) SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM search_runs WHERE id=?)`,[crypto.randomUUID(),identity,JSON.stringify(j),timestamp,identity]]),
    [`UPDATE watches SET running=? WHERE id=? AND EXISTS(SELECT 1 FROM search_runs WHERE id=?)`,[Number(!!selected.length),id,identity]],
    [`UPDATE schedules SET last_started=?,next_check=NULL,last_status=? WHERE watch_id=? AND EXISTS(SELECT 1 FROM search_runs WHERE id=?)`,[timestamp,selected.length?'running':'expired',id,identity]]
  ]);
  return output[0].meta.changes ? identity : null;
}
export async function enqueueDeal(db,c,userId) {
  const identity=crypto.randomUUID(),timestamp=now();
  const pairs=origins(c).flatMap(o=>(destinations(c).length?destinations(c):[null]).map(d=>({origin_id:o.id,location_id:d?.id || null})));
  const output=await batch(db,[
    [`INSERT OR IGNORE INTO search_runs(id,kind,owner_id,config,total,job_count,created_at)
      SELECT ?,'deal',?,?,?,?,? WHERE (SELECT COUNT(*) FROM search_runs WHERE kind='deal' AND status='running' AND json_extract(config,'$.daily') IS NOT 1)<100`,[identity,userId,JSON.stringify(c),pairs.length,pairs.length,timestamp]],
    ...pairs.map(j=>['INSERT INTO search_tasks(id,run_id,job,available_at) SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM search_runs WHERE id=?)',[crypto.randomUUID(),identity,JSON.stringify(j),timestamp,identity]])
  ]);
  ensure(output[0].meta.changes,'你已有一份特价搜索正在进行，或搜索服务正在忙，请稍后重试。',409);
  return identity;
}
export async function dealResult(db,id,userId) {
  const row=await first(db,"SELECT * FROM search_runs WHERE id=? AND owner_id=? AND kind='deal'",[id,userId]);
  ensure(row,'这份搜索不存在或已过期，请重新搜索。',404);
  const tasks=await all(db,'SELECT status,offers,source_checked_at,cache_hit FROM search_tasks WHERE run_id=?',[id]);
  const best=new Map();
  const checked=tasks.filter(t=>t.status==='done' && t.source_checked_at).map(t=>t.source_checked_at).sort();
  for(const task of tasks) for(const o of JSON.parse(task.offers||'[]')) {
    const airport=resolve('airport:'+o.outbound.to),key=airport.city_code || airport.code;
    if(!best.has(key)||o.price<best.get(key).price) best.set(key,o);
  }
  return {id,status:row.status,config:JSON.parse(row.config),completed:tasks.filter(t=>['done','error','cancelled'].includes(t.status)).length,total:row.total,
    failures:tasks.filter(t=>t.status==='error').length,offers:[...best.values()].sort((a,b)=>a.price-b.price),source:'Kiwi',checked_at:checked[0]||row.finished_at,cached:tasks.some(t=>t.cache_hit)};
}
export async function finalize(db,id) {
  const r=await first(db,"SELECT * FROM search_runs WHERE id=? AND status='running'",[id]);
  if(!r) return;
  const rows=await all(db,'SELECT status,COUNT(*) AS count FROM search_tasks WHERE run_id=? GROUP BY status',[id]);
  const counts=Object.fromEntries(rows.map(r=>[r.status,r.count]));
  if(counts.pending || counts.running) return;
  const c=r.kind==='watch'?await watch(db,r.watch_id):null;
  const status=r.kind==='deal'?(counts.error===r.total?'error':'done'):(counts.error?'error':'ok');
  const timestamp=now(),fence=crypto.randomUUID();
  const queries=[['UPDATE search_runs SET status=?,finished_at=?,finalize_token=? WHERE id=? AND status=\'running\'',[status,timestamp,fence,id]]];
  if(c) {
    const failures=status==='error'?Math.min(c.failure_count+1,8):0;
    const minutes=failures?Math.min(c.interval_hours*60,15*2**(failures-1)):c.interval_hours*60;
    queries.push(['UPDATE watches SET running=0 WHERE id=? AND EXISTS(SELECT 1 FROM search_runs WHERE id=? AND finalize_token=?)',[r.watch_id,id,fence]],
      [`UPDATE schedules SET last_finished=?,last_status=?,failure_count=?,next_check=?,query_cursor=?,last_batch_count=?,job_count=?
       WHERE watch_id=? AND EXISTS(SELECT 1 FROM search_runs WHERE id=? AND finalize_token=?)`,
      [timestamp,status,failures,new Date(Date.now()+minutes*60000).toISOString(),(r.cursor_start+r.total)%r.job_count,(counts.done||0)+(counts.error||0),r.job_count,r.watch_id,id,fence]]);
  }
  await batch(db,queries);
}
export async function schedule(db,enabled) {
  // Recovery is explicit: completed tasks can be finalized after an isolate exits mid-response.
  for(const r of await all(db,"SELECT id FROM search_runs WHERE status='running' AND NOT EXISTS(SELECT 1 FROM search_tasks WHERE run_id=search_runs.id AND status IN ('pending','running')) LIMIT 20")) await finalize(db,r.id);
  if(enabled) for(const r of await all(db,`SELECT w.id FROM watches w JOIN schedules s ON s.watch_id=w.id JOIN users u ON u.id=w.owner_id
    WHERE w.deleted_at IS NULL AND w.running=0 AND s.auto_enabled=1 AND s.next_check<=? AND (u.password_hash IS NOT NULL OR EXISTS(SELECT 1 FROM passkeys p WHERE p.user_id=u.id)) ORDER BY s.next_check LIMIT 5`,[now()])) await enqueueWatch(db,r.id,true);
  await run(db,"DELETE FROM search_runs WHERE ((kind='deal' AND status<>'running' AND finished_at<?) OR (kind='watch' AND status<>'running' AND finished_at<?)) AND NOT EXISTS(SELECT 1 FROM daily_editions WHERE run_id=search_runs.id)",[new Date(Date.now()-3600000).toISOString(),new Date(Date.now()-7*86400000).toISOString()]);
}
