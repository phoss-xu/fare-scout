import {test} from 'node:test';
import assert from 'node:assert/strict';
import {future} from './fixtures.mjs';
import {harness,request,register} from './harness.mjs';
const account='a'.repeat(32);
const bindings={MAIL_ENABLED:'true',MAIL_PROVIDER:'cloudflare',MAIL_FROM:'notifications@example.test',CF_EMAIL_ACCOUNT_ID:account,
  CF_EMAIL_API_TOKEN:'test-only',PASSKEY_ORIGIN:'http://localhost'};
const ok=result=>Response.json({success:true,result});
async function fixture(t) {
  const rows=[],sent=[],calls=[];let broken=false,failSend=false;
  const h=await harness({bindings,mockEmail:true,outbound:async r=>{
    const url=new URL(r.url);calls.push({method:r.method,url:r.url});
    if(url.hostname==='email-capture.test') {sent.push(await r.json());if(failSend) return new Response('mock fail',{status:503});return Response.json({messageId:'mock-message'});}
    assert.equal(url.hostname,'api.cloudflare.com');assert.equal(r.headers.get('Authorization'),'Bearer test-only');
    if(broken) return new Response('secret response must not escape',{status:503});
    if(r.method==='POST') {const {email}=await r.json();const row={email,id:String(rows.length+1),verified:null};rows.push(row);return ok(row);}
    const id=url.pathname.split('/').at(-1);
    if(id!=='addresses') return rows.find(row=>row.id===id)?ok(rows.find(row=>row.id===id)):new Response('',{status:404});
    return ok(rows);
  }});t.after(()=>h.close());
  const a=await register(h);
  const status=async s=>(await request(h,'/api/state',undefined,s||a)).data.email;
  const expire=()=>h.db.prepare("UPDATE email_destinations SET checked_at='2000-01-01'").run();
  return {h,a,rows,sent,calls,status,expire,break(){broken=true;},failDelivery(value){failSend=value;}};
}
test('self-service verification, per-user consent, CSRF, changed recipient and single-use confirmation',async t=>{
  const f=await fixture(t),{h,a,rows,sent}=f;
  assert.equal((await f.status()).verification,'unverified');
  assert.equal((await request(h,'/api/email/verify',{})).status,401);
  assert.equal((await request(h,'/api/email/verify',{}, {cookie:a.cookie})).status,403);
  assert.equal((await request(h,'/api/email/verify',{},a)).status,200);
  assert.equal(rows.length,1);assert.equal((await f.status()).verification,'pending');assert.equal(sent.length,0);
  await request(h,'/api/email/verify',{recipient:'attacker@example.test'},a);assert.equal(rows.length,1);
  rows[0].verified=new Date().toISOString();await f.expire();
  assert.equal((await request(h,'/api/email/check',{},a)).status,200);
  assert.equal((await f.status()).verification,'confirm');assert.equal(sent.length,1);
  assert.equal(sent[0].to,'qa@example.test');assert.ok(sent[0].html.includes('&lt;')===false);
  const value=/#email-confirm=([a-f0-9]{64})/.exec(sent[0].text)[1];
  const b=await register(h,'other@example.test');
  assert.equal((await request(h,'/api/email/confirm',{token:value},b)).status,400);
  assert.equal((await request(h,'/api/email/confirm',{token:value},a)).status,200);
  assert.equal((await request(h,'/api/email/confirm',{token:value},a)).status,400);
  assert.equal((await f.status()).configured,true);
  await request(h,'/api/email',{recipient:'new@example.test'},a);
  assert.equal((await f.status()).configured,false);assert.equal((await f.status()).verification,'unverified');
  assert.equal((await f.status(b)).verification,'unverified');
});
test('existing verified provider address still requires consent from the current app account',async t=>{
  const f=await fixture(t);f.rows.push({id:'preexisting',email:'qa@example.test',verified:new Date().toISOString()});
  await request(f.h,'/api/email/verify',{},f.a);
  assert.equal((await f.status()).configured,false);assert.equal(f.sent.length,1);
  await request(f.h,'/api/email/verify',{},f.a);assert.equal(f.sent.length,1);
  const value=/#email-confirm=([a-f0-9]{64})/.exec(f.sent[0].text)[1];
  await f.h.db.prepare('UPDATE email_consents SET expires_at=0').run();
  assert.equal((await request(f.h,'/api/email/confirm',{token:value},f.a)).status,400);
});
test('provider failure is distinct from unverified; saved state never polls the control plane',async t=>{
  const f=await fixture(t);await request(f.h,'/api/email/verify',{},f.a);
  const before=f.calls.length;await f.status();await f.status();assert.equal(f.calls.length,before);
  f.break();await f.expire();
  const r=await request(f.h,'/api/email/check',{},f.a);assert.equal(r.status,503);
  assert.ok(!JSON.stringify(r.data).includes('secret response'));assert.equal((await f.status()).verification,'error');
});
test('disabled verification makes no network request; request limits survive requests',async t=>{
  const h=await harness({bindings:{MAIL_PROVIDER:'cloudflare',CF_EMAIL_ACCOUNT_ID:account}});t.after(()=>h.close());const a=await register(h);
  assert.equal((await request(h,'/api/email/verify',{},a)).status,503);
  const f=await fixture(t);
  for(let i=0;i<10;i++) assert.equal((await request(f.h,'/api/email/verify',{},f.a)).status,200);
  assert.equal((await request(f.h,'/api/email/verify',{},f.a)).status,429);
  assert.equal(f.rows.length,1);
});

async function seedDeliveries(h,a) {
  const at=new Date(Date.now()-60000).toISOString(),day=new Date(Date.now()+8*3600000).toISOString().slice(0,10);
  await request(h,'/api/daily',{enabled:true},a);
  await h.db.batch([
    h.db.prepare("INSERT INTO watches(id,config,created_at,owner_id) VALUES(1,'{}',?,1)").bind(at),
    h.db.prepare('INSERT INTO schedules(watch_id,alerts_enabled) VALUES(1,1)'),
    h.db.prepare("INSERT INTO observations(id,watch_id,destination,departure,arrival,checked_at,status) VALUES(1,1,'SIN',?,?,?,'ok')").bind(future(10),future(13),at),
    h.db.prepare("INSERT INTO alerts(id,observation_id,watch_id,destination,departure,arrival,created_at,reason,price) VALUES(1,1,1,'SIN',?,?,?,'budget',1000)").bind(future(10),future(13),at),
    h.db.prepare("INSERT INTO email_outbox(alert_id,status,next_attempt) VALUES(1,'pending',?)").bind(at),
    h.db.prepare(`INSERT INTO search_runs(id,kind,owner_id,config,status,total,job_count,created_at) VALUES('mail-run','deal',1,'{"daily":true,"adults":1}','done',12,12,?)`).bind(at),
    h.db.prepare("INSERT INTO daily_editions(id,user_id,day,scheduled_at,run_id,status,total,checked_at,next_attempt) VALUES('mail-run',1,?,?,'mail-run','ready',12,?,?)").bind(day,at,at,at)
  ]);
}
async function due(h) {
  await h.db.prepare("UPDATE email_outbox SET next_attempt='2000-01-01'").run();
  await h.db.prepare("UPDATE daily_editions SET next_attempt='2000-01-01'").run();
}
test('both queues wait without burning attempts, retry native sends, and block changed or revoked recipients',async t=>{
  const f=await fixture(t),{h,a}=f;await seedDeliveries(h,a);
  const worker=await h.mf.getWorker('fare-scout'),tick=()=>worker.scheduled({cron:'* * * * *'});
  await tick();
  assert.equal((await h.db.prepare('SELECT status FROM email_outbox').first()).status,'waiting_verification');
  assert.equal((await h.db.prepare('SELECT attempts FROM email_outbox').first()).attempts,0);
  assert.equal((await h.db.prepare('SELECT mail_status FROM daily_editions').first()).mail_status,'waiting_verification');
  await request(h,'/api/email/verify',{},a);f.rows[0].verified=new Date().toISOString();await f.expire();
  await request(h,'/api/email/check',{},a);
  const value=/#email-confirm=([a-f0-9]{64})/.exec(f.sent[0].text)[1];await request(h,'/api/email/confirm',{token:value},a);
  await request(h,'/api/email',{recipient:'unverified@example.test'},a);await due(h);await tick();assert.equal(f.sent.length,1);
  await request(h,'/api/email',{recipient:'qa@example.test'},a);f.rows[0].verified=null;await due(h);await tick();assert.equal(f.sent.length,1);
  f.rows[0].verified=new Date().toISOString();f.failDelivery(true);await due(h);await tick();
  assert.equal((await h.db.prepare('SELECT status FROM email_outbox').first()).status,'retry');
  assert.equal((await h.db.prepare('SELECT mail_status FROM daily_editions').first()).mail_status,'retry');
  f.failDelivery(false);await due(h);await tick();await tick();
  assert.equal((await h.db.prepare('SELECT status FROM email_outbox').first()).status,'sent');
  assert.equal((await h.db.prepare('SELECT mail_status FROM daily_editions').first()).mail_status,'sent');
  assert.equal(f.sent.length,5);assert.ok(f.sent.every(m=>m.to==='qa@example.test'));
  assert.equal(f.sent[1].headers['X-Fare-Scout-Delivery-ID'],f.sent[3].headers['X-Fare-Scout-Delivery-ID']);
  assert.ok(f.sent[3].text.includes('HK$1000'));
});
test('native email binding accepts the structured confirmation message in local simulation',async t=>{
  const h=await harness({bindings,nativeEmail:true,outbound:async r=>{
    assert.equal(new URL(r.url).hostname,'api.cloudflare.com');
    return ok([{id:'native-test',email:'qa@example.test',verified:new Date().toISOString()}]);
  }});t.after(()=>h.close());const a=await register(h);
  assert.equal((await request(h,'/api/email/verify',{},a)).status,200);
  assert.ok((await h.db.prepare('SELECT token_hash FROM email_consents').first()).token_hash);
});
test('destination lookup traverses pages and creation capacity failures remain errors',async t=>{
  let mode='pages',posts=0;const calls=[];
  const h=await harness({bindings,mockEmail:true,outbound:async r=>{
    const url=new URL(r.url);calls.push(r.url);
    if(url.hostname==='email-capture.test') return Response.json({messageId:'mock'});
    if(r.method==='POST') {posts++;return new Response('',{status:409});}
    if(mode==='full') return ok([]);
    const page=Number(url.searchParams.get('page'));
    return Response.json({success:true,result:page===1?Array.from({length:50},(_,i)=>({id:String(i),email:`unrelated-${i}@example.test`})): [{id:'found',email:'qa@example.test',verified:null}],result_info:{total_pages:2}});
  }});t.after(()=>h.close());const a=await register(h);
  assert.equal((await request(h,'/api/email/verify',{},a)).status,200);assert.equal(posts,0);
  assert.ok(calls.some(url=>url.includes('page=2')));
  await request(h,'/api/email',{recipient:'capacity@example.test'},a);mode='full';
  assert.equal((await request(h,'/api/email/verify',{},a)).status,503);assert.equal(posts,1);
  const status=(await request(h,'/api/state',undefined,a)).data.email;
  assert.equal(status.verification,'error');assert.equal(status.configured,false);
});
