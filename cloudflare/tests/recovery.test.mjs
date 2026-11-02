import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {harness,request,register} from './harness.mjs';
import {config,source,waitFor} from './fixtures.mjs';
test('D1 persistence across workerd restart; Cron recovers expired lease without duplicate samples',async t=>{
  const persist=await mkdtemp(path.join(tmpdir(),'fare-persist-'));t.after(()=>rm(persist,{recursive:true,force:true}));
  const a=await harness({persist});let h=a;
  try {
    const session=await register(h);
    const result=await request(h,'/api/watches',config(),session),id=result.data.id;
    const row=await h.db.prepare('SELECT config FROM watches WHERE id=?').bind(id).first();
    const c=JSON.parse(row.config),job={origin_id:'airport:HKG',location_id:'airport:SIN',destination:'SIN',departure:c.start,arrival:c.end};
    await h.db.batch([
      h.db.prepare("INSERT INTO search_runs(id,kind,owner_id,watch_id,config,total,job_count,created_at) VALUES('recover','watch',1,?,?,1,1,'2000-01-01')").bind(id,row.config),
      h.db.prepare("INSERT INTO search_tasks(id,run_id,job,status,attempts,available_at,lease_token,lease_until) VALUES('recover-task','recover',?,'running',1,'2000-01-01','old-isolate','2000-01-01')").bind(JSON.stringify(job)),
      h.db.prepare('UPDATE watches SET running=1 WHERE id=?').bind(id)
    ]);
    await h.close();
    h=await harness({persist,skipMigrations:true,bindings:{QUERY_ENABLED:'true'},outbound:source({price:1200})});
    assert.ok((await request(h,'/api/auth/session',undefined,session)).data.user);
    const worker=await h.mf.getWorker('fare-scout');
    const outcome=await worker.scheduled({cron:'* * * * *'});
    assert.equal(outcome.outcome,'ok');
    await waitFor(async()=>!(await h.db.prepare('SELECT running FROM watches WHERE id=?').bind(id).first()).running);
    assert.equal((await h.db.prepare('SELECT COUNT(*) n FROM observations').first()).n,1);
    assert.equal((await h.db.prepare("SELECT attempts FROM search_tasks WHERE id='recover-task'").first()).attempts,2);
    await worker.scheduled({cron:'* * * * *'});
    assert.equal((await h.db.prepare('SELECT COUNT(*) n FROM observations').first()).n,1);
    assert.equal((await h.db.prepare('SELECT status FROM email_outbox').first()).status,'waiting_config');
  } finally { await h.close(); }
});
