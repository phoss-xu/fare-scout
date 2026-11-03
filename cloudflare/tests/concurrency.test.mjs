import {test} from 'node:test';
import assert from 'node:assert/strict';
import {harness,request,register} from './harness.mjs';
import {config,offer,waitFor} from './fixtures.mjs';

test('four distinct source tasks overlap across polling requests; partial quotes arrive before slower regions',async t=>{
  const gates=new Map(),seen=[];let active=0,peak=0,releasing=false;
  const outbound=async request=>{
    const body=await request.json();
    if(body.method==='initialize') return Response.json({jsonrpc:'2.0',id:body.id,result:{}});
    const destination=body.params.arguments.flyTo;
    active++;peak=Math.max(peak,active);seen.push(destination);
    try {
      if(!releasing) await new Promise(resolve=>gates.set(destination,resolve));
      return Response.json({jsonrpc:'2.0',id:body.id,result:{structuredContent:{itineraries:[offer(1200,destination)]}}});
    } finally {active--;gates.delete(destination);}
  };
  const h=await harness({bindings:{QUERY_ENABLED:'true'},outbound});
  t.after(async()=>{releasing=true;for(const release of gates.values()) release();await h.close();});
  const session=await register(h);
  const destinations=['SIN','BKK','KUL','MNL','SGN','DPS'];
  const started=await request(h,'/api/deals',config({destinations:destinations.map(code=>'airport:'+code)}),session);
  assert.equal(started.status,202,JSON.stringify(started.data));
  const path=`/api/deals/${started.data.id}`;
  await waitFor(()=>active===4);
  await Promise.all([request(h,path,undefined,session),request(h,path,undefined,session),request(h,'/api/state',undefined,session)]);
  assert.equal(peak,4);assert.equal(new Set(seen).size,4);
  gates.values().next().value();
  const partial=await waitFor(async()=>{
    const result=(await request(h,path,undefined,session)).data;
    return result.completed===1 && result.offers.length===1?result:null;
  });
  assert.equal(partial.status,'running');assert.equal(partial.total,6);
  assert.equal(partial.failures,0);
  releasing=true;for(const release of gates.values()) release();
  const result=await waitFor(async()=>{const r=(await request(h,path,undefined,session)).data;return r.status==='done'?r:null;});
  assert.equal(result.completed,6);assert.equal(result.offers.length,6);
  assert.equal(peak,4);assert.deepEqual([...seen].sort(),destinations.sort());
  const tasks=(await h.db.prepare('SELECT attempts,status FROM search_tasks WHERE run_id=?').bind(started.data.id).all()).results;
  assert.ok(tasks.every(t=>t.attempts===1 && t.status==='done'));
});
