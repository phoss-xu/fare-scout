import {test} from 'node:test';
import assert from 'node:assert/strict';
import {harness,request,register} from './harness.mjs';
import {config,offer,source,waitFor} from './fixtures.mjs';
async function done(h,id,s) {
  return waitFor(async()=>{const r=await request(h,'/api/deals/'+id,undefined,s);return r.data.status==='done'?r.data:null;});
}
test('state stays small with 1000 samples; history is paged, owner-scoped and uses the full-history minimum',async t=>{
  const h=await harness();t.after(()=>h.close());const a=await register(h),b=await register(h,'other-perf@example.test');
  const id=(await request(h,'/api/watches',config({alerts_enabled:false}),a)).data.id;
  const o=offer(1200),queries=[];
  for(let i=0;i<1005;i++) queries.push(h.db.prepare(`INSERT INTO observations(watch_id,destination,departure,arrival,checked_at,status,offer,route_key,search_id,batch_id)
    VALUES(?,'SIN','2027-01-01','2027-01-04',?,'ok',?,'same-route','airport:SIN',?)`).bind(id,'2026-11-03T00:00:00Z',JSON.stringify({...o,price:i===0?800:1200}),String(i)));
  for(let i=0;i<queries.length;i+=100) await h.db.batch(queries.slice(i,i+100));
  const state=await request(h,'/api/state',undefined,a);assert.equal(state.data.observations.length,1);
  assert.ok(JSON.stringify(state.data).length<12000);assert.equal((await h.db.prepare('SELECT COUNT(*) n FROM observations').first()).n,1005);
  const page=await request(h,`/api/watches/${id}/history`,undefined,a);
  assert.equal(page.data.observations.length,100);assert.equal(page.data.summary.total,1005);assert.equal(page.data.observations[0].monitored_min,800);
  const next=await request(h,`/api/watches/${id}/history?before=${page.data.next_before}`,undefined,a);
  assert.ok(next.data.observations.every(o=>o.id<page.data.next_before));
  assert.equal((await request(h,`/api/watches/${id}/history`,undefined,b)).status,404);
  assert.equal((await request(h,`/api/watches/${id}/history?before=-1`,undefined,a)).status,400);
  const pending=(await h.db.prepare('SELECT COUNT(*) n FROM search_runs').first()).n;
  await request(h,'/api/state',undefined,a);assert.equal((await h.db.prepare('SELECT COUNT(*) n FROM search_runs').first()).n,pending);
});
test('latest batch keeps every route, hides stale successes after empty/error, and retains dismissed records',async t=>{
  const h=await harness();t.after(()=>h.close());const s=await register(h);
  const id=(await request(h,'/api/watches',config({alerts_enabled:false}),s)).data.id;
  const insert=(destination,batch,status,scope='country:SG')=>h.db.prepare(`INSERT INTO observations(watch_id,destination,departure,arrival,checked_at,status,search_id,batch_id)
    VALUES(?,?,'2027-01-01','2027-01-04','now',?,?,?)`).bind(id,destination,status,scope,batch).run();
  await insert('SIN','batch-1','empty');await insert('SIN','batch-2','empty');await insert('XSP','batch-2','empty');
  assert.equal((await request(h,'/api/state',undefined,s)).data.observations.length,2);
  await insert('SG','batch-3','error');
  const rows=(await request(h,'/api/state',undefined,s)).data.observations;assert.equal(rows.length,1);assert.equal(rows[0].status,'error');
});
test('identical discovery shares an in-flight query across users, exposes original time, and expires safely',async t=>{
  const upstream={price:1200};const h=await harness({bindings:{QUERY_ENABLED:'true'},outbound:source(upstream)});t.after(()=>h.close());
  const a=await register(h),b=await register(h,'cache-other@example.test');const c=config({min_nights:2,max_nights:5,weekdays:[]});
  const first=await request(h,'/api/deals',c,a);const r1=await done(h,first.data.id,a);assert.equal(upstream.calls,2);
  const second=await request(h,'/api/deals',c,b);const r2=await done(h,second.data.id,b);
  assert.equal(upstream.calls,2);assert.equal(r2.cached,true);assert.equal(r2.checked_at,r1.checked_at);
  await h.db.prepare("UPDATE source_cache SET expires_at='2000-01-01'").run();upstream.price=1100;
  const third=await request(h,'/api/deals',c,a);const r3=await done(h,third.data.id,a);
  assert.equal(upstream.calls,4);assert.equal(r3.offers[0].price,1100);assert.equal(r3.cached,false);
  const fourth=await request(h,'/api/deals',{...c,adults:2},b);await done(h,fourth.data.id,b);assert.equal(upstream.calls,6);
});
test('in-flight discovery coalesces without consuming retries or caching source failures',async t=>{
  let release;const upstream={price:1200,block:new Promise(r=>release=r)};
  const h=await harness({bindings:{QUERY_ENABLED:'true'},outbound:source(upstream)});t.after(()=>h.close());
  const a=await register(h),b=await register(h,'inflight@example.test'),c=config({min_nights:2,max_nights:5,weekdays:[]});
  const first=await request(h,'/api/deals',c,a);await waitFor(()=>upstream.args);
  const second=await request(h,'/api/deals',c,b);release();await done(h,first.data.id,a);await done(h,second.data.id,b);
  assert.equal(upstream.calls,2);assert.ok((await h.db.prepare('SELECT MAX(attempts) n FROM search_tasks').first()).n<=1);
  await h.db.prepare('DELETE FROM source_cache').run();upstream.mode='malformed';
  const failure=await request(h,'/api/deals',c,a);
  await waitFor(async()=>(await request(h,'/api/deals/'+failure.data.id,undefined,a)).data.status==='error');
  assert.equal((await h.db.prepare('SELECT COUNT(*) n FROM source_cache').first()).n,0);
});
test('completed runs do not exhaust admission; assets revalidate with security headers and API is private',async t=>{
  const h=await harness({bindings:{QUERY_ENABLED:'true'},outbound:source({mode:'empty'})});t.after(()=>h.close());const s=await register(h);
  await h.db.batch(Array.from({length:100},(_,i)=>h.db.prepare(`INSERT INTO search_runs(id,kind,owner_id,config,status,total,job_count,created_at,finished_at)
    VALUES(?,'deal',1,'{}','done',0,0,'2000-01-01','2000-01-01')`).bind('completed-'+i)));
  assert.equal((await request(h,'/api/deals',config({min_nights:2,max_nights:5,weekdays:[]}),s)).status,202);
  const asset=await h.mf.dispatchFetch('http://localhost/app.js');
  assert.equal(asset.status,200);assert.match(asset.headers.get('Cache-Control'),/must-revalidate/);
  assert.match(asset.headers.get('Content-Security-Policy'),/frame-ancestors 'none'/);
  const etag=asset.headers.get('ETag');assert.ok(etag);await asset.body.cancel();
  const cached=await h.mf.dispatchFetch('http://localhost/app.js',{headers:{'If-None-Match':etag}});assert.equal(cached.status,304);
  assert.equal((await request(h,'/api/state',undefined,s)).response.headers.get('Cache-Control'),'no-store');
});
test('incremental migration backfills existing batches without deleting history or account data',async t=>{
  const {readFile}=await import('node:fs/promises');
  const h=await harness({beforeMigration:'0009'});t.after(()=>h.close());const s=await register(h);
  // Use the pre-migration store directly: the new summary endpoint needs the pending migration.
  await h.db.prepare("INSERT INTO watches(id,owner_id,config,created_at) VALUES(1,1,'{}','now')").run();
  for(const [id,scope,batch] of [[1,'SIN','old'],[2,'SIN','new'],[3,'SIN','new'],[4,'BKK',null],[5,'BKK',null]]) {
    await h.db.prepare(`INSERT INTO observations(id,watch_id,destination,departure,arrival,checked_at,status,search_id,batch_id)
      VALUES(?,1,?,'2027-01-01','2027-01-04','now','empty',?,?)`).bind(id,scope,scope,batch).run();
  }
  const sql=await readFile('cloudflare/migrations/0009_performance.sql','utf8'),triggers=[];
  const simple=sql.replace(/^--.*$/gm,'').replace(/CREATE TRIGGER[\s\S]*?\nEND;/g,body=>{triggers.push(body);return '';});
  for(const statement of [...simple.split(';').map(s=>s.trim()).filter(Boolean),...triggers]) await h.db.prepare(statement).run();
  assert.deepEqual((await h.db.prepare('SELECT id FROM current_observations ORDER BY id').all()).results.map(r=>r.id),[2,3,5]);
  assert.equal((await h.db.prepare('SELECT COUNT(*) n FROM observations').first()).n,5);
  assert.ok((await request(h,'/api/auth/session',undefined,s)).data.user);
});
test('concurrent requests respect the shared source slots across separate background invocations',async t=>{
  let release,active=0,peak=0;const gate=new Promise(r=>release=r);
  const upstream=async request=>{
    const body=await request.json();if(body.method==='initialize') return Response.json({jsonrpc:'2.0',id:body.id,result:{}});
    active++;peak=Math.max(peak,active);await gate;active--;
    return Response.json({jsonrpc:'2.0',id:body.id,result:{structuredContent:{itineraries:[]}}});
  };
  const h=await harness({bindings:{QUERY_ENABLED:'true'},outbound:upstream});t.after(()=>h.close());const s=await register(h);
  const result=await request(h,'/api/deals',config({origins:['airport:HKG','airport:SZX'],destinations:['airport:SIN','airport:BKK','airport:NRT'],min_nights:2,max_nights:5,weekdays:[]}),s);
  await Promise.all(Array.from({length:8},()=>request(h,'/api/deals/'+result.data.id,undefined,s)));
  await waitFor(()=>active===4);assert.equal(peak,4);
  assert.equal((await h.db.prepare("SELECT COUNT(*) n FROM search_tasks WHERE status='running'").first()).n,4);
  release();await done(h,result.data.id,s);assert.equal(peak,4);
});
test('alerts and removed offers page independently without losing unread counts or owner isolation',async t=>{
  const h=await harness();t.after(()=>h.close());const a=await register(h),b=await register(h,'pages-other@example.test');
  const id=(await request(h,'/api/watches',config({alerts_enabled:false}),a)).data.id;
  await h.db.batch(Array.from({length:105},(_,i)=>h.db.prepare(`INSERT INTO observations(id,watch_id,destination,departure,arrival,checked_at,status,dismissed_at,batch_id)
    VALUES(?,?,'SIN','2027-01-01','2027-01-04','now','ok','now',?)`).bind(i+1,id,String(i))));
  await h.db.batch(Array.from({length:105},(_,i)=>h.db.prepare(`INSERT INTO alerts(observation_id,watch_id,destination,departure,arrival,created_at,reason,price)
    VALUES(?,?,'SIN','2027-01-01','2027-01-04','now','budget',0)`).bind(i+1,id)));
  let state=(await request(h,'/api/state',undefined,a)).data;
  assert.equal(state.alerts.length,100);assert.equal(state.alert_page.unread,105);assert.equal(state.removed_offers.length,100);
  const older=(await request(h,'/api/alerts?before='+state.alert_page.next_before,undefined,a)).data;assert.equal(older.alerts.length,5);assert.equal(older.next_before,null);
  const removed=(await request(h,'/api/removed-offers?before='+state.removed_next_before,undefined,a)).data;assert.equal(removed.offers.length,5);
  assert.equal((await request(h,'/api/alerts',undefined,b)).data.alerts.length,0);
  assert.equal((await request(h,'/api/removed-offers',undefined,b)).data.offers.length,0);
});
