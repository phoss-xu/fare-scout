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
test('empty flexible night selection defaults to the 2–5 night range upstream',async t=>{
  const upstream={offers:[offer(1200)]};const h=await harness({bindings:{QUERY_ENABLED:'true'},outbound:source(upstream)});t.after(()=>h.close());
  const session=await register(h);
  const r=await request(h,'/api/deals',config({nights:[]}),session);
  assert.equal(r.status,202,JSON.stringify(r.data));
  await waitFor(async()=>{const response=await request(h,`/api/deals/${r.data.id}`,undefined,session);return response.data.status==='done'?response.data:null;});
  assert.equal(upstream.args.nights_in_dst_from,2);assert.equal(upstream.args.nights_in_dst_to,5);
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

test('selected disjoint weekends create exact tasks and keep a quote for each weekend in the same city',async t=>{
  const {future}=await import('./fixtures.mjs');
  const first=new Date(future(20)+'T12:00:00Z');first.setUTCDate(first.getUTCDate()+(6-first.getUTCDay()+7)%7);
  const shift=n=>new Date(first.getTime()+n*86400000).toISOString().slice(0,10);
  const pairs=[{start:shift(0),end:shift(1)},{start:shift(14),end:shift(15)}];
  const calls=[];
  const outbound=async request=>{
    const body=await request.json();
    if(body.method==='initialize') return Response.json({jsonrpc:'2.0',id:body.id,result:{}});
    const args=body.params.arguments;calls.push(args);
    const iso=value=>value.split('/').reverse().join('-');
    const o=offer();
    o.outbound.departureTime=iso(args.departureDate)+'T10:00:00';o.outbound.arrivalTime=iso(args.departureDate)+'T14:00:00';
    o.inbound.departureTime=iso(args.returnDate)+'T16:00:00';o.inbound.arrivalTime=iso(args.returnDate)+'T20:00:00';
    return Response.json({jsonrpc:'2.0',id:body.id,result:{structuredContent:{itineraries:[o]}}});
  };
  const h=await harness({bindings:{QUERY_ENABLED:'true'},outbound});t.after(()=>h.close());
  const session=await register(h);
  const r=await request(h,'/api/deals',config({date_mode:'fixed',date_pairs:pairs,start:pairs[0].start,end:pairs[1].end}),session);
  assert.equal(r.status,202,JSON.stringify(r.data));
  const result=await waitFor(async()=>{
    const response=await request(h,`/api/deals/${r.data.id}`,undefined,session);return response.data.status==='done'?response.data:null;
  });
  assert.equal(result.total,2);assert.equal(result.offers.length,2);assert.equal(calls.length,2);
  assert.deepEqual(result.offers.map(o=>o.outbound.departureTime.slice(0,10)).sort(),pairs.map(p=>p.start));
  assert.ok(calls.every(args=>args.returnDate && !('departureDateTo' in args) && !('nights_in_dst_from' in args)));
  const jobs=(await h.db.prepare('SELECT job FROM search_tasks WHERE run_id=?').bind(r.data.id).all()).results;
  assert.deepEqual(jobs.map(j=>JSON.parse(j.job).window.start).sort(),pairs.map(p=>p.start));
});
test('one-way discovery passes through source, D1 queue and saved form without return legs or alerts',async t=>{
  const one=offer();delete one.inbound;
  const upstream={offers:[one]},h=await harness({bindings:{QUERY_ENABLED:'true'},outbound:source(upstream)});t.after(()=>h.close());
  const a=await register(h),value=config({currency:'CNY',trip_type:'oneway',date_mode:'fixed',nights:[]});
  const saved=await request(h,'/api/search-presets',{config:value},a);
  assert.equal(saved.status,200);const restored=saved.data.presets[0].config;
  assert.equal(restored.currency,'CNY');assert.equal(restored.trip_type,'oneway');assert.equal(restored.start,restored.end);
  const task=await request(h,'/api/deals',restored,a);assert.equal(task.status,202);
  const result=await waitFor(async()=>{const r=await request(h,'/api/deals/'+task.data.id,undefined,a);return r.data.status==='done'?r.data:null;});
  assert.equal(result.offers.length,1);assert.equal(result.offers[0].inbound,undefined);assert.equal(result.offers[0].currency,'CNY');assert.equal(upstream.args.currency,'CNY');
  for(const key of ['returnDate','nights_in_dst_from','nights_in_dst_to']) assert.equal(key in upstream.args,false);
  const state=(await request(h,'/api/state',undefined,a)).data;
  assert.equal(state.observations.length,0);assert.equal(state.alerts.length,0);
});

test('one-way watch keeps outbound-only observations and isolated price-drop alerts',async t=>{
  const flight=offer(1200);delete flight.inbound;const upstream={offers:[flight]};
  const h=await harness({bindings:{QUERY_ENABLED:'true'},outbound:source(upstream)});t.after(()=>h.close());
  const a=await register(h),id=await watch(h,a,{trip_type:'oneway',budget:0});
  await check(h,a,id);
  let state=(await request(h,'/api/state',undefined,a)).data;
  assert.equal(state.observations.length,1);assert.equal(state.observations[0].offer.inbound,undefined);assert.equal(state.alerts.length,0);
  assert.ok(!('returnDate' in upstream.args));
  upstream.offers=[{...flight,price:1000}];await check(h,a,id);
  state=(await request(h,'/api/state',undefined,a)).data;
  assert.equal(state.alerts.length,1);assert.equal(state.alerts[0].reason,'drop');
  assert.deepEqual(JSON.parse(state.observations[0].route_key).slice(2,4),['','']);
});
test('route comparison keeps distinct flights through source and D1 result aggregation without alerts',async t=>{
  const first=offer(1000),later=offer(1200);later.outbound.departureTime=later.outbound.departureTime.slice(0,10)+'T18:00:00';
  const upstream={offers:[first,later,offer(1600)]};
  const h=await harness({bindings:{QUERY_ENABLED:'true'},outbound:source(upstream)});t.after(()=>h.close());
  const session=await register(h);
  const r=await request(h,'/api/deals',config({date_mode:'fixed',comparison:true,budget:0}),session);
  assert.equal(r.status,202,JSON.stringify(r.data));
  const result=await waitFor(async()=>{const p=await request(h,'/api/deals/'+r.data.id,undefined,session);return p.data.status==='done'?p.data:null;});
  assert.equal(upstream.args.one_for_city,false);assert.deepEqual(result.offers.map(o=>o.price),[1000,1200]);
  assert.equal(result.config.comparison,true);
  const state=(await request(h,'/api/state',undefined,session)).data;
  assert.equal(state.observations.length,0);assert.equal(state.alerts.length,0);assert.equal(state.watches.length,0);
  for(const extra of [{destinations:[]},{date_mode:'range'},{destinations:['country:JP']}]) {
    assert.equal((await request(h,'/api/deals',config({date_mode:'fixed',comparison:true,...extra}),session)).status,400);
  }
});
