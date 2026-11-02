import {test} from 'node:test';
import assert from 'node:assert/strict';
import {harness} from './harness.mjs';
import {future} from './fixtures.mjs';
async function seed(h) {
  // These fixture rows exist only in the temporary simulator database.
  await h.db.batch([
    h.db.prepare("INSERT INTO users(id,email,name,notification_email,password_hash,created_at) VALUES(1,'qa@example.test','QA','recipient@example.test','fixture-only','now')"),
    h.db.prepare("INSERT INTO watches(id,config,created_at,owner_id) VALUES(1,'{}','now',1)"),
    h.db.prepare('INSERT INTO schedules(watch_id,alerts_enabled) VALUES(1,1)'),
    h.db.prepare("INSERT INTO observations(id,watch_id,destination,departure,arrival,checked_at,status) VALUES(1,1,'SIN',?,? ,?,'ok')").bind(future(10),future(13),new Date().toISOString()),
    h.db.prepare("INSERT INTO alerts(id,observation_id,watch_id,destination,departure,arrival,created_at,reason,price) VALUES(1,1,1,'SIN',?,?,?,'budget',1000)").bind(future(10),future(13),new Date().toISOString()),
    h.db.prepare("INSERT INTO email_outbox(alert_id,status,next_attempt) VALUES(1,'pending','2000-01-01')")
  ]);
}
test('mail defaults off; mock HTTPS delivery retries with the same idempotency key and owner recipient',async t=>{
  const seen=[];
  const bindings={MAIL_ENABLED:'true',RESEND_API_KEY:'test-only',MAIL_FROM:'sender@example.test'};
  const h=await harness({bindings,outbound:async r=>{assert.equal(new URL(r.url).hostname,'api.resend.com');seen.push({key:r.headers.get('Idempotency-Key'),body:await r.json()});return seen.length===1?new Response('failure',{status:503}):Response.json({id:'mock-only'});}});t.after(()=>h.close());
  await seed(h);const worker=await h.mf.getWorker('fare-scout');
  await worker.scheduled({cron:'* * * * *'});
  assert.equal((await h.db.prepare('SELECT status FROM email_outbox').first()).status,'retry');
  await h.db.prepare("UPDATE email_outbox SET next_attempt='2000-01-01'").run();
  await worker.scheduled({cron:'* * * * *'});
  assert.equal((await h.db.prepare('SELECT status FROM email_outbox').first()).status,'sent');
  assert.deepEqual(seen[0].body.to,['recipient@example.test']);assert.equal(seen[0].key,seen[1].key);
  await worker.scheduled({cron:'* * * * *'});assert.equal(seen.length,2);
});
test('disabled mail never makes an outgoing request',async t=>{
  const h=await harness();t.after(()=>h.close());await seed(h);
  await (await h.mf.getWorker('fare-scout')).scheduled({cron:'* * * * *'});
  assert.equal((await h.db.prepare('SELECT status FROM email_outbox').first()).status,'waiting_config');
  assert.equal((await h.db.prepare('SELECT attempts FROM email_outbox').first()).attempts,0);
});
