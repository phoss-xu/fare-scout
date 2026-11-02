import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtemp,readFile,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {harness,request} from './harness.mjs';
test('offline export preserves hashes and evidence, excludes sessions, pauses jobs and old email',async t=>{
  const dir=await mkdtemp(path.join(tmpdir(),'fare-export-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  const source=path.join(dir,'source.db'),output=path.join(dir,'import.sql');
  execFileSync('python3',['-c',`
from app import store,accounts,sessions
store.DB=__import__('pathlib').Path(__import__('sys').argv[1]);store.initialize()
u=accounts.register({'email':'migrate@example.test','password':'migrate-pass'})
sessions.issue(u['id'])
with store.connect() as d:
 d.execute("INSERT INTO watches(id,config,created_at,owner_id,running) VALUES(1,'{\\"origin\\":\\"HKG\\",\\"destinations\\":[\\"SIN\\"]}','now',?,1)",(u['id'],))
 d.execute("INSERT INTO schedules(watch_id,auto_enabled,alerts_enabled) VALUES(1,1,1)")
 d.execute("INSERT INTO observations(id,watch_id,destination,departure,arrival,checked_at,status,batch_id) VALUES(1,1,'SIN','2027-01-01','2027-01-03','now','empty','original')")
 d.execute("INSERT INTO alerts(id,observation_id,watch_id,destination,departure,arrival,created_at,reason,price) VALUES(1,1,1,'SIN','2027-01-01','2027-01-03','now','budget',1000)")
 d.execute("INSERT INTO email_outbox(alert_id,status,next_attempt) VALUES(1,'pending','now')")
`,source]);
  execFileSync('python3',['-c',`import sqlite3,sys
with sqlite3.connect(sys.argv[1]) as d:
 d.execute("ALTER TABLE observations ADD COLUMN task_id TEXT")
 d.execute("UPDATE observations SET task_id='old-worker-task'")
 d.execute("ALTER TABLE email_outbox ADD COLUMN lease_token TEXT")
 d.execute("ALTER TABLE email_outbox ADD COLUMN lease_until TEXT")
 d.execute("UPDATE email_outbox SET lease_token='old-lease',lease_until='2099-01-01'")
`,source]);
  const before=createHash('sha256').update(await readFile(source)).digest('hex');
  execFileSync('python3',['scripts/export_d1.py','--source',source,'--output',output]);
  assert.equal(createHash('sha256').update(await readFile(source)).digest('hex'),before);
  assert.equal((await stat(output)).mode&0o777,0o600);
  const sql=await readFile(output,'utf8');assert.doesNotMatch(sql,/INSERT INTO "sessions"|INSERT INTO "setup_tokens"/);
  const h=await harness();t.after(()=>h.close());
  // Generated INSERTs can contain newlines inside string literals; use SQLite's parser for splitting.
  const statements=JSON.parse(execFileSync('python3',['-c',`import sqlite3,json,sys
s=open(sys.argv[1]).read();parts=[];part=''
for char in s:
 part+=char
 if char==';' and sqlite3.complete_statement(part):parts.append(part);part=''
print(json.dumps(parts))`,output],{encoding:'utf8'}));
  await h.db.batch(statements.map(s=>h.db.prepare(s)));
  assert.equal((await h.db.prepare('SELECT running FROM watches').first()).running,0);
  assert.equal((await h.db.prepare('SELECT auto_enabled FROM schedules').first()).auto_enabled,0);
  assert.equal((await h.db.prepare('SELECT COUNT(*) n FROM sessions').first()).n,0);
  assert.equal((await h.db.prepare('SELECT batch_id FROM observations').first()).batch_id,'original');
  assert.equal((await h.db.prepare('SELECT task_id FROM observations').first()).task_id,null);
  assert.equal((await h.db.prepare('SELECT lease_token FROM email_outbox').first()).lease_token,null);
  assert.equal((await h.db.prepare('SELECT status FROM email_outbox').first()).status,'cancelled');
  assert.equal((await request(h,'/api/auth/login',{email:'migrate@example.test',password:'migrate-pass'})).status,200);
});

test('offline activation files issue a private, expiring, single-use capability only for a password-less account',async t=>{
  const dir=await mkdtemp(path.join(tmpdir(),'fare-activate-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  const output=path.join(dir,'activation.sql');
  execFileSync('python3',['scripts/create_d1_activation.py','--email','setup@example.test','--base-url','http://localhost','--output',output]);
  const link=await readFile(path.join(dir,'activation.link.txt'),'utf8'),token=new URL(link.trim()).hash.slice('#token='.length);
  assert.ok(token.length>=32);assert.equal((await stat(output)).mode&0o777,0o600);
  const h=await harness();t.after(()=>h.close());
  await h.db.prepare("INSERT INTO users(id,email,name,notification_email,created_at) VALUES(1,'setup@example.test','Setup','setup@example.test','now')").run();
  const sql=await readFile(output,'utf8');await h.db.batch(sql.split(';').map(s=>s.trim()).filter(Boolean).map(s=>h.db.prepare(s)));
  assert.equal((await request(h,'/api/auth/activate',{token,password:'activate-me'})).status,200);
  assert.equal((await request(h,'/api/auth/activate',{token,password:'activate-again'})).status,400);
});
