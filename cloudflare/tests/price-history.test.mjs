import test from 'node:test';
import assert from 'node:assert/strict';
import {harness,register,request} from './harness.mjs';
import {config,offer,source,waitFor} from './fixtures.mjs';
import {priceIdentity,summarize,cutoff} from '../src/price-history-model.js';
import {annotatePrices,cleanPriceHistory} from '../src/price-history.js';

test('price comparison separates travel conditions but shares equivalent queries',()=>{
  const c={adults:1,currency:'HKD'},o=offer();
  const identity=priceIdentity(c,o);
  for(const change of [{adults:2},{currency:'CNY'},{max_stops:0},{max_duration_hours:8},{mode:'weekend'},
    {time_windows:{outbound:{start:'2027-01-01T00:00',end:'2027-01-01T05:59'}}}]) assert.notEqual(priceIdentity({...c,...change},o),identity);
  for(const change of [{baggage:{checkedBag:1}},{outbound:{...o.outbound,stops:1}},{inbound:null},
    {inbound:{...o.inbound,to:'SZX'}},{outbound:{...o.outbound,departureTime:'2027-02-01T10:00:00'}}])assert.notEqual(priceIdentity(c,{...o,...change}),identity);
  assert.equal(priceIdentity({...c,comparison:true,budget:2000,locale:'en',destination_selections:['country:SG']},o),identity);
  assert.equal(priceIdentity(c,{...o,price:500,outbound:{...o.outbound,flight:'XX1'}}),identity);
});
test('median rules use sampled days, exact 10% boundaries and evidence age',()=>{
  const at='2026-11-05T12:00:00.000Z',points=Array.from({length:7},(_,i)=>({day:`2026-11-0${i+1}`,price:1000,last_at:at}));
  assert.equal(summarize(points,at,900,at).level,'low');
  assert.equal(summarize(points,at,1100,at).level,'high');
  assert.equal(summarize(points,at,950,at).level,'typical');
  assert.equal(summarize(points.slice(0,6),at,100,at).level,'collecting');
  assert.equal(summarize(points,cutoff(at),800,at).full_window,true);
  assert.equal(summarize(points,'2026-11-01T12:00:00Z',800,at).full_window,false);
  assert.equal(summarize(points.slice(0,1),at,1000,at).lowest,false);
});
test('real task transaction saves discovery and watch quotes, cache deduplicates, histories survive run expiry and isolate accounts',async t=>{
  const upstream={price:1200},h=await harness({bindings:{QUERY_ENABLED:'true'},outbound:source(upstream)});t.after(()=>h.close());
  const a=await register(h),b=await register(h,'price-other@example.test');
  const c=config({date_mode:'fixed',budget:0});
  async function query(){const submitted=await request(h,'/api/deals',c,a);assert.equal(submitted.status,202);return waitFor(async()=>{const result=await request(h,'/api/deals/'+submitted.data.id,undefined,a);return result.data.status==='done'?result.data:null;});}
  const first=await query(),insight=first.offers[0].price_history;
  assert.equal(insight.sampled_days,1);assert.equal(insight.level,'collecting');assert.equal(insight.lowest,false);
  assert.equal((await query()).cached,true);
  assert.equal((await h.db.prepare('SELECT COUNT(*) n FROM price_samples').first()).n,1);
  assert.equal((await request(h,'/api/price-history/'+insight.id,undefined,b)).status,404);
  assert.equal((await request(h,'/api/price-history/'+insight.id)).status,401);
  const stored=await h.db.prepare('SELECT * FROM price_samples').first();
  for(let i=1;i<=7;i++)await h.db.prepare('INSERT INTO price_samples VALUES(?,?,?,?,?)').bind(stored.user_id,stored.series_id,new Date(Date.now()-i*86400000).toISOString(),1000,'[]').run();
  // Many intraday expensive quotes must not skew daily minima or sampled-day count.
  for(let i=1;i<=10;i++)await h.db.prepare('INSERT INTO price_samples VALUES(?,?,?,?,?)').bind(stored.user_id,stored.series_id,new Date(Date.now()-i*1000).toISOString(),9000,'[]').run();
  await h.db.prepare('UPDATE price_series SET first_at=?').bind(new Date(Date.now()-8*86400000).toISOString()).run();
  const evaluated=(await query()).offers[0].price_history;
  assert.equal(evaluated.sampled_days,8);assert.equal(evaluated.median,1000);assert.equal(evaluated.level,'high');assert.equal(evaluated.maximum,9000);
  const details=await request(h,'/api/price-history/'+insight.id,undefined,a);assert.equal(details.status,200);assert.equal(details.data.points.length,8);
  // A watch with equivalent conditions contributes to the same price series.
  const watch=(await request(h,'/api/watches',c,a)).data.id;
  await request(h,`/api/watches/${watch}/check`,{},a);
  await waitFor(async()=>(await h.db.prepare('SELECT COUNT(*) n FROM observations WHERE watch_id=?').bind(watch).first()).n);
  const state=(await request(h,'/api/state',undefined,a)).data;
  assert.equal(state.observations[0].offer.price_history.id,insight.id);
  await h.db.prepare("DELETE FROM search_runs WHERE kind='deal'").run();
  assert.equal((await request(h,'/api/price-history/'+insight.id,undefined,a)).status,200);
  await h.db.prepare('INSERT INTO price_samples VALUES(?,?,?,?,?)').bind(stored.user_id,stored.series_id,new Date(Date.now()-91*86400000).toISOString(),1,'[]').run();
  const annotated=await annotatePrices(h.db,stored.user_id,first.config,first.offers);
  assert.equal(annotated[0].price_history.minimum,1000);
  const stale=await annotatePrices(h.db,stored.user_id,first.config,[{...first.offers[0],_checked_at:new Date(Date.now()-91*86400000).toISOString()}]);
  assert.equal(stale[0].price_history,null);
  await cleanPriceHistory(h.db);
  assert.equal((await h.db.prepare('SELECT COUNT(*) n FROM price_samples WHERE price=1').first()).n,0);
  const count=(await h.db.prepare('SELECT COUNT(*) n FROM price_samples').first()).n;
  await h.db.prepare('DELETE FROM source_cache').run();upstream.mode='empty';
  assert.equal((await query()).offers.length,0);
  assert.equal((await h.db.prepare('SELECT COUNT(*) n FROM price_samples').first()).n,count);
  await h.db.prepare('DELETE FROM source_cache').run();upstream.mode='malformed';
  const failed=await request(h,'/api/deals',c,a);
  await waitFor(async()=>(await request(h,'/api/deals/'+failed.data.id,undefined,a)).data.status==='error');
  assert.equal((await h.db.prepare('SELECT COUNT(*) n FROM price_samples').first()).n,count);
});
