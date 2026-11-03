import {test} from 'node:test';
import assert from 'node:assert/strict';
import {harness,request} from './harness.mjs';
import {authenticator} from './passkey-fixtures.mjs';
const bindings={AUTH_MODE:'passkey',PASSKEY_ORIGIN:'http://localhost'};
async function register(h,session={},address='passkey@example.test') {
 const key=authenticator();
 const options=await request(h,'/api/auth/passkey/register/options',{email:address,name:'Passkey QA'},session);
 assert.equal(options.status,200,JSON.stringify(options.data));
 const response=key.register(options.data.options);
 const verified=await request(h,'/api/auth/passkey/register/verify',{response},session);
 assert.equal(verified.status,200,JSON.stringify(verified.data));return {key,session,response};
}
test('Passkey registration and signature login issue opaque sessions; passwords disabled',async t=>{
 const h=await harness({bindings});t.after(()=>h.close());
 assert.equal((await request(h,'/api/auth/session')).data.auth_mode,'passkey');
 assert.equal((await request(h,'/api/auth/register',{email:'x@example.test',password:'not-used'})).status,404);
 const {key,session,response}=await register(h);
 assert.equal((await request(h,'/api/state',undefined,session)).status,200);
 assert.equal((await h.db.prepare('SELECT password_hash FROM users').first()).password_hash,null);
 assert.equal((await request(h,'/api/auth/passkey/register/verify',{response},session)).status,400);
 await request(h,'/api/auth/logout',{},session);
 assert.equal((await request(h,'/api/state',undefined,session)).status,401);
 const options=await request(h,'/api/auth/passkey/login/options',{},session);
 assert.equal(options.data.options.userVerification,'required');
 const login=key.login(options.data.options);
 const signedIn=await request(h,'/api/auth/passkey/login/verify',{response:login,remember:true},session);
 assert.equal(signedIn.status,200);assert.match(signedIn.response.headers.get('Set-Cookie'),/Max-Age=2592000/);
 assert.equal((await request(h,'/api/state',undefined,session)).data.user.email,'passkey@example.test');
 assert.equal((await request(h,'/api/auth/passkey/login/verify',{response:login},session)).status,400);
 assert.equal((await h.db.prepare('SELECT counter FROM passkeys').first()).counter,1);
});
test('Passkey challenges reject wrong origin, expired/missing cookie, missing user verification and replay',async t=>{
 const h=await harness({bindings});t.after(()=>h.close());
 for(const variant of [{origin:'https://evil.test'},{uv:false},{challenge:'wrong-challenge'}]) {
  const session={},key=authenticator();
  const options=await request(h,'/api/auth/passkey/register/options',{email:'invalid@example.test'},session);
  const response=key.register(options.data.options,variant);
  assert.equal((await request(h,'/api/auth/passkey/register/verify',{response},session)).status,400);
 }
 assert.equal((await h.db.prepare('SELECT COUNT(*) n FROM users').first()).n,0);
 const session={},key=authenticator(),o=await request(h,'/api/auth/passkey/register/options',{email:'expire@example.test'},session);
 const response=key.register(o.data.options);
 assert.equal((await request(h,'/api/auth/passkey/register/verify',{response},{})).status,400);
 await h.db.prepare('UPDATE passkey_challenges SET expires_at=0').run();
 assert.equal((await request(h,'/api/auth/passkey/register/verify',{response},session)).status,400);
 assert.equal((await request(h,'/api/auth/passkey/login/options',{},session,{Origin:'https://evil.test'})).status,403);
});
test('Passkey signatures, user handles, counters and account ownership are checked',async t=>{
 const h=await harness({bindings});t.after(()=>h.close());
 const a=await register(h,{},'a@example.test'),b=await register(h,{},'b@example.test');
 for(const variant of [{tamper:true},{uv:false},{origin:'https://evil.test'},{rpID:'evil.test'},{userHandle:b.key.handle}]) {
  const s={},o=await request(h,'/api/auth/passkey/login/options',{},s);
  const r=await request(h,'/api/auth/passkey/login/verify',{response:a.key.login(o.data.options,variant)},s);
  assert.equal(r.status,401,JSON.stringify(variant));
 }
 const s={},o=await request(h,'/api/auth/passkey/login/options',{},s);
 await request(h,'/api/auth/passkey/login/verify',{response:a.key.login(o.data.options,{counter:5})},s);
 const again=await request(h,'/api/auth/passkey/login/options',{},s);
 assert.equal((await request(h,'/api/auth/passkey/login/verify',{response:a.key.login(again.data.options,{counter:4})},s)).status,401);
 assert.equal((await request(h,'/api/state',undefined,b.session)).data.user.email,'b@example.test');
});
