// Real ES256 protocol signatures against an isolated Python HTTP server.
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {authenticator} from '../cloudflare/tests/passkey-fixtures.mjs';
async function harness(t) {
 const dir=await mkdtemp(join(tmpdir(),'fare-local-passkeys-'));
 const python=spawn('python3',['-u','-c',`from app import store
from app.server import Handler,ThreadingHTTPServer
store.initialize()
s=ThreadingHTTPServer(('127.0.0.1',0),Handler)
print(s.server_port,flush=True)
s.serve_forever()`],{cwd:process.cwd(),env:{...process.env,FARE_SCOUT_DB:join(dir,'test.db')},stdio:['ignore','pipe','pipe']});
 let errors='';python.stderr.on('data',d=>errors+=d);
 t.after(async()=>{python.kill('SIGTERM');await new Promise(resolve=>python.once('close',resolve));await rm(dir,{recursive:true,force:true});});
 const port=await new Promise((resolve,reject)=>{python.stdout.once('data',d=>resolve(Number(String(d).trim())));python.once('error',reject);python.once('exit',code=>{if(code)reject(new Error(errors));});});
 const origin=`http://localhost:${port}`;
 async function call(path,data,session={},extra={}) {
  const r=await fetch(`http://localhost:${port}${path}`,{method:data===undefined?'GET':'POST',headers:{Host:`localhost:${port}`,Origin:origin,'Content-Type':'application/json','Cookie':Object.entries(session.cookies||{}).map(([k,v])=>`${k}=${v}`).join('; '),'X-CSRF-Token':session.csrf||'',...extra},body:data===undefined?undefined:JSON.stringify(data)});
  session.cookies ||= {};
  for(const cookie of r.headers.getSetCookie()){const [k,v]=cookie.split(';')[0].split('=');session.cookies[k]=v;}
  const body=await r.json();if(body.csrf_token)session.csrf=body.csrf_token;
  return {status:r.status,body,headers:r.headers};
 }
 async function account(email='local@example.test') {
  const s={};const r=await call('/api/auth/register',{email,password:'local-test-password'},s);assert.equal(r.status,200,JSON.stringify(r.body));return s;
 }
 async function bind(session,key=authenticator()) {
  const r=await call('/api/auth/passkey/bind/options',{},session);assert.equal(r.status,200,JSON.stringify(r.body));
  const response=key.register(r.body.options,{origin});
  const v=await call('/api/auth/passkey/bind/verify',{response},session);assert.equal(v.status,200,JSON.stringify(v.body));return key;
 }
 return {call,origin,account,bind};
}
test('bind existing password account, sign in with real signature, remember session, owner-scoped removal',async t=>{
 const h=await harness(t),a=await h.account(),b=await h.account('other@example.test'),key=await h.bind(a);
 assert.equal((await fetch(h.origin+'/vendor/passkeys.js')).status,200);
 assert.equal((await fetch(h.origin+'/local-passkeys.js')).status,200);
 assert.equal((await h.call('/api/auth/passkey/bind/options',{})).status,401);
 assert.equal((await h.call('/api/auth/passkey/list',{},a)).body.keys.length,1);
 assert.equal((await h.call('/api/auth/passkey/remove',{id:key.id},b)).status,200);
 assert.equal((await h.call('/api/auth/passkey/list',{},a)).body.keys.length,1);
 const s={},o=await h.call('/api/auth/passkey/login/options',{},s);
 const r=await h.call('/api/auth/passkey/login/verify',{response:key.login(o.body.options,{origin:h.origin}),remember:true},s);
 assert.equal(r.status,200,JSON.stringify(r.body));assert.equal(r.body.user.email,'local@example.test');
 assert.match(r.headers.get('set-cookie'),/Max-Age=2592000/);
 assert.equal((await h.call('/api/state',undefined,s)).status,200);
 assert.equal((await h.call('/api/auth/passkey/login/verify',{response:key.login(o.body.options,{origin:h.origin})},s)).status,400);
 await h.call('/api/auth/passkey/remove',{id:key.id},a);
 const next=await h.call('/api/auth/passkey/login/options',{},s);
 assert.equal((await h.call('/api/auth/passkey/login/verify',{response:key.login(next.body.options,{origin:h.origin,counter:2})},s)).status,401);
 assert.equal((await h.call('/api/auth/login',{email:'local@example.test',password:'local-test-password'},{})).status,200);
});
test('challenges bind to browser session, origin and account; registration checks UV and is single-use',async t=>{
 const h=await harness(t),a=await h.account(),b=await h.account('other@example.test');
 assert.equal((await h.call('/api/auth/passkey/bind/options',{}, {cookies:a.cookies})).status,403);
 assert.equal((await h.call('/api/auth/passkey/bind/options',{},a,{Origin:'https://evil.test'})).status,403);
 let o=await h.call('/api/auth/passkey/bind/options',{},a),key=authenticator();
 const stolen={...b,cookies:{...b.cookies,fare_passkey_flow:a.cookies.fare_passkey_flow}};
 assert.equal((await h.call('/api/auth/passkey/bind/verify',{response:key.register(o.body.options,{origin:h.origin})},stolen)).status,400);
 for(const variant of [{uv:false},{origin:'https://evil.test'},{challenge:'wrong'}]) {
  o=await h.call('/api/auth/passkey/bind/options',{},a);
  assert.equal((await h.call('/api/auth/passkey/bind/verify',{response:key.register(o.body.options,{origin:h.origin,...variant})},a)).status,400);
 }
 assert.equal((await h.call('/api/auth/passkey/list',{},a)).body.keys.length,0);
});
test('signature, user verification, RP ID, user handle and signature counter are verified',async t=>{
 const h=await harness(t),a=await h.account(),key=await h.bind(a);
 for(const variant of [{tamper:true},{uv:false},{origin:'https://evil.test'},{rpID:'evil.test'},{userHandle:'wrong'}]) {
  const s={},o=await h.call('/api/auth/passkey/login/options',{},s);
  const r=await h.call('/api/auth/passkey/login/verify',{response:key.login(o.body.options,{origin:h.origin,...variant})},s);
  assert.ok([400,401].includes(r.status),JSON.stringify(r.body));
  assert.equal((await h.call('/api/auth/session',undefined,s)).body.user,null);
 }
 const s={},o=await h.call('/api/auth/passkey/login/options',{},s);
 assert.equal((await h.call('/api/auth/passkey/login/verify',{response:key.login(o.body.options,{origin:h.origin,counter:5})},s)).status,200);
 const next=await h.call('/api/auth/passkey/login/options',{},s);
 assert.equal((await h.call('/api/auth/passkey/login/verify',{response:key.login(next.body.options,{origin:h.origin,counter:4})},s)).status,400);
});
