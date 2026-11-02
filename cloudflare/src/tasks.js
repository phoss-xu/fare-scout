import {all,first,run,batch,now} from './db.js';
import {search,SourceError} from './provider.js';
import {routeKey} from './domain.js';
import {watch} from './store.js';
import {finalize} from './runs.js';
// Every write, including observations and trigger-generated alerts, uses this fencing predicate.
const ACTIVE = `EXISTS(SELECT 1 FROM search_tasks t JOIN search_runs r ON r.id=t.run_id
 WHERE t.id=? AND t.lease_token=? AND t.status='running' AND t.lease_until>? AND r.status='running'
 AND (r.kind='deal' OR EXISTS(SELECT 1 FROM watches w JOIN schedules s ON s.watch_id=w.id
 WHERE w.id=r.watch_id AND w.deleted_at IS NULL AND (r.automatic=0 OR s.auto_enabled=1))))`;
async function record(db,task,c,job,offers,errorCode) {
  const timestamp=now(),queries=[],args=[task.id,task.lease_token,timestamp];
  if(task.kind==='watch') {
    const searchId=((c.origin_locations||[]).length>1?job.origin_id+'|':'')+(job.location_id||'airport:'+job.destination);
    const batchId=task.id;
    for(const offer of offers.length?offers:[null]) {
      queries.push([`INSERT INTO observations(watch_id,destination,departure,arrival,checked_at,status,offer,route_key,search_id,batch_id,task_id)
       SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE ${ACTIVE}`,
      [task.watch_id,offer?.outbound?.to||job.destination,job.departure,job.arrival,timestamp,errorCode?'error':offer?'ok':'empty',offer?JSON.stringify(offer):null,offer?routeKey(c,job,offer):null,searchId,batchId,task.id,...args]]);
    }
  }
  queries.push([`UPDATE search_tasks SET status=?,offers=?,error_code=?,lease_token=NULL,lease_until=NULL WHERE id=? AND ${ACTIVE}`,
    [errorCode?'error':'done',JSON.stringify(offers),errorCode||null,task.id,...args]]);
  await batch(db,queries);
}
export async function pump(env) {
  if(env.QUERY_ENABLED!=='true') return false;
  const db=env.DB,timestamp=now(),fence=crypto.randomUUID();
  const candidate=await first(db,`SELECT t.id FROM search_tasks t JOIN search_runs r ON r.id=t.run_id
    WHERE r.status='running' AND ((t.status='pending' AND t.available_at<=?) OR (t.status='running' AND t.lease_until<=?))
    ORDER BY t.available_at,t.id LIMIT 1`,[timestamp,timestamp]);
  if(!candidate) return false;
  const claimed=await first(db,`UPDATE search_tasks SET status='running',lease_token=?,lease_until=?,attempts=attempts+1
    WHERE id=? AND ((status='pending' AND available_at<=?) OR (status='running' AND lease_until<=?)) RETURNING *`,
    [fence,new Date(Date.now()+90000).toISOString(),candidate.id,timestamp,timestamp]);
  if(!claimed) return true;
  const task={...claimed,...await first(db,'SELECT kind,watch_id,config,automatic FROM search_runs WHERE id=?',[claimed.run_id])};
  const job=JSON.parse(task.job),c=JSON.parse(task.config);
  if(task.kind==='watch') {
    const w=await watch(db,task.watch_id);
    if(!w || w.deleted_at || (task.automatic && !w.auto_enabled)) {
      await run(db,"UPDATE search_tasks SET status='cancelled',lease_token=NULL WHERE id=? AND lease_token=?",[task.id,fence]);
      await finalize(db,task.run_id);return true;
    }
  }
  let offers=[],errorCode;
  if(task.attempts>3) errorCode='attempts_exhausted';
  else {
    try {
      offers=await search(job.window?{...c,...job.window}:c,job,task.kind==='deal');
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
  await record(db,task,c,job,offers,errorCode);
  // A pause/delete during the external request invalidates writes; release the abandoned lease.
  await run(db,"UPDATE search_tasks SET status='cancelled',lease_token=NULL,lease_until=NULL WHERE id=? AND status='running' AND lease_token=?",[task.id,fence]);
  await finalize(db,task.run_id);
  return true;
}
export async function drain(env,count=1) {
  for(let i=0;i<count;i++) if(!await pump(env)) break;
}
