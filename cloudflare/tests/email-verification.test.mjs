import {test} from 'node:test';
import assert from 'node:assert/strict';
import {harness,request,register} from './harness.mjs';
const bindings={MAIL_ENABLED:'true',MAIL_PROVIDER:'cloudflare',MAIL_FROM:'notifications@example.test',CF_EMAIL_ACCOUNT_ID:'a'.repeat(32),PASSKEY_ORIGIN:'http://localhost'};
async function fixture(t){
 const sent=[];let fail=false;
 const h=await harness({bindings,mockEmail:true,outbound:async r=>{
  assert.equal(new URL(r.url).hostname,'email-capture.test');
  if(fail)return new Response('',{status:503});sent.push(await r.json());return Response.json({messageId:'mock'});
 }});t.after(()=>h.close());const user=await register(h);
 const link=()=>/#email-confirm=([a-f0-9]{64})/.exec(sent.at(-1).text)[1];
 return {h,user,sent,link,fail(v){fail=v;}};
}
test('saving and sending, single-use link, and app verification without routing APIs or control-plane token',async t=>{
 const f=await fixture(t),{h,user}=f;
 const r=await request(h,'/api/email/verify',{recipient:'Recipient@example.test'},user);
 assert.equal(r.status,200);assert.equal(r.data.email.recipient,'recipient@example.test');assert.equal(r.data.email.verification,'pending');assert.equal(r.data.email.configured,false);
 assert.equal(f.sent.length,1);assert.equal(f.sent[0].to,'recipient@example.test');
 const value=f.link(),stored=await h.db.prepare('SELECT * FROM email_consents').first();
 assert.notEqual(stored.token_hash,value);assert.ok(f.sent[0].text.includes('http://localhost/#email-confirm='));
 assert.equal((await request(h,'/api/email/confirm',{token:value},user)).status,200);
 const state=(await request(h,'/api/state',undefined,user)).data.email;assert.equal(state.verification,'verified');assert.equal(state.configured,true);
 assert.equal((await request(h,'/api/email/confirm',{token:value},user)).status,400);
});
test('cooldown, expiry and replacement link are enforced',async t=>{
 const f=await fixture(t),{h,user}=f;
 await request(h,'/api/email/verify',{},user);const old=f.link();
 assert.equal((await request(h,'/api/email/verify',{},user)).status,429);assert.equal(f.sent.length,1);
 await h.db.prepare('UPDATE email_consents SET expires_at=0').run();
 assert.equal((await request(h,'/api/email/confirm',{token:old},user)).status,400);
 await h.db.prepare('UPDATE email_consents SET requested_at=?').bind(Date.now()/1000-61).run();
 assert.equal((await request(h,'/api/email/verify',{},user)).status,200);assert.notEqual(f.link(),old);
 assert.equal((await request(h,'/api/email/confirm',{token:old},user)).status,400);
 assert.equal((await request(h,'/api/email/confirm',{token:f.link()},user)).status,200);
});
test('links cannot verify a different user or a changed recipient',async t=>{
 const f=await fixture(t),{h,user}=f;await request(h,'/api/email/verify',{},user);const value=f.link();
 const other=await register(h,'other@example.test');
 assert.equal((await request(h,'/api/email/confirm',{token:value},other)).status,400);
 await request(h,'/api/email',{recipient:'changed@example.test'},user);
 assert.equal((await request(h,'/api/email/confirm',{token:value},user)).status,400);
 assert.equal((await request(h,'/api/state',undefined,user)).data.email.configured,false);
});
test('send failure clears the failed token, and retry works',async t=>{
 const f=await fixture(t);f.fail(true);
 assert.ok((await request(f.h,'/api/email/verify',{},f.user)).status>=500);
 assert.equal((await f.h.db.prepare('SELECT token_hash FROM email_consents').first()).token_hash,null);
 f.fail(false);assert.equal((await request(f.h,'/api/email/verify',{},f.user)).status,200);assert.equal(f.sent.length,1);
});
test('verified status controls delivery for the current user and recipient',async t=>{
 const {build}=await import('esbuild');const out=await build({entryPoints:['cloudflare/src/mail.js'],bundle:true,format:'esm',platform:'browser',write:false});
 const {sendText}=await import('data:text/javascript;base64,'+Buffer.from(out.outputFiles[0].text).toString('base64'));
 const f=await fixture(t);let count=0;const env={...bindings,DB:f.h.db,EMAIL:{send:async()=>{count++;}}};
 await assert.rejects(sendText(env,'qa@example.test','test','test','mock',1),/waiting_verification/);
 await request(f.h,'/api/email/verify',{},f.user);await request(f.h,'/api/email/confirm',{token:f.link()},f.user);
 await sendText(env,'qa@example.test','test','test','mock',1);assert.equal(count,1);
 await assert.rejects(sendText(env,'different@example.test','test','test','mock',1),/waiting_verification/);
 await assert.rejects(sendText(env,'qa@example.test','test','test','mock',1,async()=>false),/waiting_verification/);assert.equal(count,1);
});
test('native local email binding exposes verification availability when enabled',async t=>{
 const h=await harness({bindings,nativeEmail:true});t.after(()=>h.close());const user=await register(h);
 const state=(await request(h,'/api/state',undefined,user)).data.email;
 assert.equal(state.verification_available,true);assert.equal(state.verification,'unverified');
});
