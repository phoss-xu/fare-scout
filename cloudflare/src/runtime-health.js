import {run,now,report} from './db.js';

// A newer invocation owns the summary. A late completion cannot overwrite it.
export async function trackScheduled(env,work) {
  const id=crypto.randomUUID(),started=Date.now();
  await run(env.DB,`INSERT INTO runtime_heartbeats(name,invocation_id,started_at,status)
    VALUES('cron',?,?,'running') ON CONFLICT(name) DO UPDATE SET
    invocation_id=excluded.invocation_id,started_at=excluded.started_at,status='running',
    finished_at=NULL,duration_ms=NULL,error_code=NULL`,[id,now()]);
  try {
    await work();
    await run(env.DB,`UPDATE runtime_heartbeats SET status='ok',finished_at=?,duration_ms=?
      WHERE name='cron' AND invocation_id=?`,[now(),Date.now()-started,id]);
  } catch(error) {
    try {
      await run(env.DB,`UPDATE runtime_heartbeats SET status='error',finished_at=?,duration_ms=?,error_code='scheduled_failed'
        WHERE name='cron' AND invocation_id=?`,[now(),Date.now()-started,id]);
    } catch(recordError) { report(recordError,'Scheduler heartbeat failed'); }
    throw error;
  }
}
