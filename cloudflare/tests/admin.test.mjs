import {test} from 'node:test';
import assert from 'node:assert/strict';
import {harness,request} from './harness.mjs';
import {digest} from '../src/auth.js';
import {trackScheduled} from '../src/runtime-health.js';

async function seed(h) {
  const at=new Date().toISOString();
  for(let id=1;id<=27;id++) await h.db.prepare(`INSERT INTO users(id,email,name,password_hash,notification_email,created_at)
    VALUES(?,?,?,'secret-password-hash',?,?)`).bind(id,`user${id}@example.test`,id===1?'<img src=x onerror=alert(1)>':'合成验收用户',`notify${id}@example.test`,at).run();
  for(const id of [1,2]) await h.db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').bind(digest('session-'+id),id,'secret-csrf',Date.now()/1000+3600).run();
  await h.db.prepare("INSERT INTO watches(id,config,created_at,owner_id) VALUES(1,'{}',?,1)").bind(at).run();
  await h.db.prepare(`INSERT INTO search_runs(id,kind,owner_id,config,total,job_count,created_at,status)
    VALUES('run-1','watch',1,'{"private":"secret-config"}',27,27,?,'running')`).bind(at).run();
  for(let i=1;i<=27;i++) await h.db.prepare(`INSERT INTO search_tasks(id,run_id,job,status,attempts,available_at,offers,error_code,lease_token,lease_until)
    VALUES(?,'run-1','{"origin_id":"airport:HKG","destination":"SIN","departure":"2026-12-05"}',?,1,?,'[]',?,'secret-lease',?)`)
    .bind('task-'+i,i===1?'error':i===2?'running':'pending',at,i===1?'source_timeout':null,'2000-01-01T00:00:00.000Z').run();
  await h.db.prepare(`INSERT INTO observations(watch_id,destination,departure,arrival,checked_at,status)
    VALUES(1,'SIN','2026-12-05','2026-12-08',?,'empty')`).bind(at).run();
  await h.db.prepare(`INSERT INTO email_destinations(account_id,email,verified_at) VALUES('qa','notify1@example.test',?)`).bind(at).run();
  await h.db.prepare(`INSERT INTO email_consents(user_id,account_id,email,confirmed_at,token_hash) VALUES(1,'qa','notify1@example.test',?,'secret-consent')`).bind(at).run();
  for(let i=1;i<=26;i++) {
    await h.db.prepare(`INSERT INTO alerts(id,observation_id,watch_id,destination,departure,arrival,created_at,reason,price)
      VALUES(?,?,1,'SIN','2026-12-05','2026-12-08',?,'drop',100)`).bind(i,i+100,at).run();
    await h.db.prepare("INSERT INTO email_outbox(alert_id,status,attempts,next_attempt,lease_token) VALUES(?,?,1,?,'secret-mail-lease')").bind(i,i===1?'failed':'sent',at).run();
  }
  await h.db.prepare(`INSERT INTO daily_editions(id,user_id,day,scheduled_at,run_id,total,next_attempt,mail_status)
    VALUES('edition-1',1,'2026-11-03',?,'run-1',1,?,'waiting_verification')`).bind(at,at).run();
  return {cookie:'fare_session=session-1'};
}

test('admin is default-deny, authenticates all HTML aliases and rejects spoofed roles',async t=>{
  const h=await harness();t.after(()=>h.close());await seed(h);
  for(const path of ['/admin','/admin/','/admin.html','/api/admin/users','/api/admin/overview']) {
    assert.equal((await request(h,path)).status,401,path);
    const result=await request(h,path,undefined,{cookie:'fare_session=session-1'},{'X-Admin':'true','X-User-Id':'1'});
    assert.equal(result.status,403,path);assert.doesNotMatch(JSON.stringify(result.data),/notify1|secret-/);
  }
});
test('admin lists are read-only, masked, paginated and filterable in real workerd/D1',async t=>{
  const h=await harness({bindings:{ADMIN_USER_IDS:'1',CF_EMAIL_ACCOUNT_ID:'qa',QUERY_ENABLED:'true'}});t.after(()=>h.close());
  const session=await seed(h);
  assert.equal((await request(h,'/api/admin/users',undefined,{cookie:'fare_session=session-2'})).status,403);
  assert.equal((await request(h,'/api/admin/users?user=1',{},session)).status,405);
  const tables=['users','sessions','search_runs','search_tasks','observations','alerts','email_outbox','email_consents','email_destinations','daily_editions','runtime_heartbeats'];
  const snapshot=()=>h.db.batch(tables.map(table=>h.db.prepare(`SELECT * FROM ${table} ORDER BY rowid`)));
  const original=await snapshot();
  const html=await request(h,'/admin',undefined,session);assert.equal(html.status,200);
  assert.match(html.data,/运营工作台/);assert.equal(html.response.headers.get('Cache-Control'),'no-store');
  for(const path of ['/admin/','/admin.html']) assert.equal((await request(h,path,undefined,session)).status,200);
  const users=(await request(h,'/api/admin/users',undefined,session)).data;
  assert.equal(users.items.length,25);assert.equal(users.next,'3');
  const lastUsers=(await request(h,'/api/admin/users?before=3',undefined,session)).data;
  assert.deepEqual(lastUsers.items.map(r=>r.id),[2,1]);assert.equal(lastUsers.next,null);
  assert.equal(lastUsers.items[1].email_verified,1);assert.equal(lastUsers.items[1].email_confirmed,1);
  const tasks=(await request(h,'/api/admin/tasks',undefined,session)).data;
  assert.equal(tasks.items.length,25);assert.ok(tasks.next);
  assert.equal((await request(h,'/api/admin/tasks?before='+tasks.next,undefined,session)).data.items.length,2);
  assert.equal((await request(h,'/api/admin/tasks?status=error&user=1',undefined,session)).data.items[0].error_code,'source_timeout');
  assert.equal((await request(h,'/api/admin/tasks?user=2',undefined,session)).data.items.length,0);
  const detail=await request(h,'/api/admin/tasks/task-1',undefined,session);
  assert.equal(detail.data.task.job.destination,'SIN');assert.equal(detail.data.task.error_code,'source_timeout');
  assert.equal((await request(h,'/api/admin/tasks/missing',undefined,session)).status,404);
  const mail=(await request(h,'/api/admin/mail',undefined,session)).data;
  assert.equal(mail.items.length,25);assert.ok(mail.items.some(r=>r.kind==='每日推荐'));
  const lastMail=(await request(h,'/api/admin/mail?before='+encodeURIComponent(mail.next),undefined,session)).data;
  assert.equal(lastMail.items.length,2);assert.equal(lastMail.next,null);
  assert.equal(new Set([...mail.items,...lastMail.items].map(r=>r.identity)).size,27);
  assert.equal((await request(h,'/api/admin/mail?status=failed',undefined,session)).data.items.length,1);
  const overview=(await request(h,'/api/admin/overview',undefined,session)).data;
  assert.equal(overview.users,27);assert.equal(overview.expired_leases,1);assert.equal(overview.heartbeat,null);
  assert.deepEqual(overview.observations_24h,[{status:'empty',count:1}]);assert.equal(overview.last_success,null);
  assert.doesNotMatch(JSON.stringify([users,lastUsers,tasks,detail.data,mail,lastMail,overview]),/secret-|notify1@|user1@|secret-config/);
  assert.deepEqual((await snapshot()).map(r=>r.results),original.map(r=>r.results));
  for(const path of ['/api/admin/users?before=0','/api/admin/tasks?status=sent','/api/admin/mail?before=bad','/api/admin/mail?user=1%20OR%201=1']) assert.equal((await request(h,path,undefined,session)).status,400,path);
  assert.equal((await request(h,'/api/admin/unknown',undefined,session)).status,404);
  await h.db.prepare('UPDATE sessions SET expires_at=0 WHERE user_id=1').run();
  assert.equal((await request(h,'/api/admin/users',undefined,session)).status,401);
});
test('scheduler heartbeat records success/failure without exposing exception data and fences late completions',async t=>{
  const h=await harness();t.after(()=>h.close());const env={DB:h.db};
  await trackScheduled(env,async()=>{});
  assert.equal((await h.db.prepare("SELECT * FROM runtime_heartbeats WHERE name='cron'").first()).status,'ok');
  await assert.rejects(trackScheduled(env,async()=>{throw new Error('secret-provider-payload');}));
  const failed=await h.db.prepare("SELECT * FROM runtime_heartbeats WHERE name='cron'").first();
  assert.equal(failed.status,'error');assert.equal(failed.error_code,'scheduled_failed');assert.doesNotMatch(JSON.stringify(failed),/secret-provider/);
  let newerId;
  await trackScheduled(env,async()=>{
    await trackScheduled(env,async()=>{});
    newerId=(await h.db.prepare("SELECT invocation_id FROM runtime_heartbeats WHERE name='cron'").first()).invocation_id;
  });
  const latest=await h.db.prepare("SELECT * FROM runtime_heartbeats WHERE name='cron'").first();
  assert.equal(latest.status,'ok');assert.equal(latest.invocation_id,newerId);
  assert.equal((await h.db.prepare('SELECT COUNT(*) AS n FROM runtime_heartbeats').first()).n,1);
});
