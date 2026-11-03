import {test} from 'node:test';
import assert from 'node:assert/strict';
import {harness,request,register} from './harness.mjs';
import {config,offer,source,waitFor} from './fixtures.mjs';
async function watch(h,session,overrides) {
  const r=await request(h,'/api/watches',config(overrides),session);
  assert.equal(r.status,201,JSON.stringify(r.data));return r.data.id;
}
async function check(h,session,id) {
  const r=await request(h,`/api/watches/${id}/check`,{},session);assert.equal(r.status,202,JSON.stringify(r.data));
  await waitFor(async()=>!(await h.db.prepare('SELECT running FROM watches WHERE id=?').bind(id).first()).running);
}
test('watch batches, price comparison, alert deduplication and recoverable account-owned removals',async t=>{
  const upstream={price:1200,sse:true};const h=await harness({bindings:{QUERY_ENABLED:'true'},outbound:source(upstream)});t.after(()=>h.close());
  const a=await register(h),b=await register(h,'other@example.test'),id=await watch(h,a);
  await check(h,a,id);
  let state=(await request(h,'/api/state',undefined,a)).data;
  assert.equal(state.observations.length,1);assert.equal(state.alerts.length,1);assert.equal(state.alerts[0].reason,'budget');
  assert.equal(state.observations[0].offer.price,1200);
  upstream.price=1000;await check(h,a,id);
  assert.equal((await request(h,'/api/state',undefined,a)).data.alerts.length,2);
  upstream.price=1000;await check(h,a,id);
  assert.equal((await request(h,'/api/state',undefined,a)).data.alerts.length,2);
  assert.equal((await request(h,`/api/watches/${id}/delete`,{},b)).status,404);
  assert.equal((await request(h,'/api/state',undefined,b)).data.observations.length,0);
  state=(await request(h,'/api/state',undefined,a)).data;
  const observation=state.observations[0].id;
  assert.equal((await request(h,`/api/offers/${observation}/delete`,{},a)).status,200);
  assert.ok((await request(h,'/api/state',undefined,a)).data.observations[0].dismissed_at);
  assert.equal((await request(h,`/api/offers/${observation}/restore`,{},a)).status,200);
  assert.equal((await request(h,`/api/watches/${id}/delete`,{},a)).status,200);
  assert.equal((await request(h,'/api/state',undefined,a)).data.watches.length,0);
  assert.equal((await request(h,`/api/watches/${id}/restore`,{},a)).status,200);
  state=(await request(h,'/api/state',undefined,a)).data;
  assert.equal(state.watches[0].auto_enabled,false);assert.equal(state.watches[0].alerts_enabled,false);
  assert.equal(state.observations.length,1);
  assert.equal((await request(h,`/api/watches/${id}/history`,undefined,a)).data.summary.total,3);
  assert.equal((await request(h,'/api/alerts/read',{through_id:state.alerts[0].id},a)).status,200);
  assert.ok((await request(h,'/api/state',undefined,a)).data.alerts.every(a=>a.read_at));
});
test('empty and malformed source responses remain distinct; transient failures retry durably',async t=>{
  const upstream={mode:'empty'};const h=await harness({bindings:{QUERY_ENABLED:'true'},outbound:source(upstream)});t.after(()=>h.close());
  const a=await register(h),id=await watch(h,a);
  await check(h,a,id);assert.equal((await request(h,'/api/state',undefined,a)).data.observations[0].status,'empty');
  upstream.mode='malformed';await check(h,a,id);assert.equal((await request(h,'/api/state',undefined,a)).data.observations[0].status,'error');
  upstream.mode='failure';assert.equal((await request(h,`/api/watches/${id}/check`,{},a)).status,202);
  for(let attempt=1;attempt<=3;attempt++) {
    await waitFor(async()=>await h.db.prepare('SELECT id FROM search_tasks WHERE attempts=? AND status=?').bind(attempt,attempt===3?'error':'pending').first());
    if(attempt<3) { await h.db.prepare("UPDATE search_tasks SET available_at='2000-01-01' WHERE status='pending'").run();await (await h.mf.getWorker('fare-scout')).scheduled({cron:'* * * * *'}); }
  }
  await waitFor(async()=>!(await h.db.prepare('SELECT running FROM watches WHERE id=?').bind(id).first()).running);
  const state=(await request(h,'/api/state',undefined,a)).data;
  assert.equal(state.observations[0].status,'error');assert.ok(state.watches[0].failure_count);assert.equal(state.observations.length,1);
  assert.equal((await request(h,`/api/watches/${id}/history`,undefined,a)).data.summary.total,3);
});
test('multi-origin flexible discovery, validation, query args and owner-scoped results',async t=>{
  const upstream={offers:[offer(1200),offer(1000)]};const h=await harness({bindings:{QUERY_ENABLED:'true'},outbound:source(upstream)});t.after(()=>h.close());
  const a=await register(h),b=await register(h,'another@example.test');
  const r=await request(h,'/api/deals',config({origins:['airport:HKG','airport:SZX'],min_nights:2,max_nights:5,weekdays:[]}),a);
  assert.equal(r.status,202,JSON.stringify(r.data));
  assert.equal((await request(h,'/api/deals/'+r.data.id,undefined,b)).status,404);
  const result=await waitFor(async()=>{const p=await request(h,'/api/deals/'+r.data.id,undefined,a);return p.data.status==='done'?p.data:null;});
  assert.equal(result.completed,2);assert.equal(result.offers.length,1);assert.equal(result.offers[0].price,1000);
  assert.equal((await request(h,'/api/state',undefined,a)).data.observations.length,0);
  assert.equal(upstream.args.departureDateTo.split('/').length,3);assert.equal(upstream.args.nights_in_dst_from,2);
  assert.equal((await request(h,'/api/deals',config({min_nights:9,max_nights:2}),a)).status,400);
  assert.equal((await request(h,'/api/watches',config({adults:1.5}),a)).status,400);
  assert.equal((await request(h,'/api/watches',config({start:'2027-02-30',end:'2027-03-05'}),a)).status,400);
});
test('delete during an in-flight source request fences late observations and alerts',async t=>{
  let release;const upstream={price:1000,block:new Promise(r=>release=r)};
  const h=await harness({bindings:{QUERY_ENABLED:'true'},outbound:source(upstream)});t.after(()=>h.close());
  const a=await register(h),id=await watch(h,a);
  await request(h,`/api/watches/${id}/check`,{},a);
  await waitFor(()=>upstream.args);
  await request(h,`/api/watches/${id}/delete`,{},a);release();
  await waitFor(async()=>!(await h.db.prepare("SELECT id FROM search_tasks WHERE status='running'").first()));
  assert.equal((await h.db.prepare('SELECT COUNT(*) n FROM observations').first()).n,0);
  assert.equal((await h.db.prepare('SELECT COUNT(*) n FROM alerts').first()).n,0);
});
