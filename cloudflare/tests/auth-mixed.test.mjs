import {test} from 'node:test';
import assert from 'node:assert/strict';
import {harness,request} from './harness.mjs';
import {authenticator} from './passkey-fixtures.mjs';

test('mixed mode offers both methods and preserves independent credential checks',async t=>{
 const h=await harness({bindings:{AUTH_MODE:'mixed',PASSKEY_ORIGIN:'http://localhost'}});t.after(()=>h.close());
 assert.deepEqual((await request(h,'/api/auth/session')).data.auth_methods,['passkey','password']);
 const passwordSession={ip:'password-test'};
 assert.equal((await request(h,'/api/auth/register',{email:'password@example.test',password:'mixed-test-password'},passwordSession)).status,200);
 assert.equal((await request(h,'/api/auth/logout',{},passwordSession)).status,200);
 assert.equal((await request(h,'/api/auth/login',{email:'password@example.test',password:'wrong'},passwordSession)).status,401);
 assert.equal((await request(h,'/api/auth/login',{email:'password@example.test',password:'mixed-test-password'},passwordSession)).status,200);
 const key=authenticator(),passkeySession={ip:'passkey-test'};
 const options=await request(h,'/api/auth/passkey/register/options',{email:'passkey@example.test'},passkeySession);
 assert.equal(options.status,200);
 assert.equal((await request(h,'/api/auth/passkey/register/verify',{response:key.register(options.data.options)},passkeySession)).status,200);
 assert.equal((await request(h,'/api/auth/logout',{},passkeySession)).status,200);
 assert.equal((await request(h,'/api/auth/login',{email:'passkey@example.test',password:'invented-password'},{ip:'no-password-test'})).status,401);
 const login=await request(h,'/api/auth/passkey/login/options',{},passkeySession);
 assert.equal((await request(h,'/api/auth/passkey/login/verify',{response:key.login(login.data.options)},passkeySession)).status,200);
 assert.equal((await request(h,'/api/state',undefined,passkeySession)).data.user.email,'passkey@example.test');
 assert.equal((await request(h,'/api/state',undefined,passwordSession)).data.user.email,'password@example.test');
 assert.equal((await request(h,'/api/auth/register',{email:'passkey@example.test',password:'takeover-password'},{ip:'duplicate-test'})).status,409);
 const row=await h.db.prepare('SELECT password_hash FROM users WHERE email=?').bind('passkey@example.test').first();
 assert.equal(row.password_hash,null);
});
