import {test} from 'node:test';
import assert from 'node:assert/strict';
import {harness,request,register} from './harness.mjs';
test('nickname saves to the signed-in account, validates input, and preserves identity',async t=>{
 const h=await harness();t.after(()=>h.close());const a=await register(h),b=await register(h,'second@example.test');
 const before=(await request(h,'/api/state',undefined,a)).data.user;
 assert.equal((await request(h,'/api/profile',{name:'  新昵称  ',user_id:2},a)).status,200);
 const after=(await request(h,'/api/state',undefined,a)).data.user;
 assert.equal(after.name,'新昵称');assert.equal(after.email,before.email);assert.equal(after.notification_email,before.notification_email);
 assert.notEqual((await request(h,'/api/state',undefined,b)).data.user.name,'新昵称');
 for(const name of ['', ' '.repeat(5), '字'.repeat(41),null,{}])assert.equal((await request(h,'/api/profile',{name},a)).status,400);
 assert.equal((await request(h,'/api/profile',{name:'unauth'})).status,401);
 assert.equal((await request(h,'/api/profile',{name:'csrf'}, {cookie:a.cookie})).status,403);
});
test('avatar storage is bounded, validates JPEG dimensions, and stays private to its owner',async t=>{
 const {readFile}=await import('node:fs/promises');const avatar=await readFile('cloudflare/tests/avatar-fixture.txt','utf8');
 const h=await harness();t.after(()=>h.close());const a=await register(h),b=await register(h,'other-avatar@example.test');
 assert.equal((await request(h,'/api/profile',{avatar},a)).status,200);
 assert.match((await request(h,'/api/state',undefined,a)).data.profile.avatar,/^data:image\/jpeg;base64,/);
 assert.equal((await request(h,'/api/state',undefined,b)).data.profile.avatar,null);
 for(const value of ['data:image/svg+xml,<svg/>','data:image/jpeg;base64,eA==',42])assert.equal((await request(h,'/api/profile',{avatar:value},a)).status,400);
 assert.equal((await request(h,'/api/profile',{avatar:null},a)).status,200);
 assert.equal((await request(h,'/api/state',undefined,a)).data.profile.avatar,null);
});
