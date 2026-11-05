import {all,first,run,batch,now} from './db.js';
import {SourceError} from './provider.js';
import {querySource} from './source-cache.js';
import {routeKey} from './domain.js';
import {watch} from './store.js';
import {finalize} from './runs.js';
import {sampleQueries} from './price-history.js';
// Every write, including observations and trigger-generated alerts, uses this fencing predicate.
const ACTIVE = `EXISTS(SELECT 1 FROM search_tasks t JOIN search_runs r ON r.id=t.run_id
 WHERE t.id=? AND t.lease_token=? AND t.status='running' AND t.lease_until>? AND r.status='running'
 AND (r.kind='deal' OR EXISTS(SELECT 1 FROM watches w JOIN schedules s ON s.watch_id=w.id
 WHERE w.id=r.watch_id AND w.deleted_at IS NULL AND (r.automatic=0 OR s.auto_enabled=1))))`;
async function record(db,task,c,job,offers,errorCode,sourceResult) {
  const timestamp=now(),queries=[],args=[task.id,task.lease_token,timestamp];
  if(!errorCode) queries.push(...await sampleQueries(job.window?{...c,...job.window}:c,offers,sourceResult?.checkedAt || timestamp,ACTIVE,args));
  if(task.kind==='watch') {
    const searchId=((c.origin_locations||[]).length>1?job.origin_id+'|':'')+(job.location_id||'airport:'+job.destination);
    const batchId=task.id;
    for(const offer of offers.length?offers:[null]) {
      queries.push([`INSERT INTO observations(watch_id,destination,departure,arrival,checked_at,status,offer,route_key,search_id,batch_id,task_id)
       SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE ${ACTIVE}`,
      [task.watch_id,offer?.outbound?.to||job.destination,job.departure,job.arrival,timestamp,errorCode?'error':offer?'ok':'empty',offer?JSON.stringify(offer):null,offer?routeKey(c,job,offer):null,searchId,batchId,task.id,...args]]);
    }
  }
  queries.push([`UPDATE search_tasks SET status=?,offers=?,error_code=?,source_checked_at=?,cache_hit=?,lease_token=NULL,lease_until=NULL WHERE id=? AND ${ACTIVE}`,
    [errorCode?'error':'done',JSON.stringify(offers),errorCode||null,sourceResult?.checkedAt||timestamp,Number(!!sourceResult?.cached),task.id,...args]]);
  await batch(db,queries);
}
export const SOURCE_CONCURRENCY = 4;
export async function pump(env,runId=null) {
  if(env.QUERY_ENABLED!=='true') return false;
  const db=env.DB,timestamp=now(),fence=crypto.randomUUID();
  // One SQLite statement reserves a slot and claims a distinct task across invocations.
  const claimed=await first(db,`UPDATE search_tasks SET status='running',lease_token=?,lease_until=?,attempts=attempts+1
    WHERE id=(SELECT t.id FROM search_tasks t JOIN search_runs r ON r.id=t.run_id
      WHERE r.status='running' AND ((t.status='pending' AND t.available_at<=?) OR (t.status='running' AND t.lease_until<=?))
        AND (SELECT COUNT(*) FROM search_tasks busy JOIN search_runs active ON active.id=busy.run_id
          WHERE busy.status='running' AND busy.lease_until>? AND active.status='running')<?
      ORDER BY (r.id=?) DESC,(r.kind='deal' AND json_extract(r.config,'$.daily') IS NOT 1) DESC,t.available_at,t.id LIMIT 1)
    RETURNING *,
      (SELECT kind FROM search_runs WHERE id=search_tasks.run_id) AS kind,
      (SELECT watch_id FROM search_runs WHERE id=search_tasks.run_id) AS watch_id,
      (SELECT config FROM search_runs WHERE id=search_tasks.run_id) AS config,
      (SELECT automatic FROM search_runs WHERE id=search_tasks.run_id) AS automatic`,[fence,new Date(Date.now()+90000).toISOString(),timestamp,timestamp,timestamp,SOURCE_CONCURRENCY,runId]);
  if(!claimed) return false;
  const task=claimed;
  const job=JSON.parse(task.job),c=JSON.parse(task.config);
  if(task.kind==='watch') {
    const w=await watch(db,task.watch_id);
    if(!w || w.deleted_at || (task.automatic && !w.auto_enabled)) {
      await run(db,"UPDATE search_tasks SET status='cancelled',lease_token=NULL WHERE id=? AND lease_token=?",[task.id,fence]);
      await finalize(db,task.run_id);return true;
    }
  }
  let offers=[],errorCode,sourceResult;
  if(task.attempts>3) errorCode='attempts_exhausted';
  else {
    try {
      sourceResult=await querySource(env,job.window?{...c,...job.window}:c,job,task.kind==='deal');
      if(sourceResult.busy) {
        await run(db,"UPDATE search_tasks SET status='pending',attempts=attempts-1,available_at=?,lease_token=NULL,lease_until=NULL WHERE id=? AND lease_token=?",[new Date(Date.now()+1500).toISOString(),task.id,fence]);
        return true;
      }
      offers=sourceResult.offers;
      if(offers.length>100) throw new SourceError('result_limit');
    } catch(error) {
      offers=[];
      errorCode=error instanceof SourceError?error.code:'source_exception';
      // Do not log request payloads, account details, provider response bodies or secrets.
      console.warn('Source query failed',task.id,errorCode);
      if(error instanceof SourceError && error.retryable && task.attempts<3) {
        await run(db,"UPDATE search_tasks SET status='pending',available_at=?,lease_token=NULL,lease_until=NULL,error_code=? WHERE id=? AND lease_token=?",[new Date(Date.now()+2**task.attempts*1000).toISOString(),errorCode,task.id,fence]);
        return true;
      }
    }
  }
  await record(db,task,c,job,offers,errorCode,sourceResult);
  // A pause/delete during the external request invalidates writes; release the abandoned lease.
  await run(db,"UPDATE search_tasks SET status='cancelled',lease_token=NULL,lease_until=NULL WHERE id=? AND status='running' AND lease_token=?",[task.id,fence]);
  await finalize(db,task.run_id);
  return true;
}
export async function drain(env,count=SOURCE_CONCURRENCY,runId=null) {
  // HTTP callers use a single wave so all network work fits the existing timeout.
  for(let offset=0;offset<count;offset+=SOURCE_CONCURRENCY) {
    const settled=await Promise.allSettled(Array.from({length:Math.min(SOURCE_CONCURRENCY,count-offset)},()=>pump(env,runId)));
    const failed=settled.find(result=>result.status==='rejected');
    if(failed) throw failed.reason;
    if(!settled.some(result=>result.value)) break;
  }
}
