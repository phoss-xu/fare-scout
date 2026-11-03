import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {harness,request,register} from './harness.mjs';
const fixture=()=>JSON.parse(readFileSync('tests/fixtures/trip-snapshot.json'));
test('trip APIs require auth and CSRF, isolate favorites and expose immutable whitelisted shares to guests',async()=>{
  const h=await harness();try {
    const a=await register(h,'trips-a@example.test'),b=await register(h,'trips-b@example.test');
    const s=fixture();
    assert.equal((await request(h,'/api/trips')).status,401);
    assert.equal((await request(h,'/api/trips',s,{cookie:a.cookie})).status,403);
    assert.equal((await request(h,'/api/shared-trips',s)).status,401);
    const saved=await request(h,'/api/trips',s,a);assert.equal(saved.status,200);assert.equal(saved.data.trips.length,1);
    assert.equal((await request(h,'/api/trips',undefined,b)).data.trips.length,0);
    const key=saved.data.trips[0].key;
    await request(h,'/api/trips',{action:'remove',key},b);
    assert.equal((await request(h,'/api/trips',undefined,a)).data.trips.length,1);
    const shared=await request(h,'/api/shared-trips',s,a);assert.equal(shared.status,201);const id=shared.data.id;
    assert.equal((await request(h,'/api/shared-trips',s,a)).data.id,id);
    const publicResult=await request(h,'/api/shared-trips/'+id);assert.equal(publicResult.status,200);
    const encoded=JSON.stringify(publicResult.data);for(const privateField of ['email','budget','user_id','fixture'])assert.ok(!encoded.includes(privateField));
    s.offer.price=900;
    assert.notEqual((await request(h,'/api/shared-trips',s,a)).data.id,id);
    assert.equal((await request(h,'/api/shared-trips/'+id)).data.snapshot.offer.price,1234);
    await request(h,'/api/trips',s,a);assert.equal((await request(h,'/api/trips',undefined,a)).data.trips.length,1);
    await request(h,'/api/trips',{action:'remove',key},a);assert.equal((await request(h,'/api/trips',undefined,a)).data.trips.length,0);
    assert.equal((await request(h,'/api/shared-trips/nope')).status,404);
    assert.equal((await request(h,'/api/trips',{...s,offer:{...s.offer,bookingUrl:'javascript:bad'}},a)).status,400);
    for(const table of ['watches','observations','alerts','email_outbox','search_runs'])assert.equal((await h.db.prepare(`SELECT COUNT(*) n FROM ${table}`).first()).n,0);
    const page=await request(h,'/share.html');assert.ok([200,307,308].includes(page.status));
  }finally{await h.close();}
});
