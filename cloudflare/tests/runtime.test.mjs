import {test} from 'node:test';
import assert from 'node:assert/strict';
import {harness,request,register} from './harness.mjs';
test('Workers runtime, D1 migrations, static fonts, registration and session',async t=>{
  const h=await harness();t.after(()=>h.close());
  assert.equal((await request(h,'/')).status,200);
  const font=await h.mf.dispatchFetch('http://localhost/assets/im-fell-english-400.ttf');
  assert.equal(font.status,200);assert.equal((await font.arrayBuffer()).byteLength,194992);
  const chinese=await h.mf.dispatchFetch('http://localhost/assets/fare-scout-serif-vf.woff2');
  assert.equal(chinese.status,200);assert.match(chinese.headers.get('Content-Type'),/font\/woff2/);
  assert.equal(new TextDecoder().decode((await chinese.arrayBuffer()).slice(0,4)),'wOF2');
  assert.equal((await request(h,'/api/state')).status,401);
  const session=await register(h);
  assert.ok((await request(h,'/api/auth/session',undefined,session)).data.user);
  assert.equal((await request(h,'/api/state',undefined,session)).data.email.configured,false);
});
