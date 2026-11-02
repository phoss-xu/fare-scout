import {test} from 'node:test';
import assert from 'node:assert/strict';
import {harness,request,register} from './harness.mjs';

async function seed(h,a) {
  await request(h,'/api/daily',{enabled:true},a);
  const p=await h.db.prepare('SELECT user_id FROM daily_preferences').first(),at=new Date(Date.now()-60000).toISOString();
  const day=new Date(Date.now()+8*3600000).toISOString().slice(0,10);
  await h.db.batch([
    h.db.prepare("INSERT INTO search_runs(id,kind,owner_id,config,status,total,job_count,created_at,finished_at) VALUES('daily-mail','deal',?,'{\"daily\":true,\"adults\":1}','done',12,12,?,?)").bind(p.user_id,at,at),
    h.db.prepare("INSERT INTO daily_editions(id,user_id,day,scheduled_at,run_id,status,total,checked_at,next_attempt) VALUES('daily-mail',?,?,?,'daily-mail','ready',12,?,?)").bind(p.user_id,day,at,at,at)
  ]);
}
test('daily mail retries via adapter with stable idempotency, actual owner recipient and no duplicate delivery',async t=>{
  const seen=[],h=await harness({bindings:{MAIL_ENABLED:'true',RESEND_API_KEY:'test-only',MAIL_FROM:'sender@example.test'},outbound:async r=>{
    assert.equal(new URL(r.url).hostname,'api.resend.com');seen.push({key:r.headers.get('Idempotency-Key'),body:await r.json()});
    return seen.length===1?new Response('mock error',{status:503}):Response.json({id:'mock'});
  }});t.after(()=>h.close());const a=await register(h);await seed(h,a);
  const worker=await h.mf.getWorker('fare-scout');await worker.scheduled({cron:'* * * * *'});
  assert.equal((await h.db.prepare('SELECT mail_status FROM daily_editions').first()).mail_status,'retry');
  await h.db.prepare("UPDATE daily_editions SET next_attempt='2000-01-01'").run();
  await worker.scheduled({cron:'* * * * *'});await worker.scheduled({cron:'* * * * *'});
  assert.equal(seen.length,2);assert.equal(seen[0].key,seen[1].key);assert.deepEqual(seen[0].body.to,['qa@example.test']);
  assert.ok(seen[0].body.text.includes('不代表市场上没有航班'));
  assert.equal((await h.db.prepare('SELECT mail_status FROM daily_editions').first()).mail_status,'sent');
});
test('changing push time reschedules an unsent edition; pausing cancels delivery',async t=>{
  const h=await harness();t.after(()=>h.close());const a=await register(h);await seed(h,a);
  const later=new Date(Date.now()+8*3600000+5*60000).toISOString().slice(11,16);
  await request(h,'/api/daily',{enabled:true,push_time:later},a);
  const e=await h.db.prepare('SELECT * FROM daily_editions').first();
  const p=await h.db.prepare('SELECT next_due FROM daily_preferences').first();
  if(new Date(Date.parse(p.next_due)+8*3600000).toISOString().slice(0,10)===e.day) assert.ok(Date.parse(e.scheduled_at)>Date.now());
  else assert.equal(e.mail_status,'cancelled');
  await request(h,'/api/daily',{enabled:false,push_time:later},a);
  await (await h.mf.getWorker('fare-scout')).scheduled({cron:'* * * * *'});
  assert.equal((await h.db.prepare('SELECT mail_status FROM daily_editions').first()).mail_status,'cancelled');
});
