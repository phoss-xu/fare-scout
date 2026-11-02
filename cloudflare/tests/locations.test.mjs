import {test} from 'node:test';
import assert from 'node:assert/strict';
import {harness,register,request} from './harness.mjs';
test('prepared catalogue preserves Chinese, English and IATA discovery without leaking index metadata',async t=>{
 const h=await harness();t.after(()=>h.close());const session=await register(h);
 const find=async(q,kind='')=>(await request(h,'/api/locations?q='+encodeURIComponent(q)+'&kind='+kind,undefined,session)).data.locations;
 const hongKong=await find('HKG');assert.equal(hongKong[0].id,'city:HKG');assert.ok(hongKong.some(r=>r.id==='airport:HKG'));
 assert.ok((await find('香港')).some(r=>r.id==='airport:HKG'));
 assert.ok((await find('hong kong')).some(r=>r.id==='city:HKG'));
 assert.ok((await find('São Paulo')).some(r=>r.id==='city:SAO'));
 assert.ok((await find('成田')).some(r=>r.id==='airport:NRT'));
 assert.ok((await find('SIN','airport')).every(r=>r.kind==='airport'));
 assert.equal((await find('')).length,20);
 assert.deepEqual(await find('zzzzzz-no-such-place'),[]);
 for(const r of hongKong){assert.equal(Object.hasOwn(r,'fields'),false);assert.equal(Object.hasOwn(r,'content'),false);}
 assert.equal((await request(h,'/api/locations?kind=invalid',undefined,session)).status,400);
});
