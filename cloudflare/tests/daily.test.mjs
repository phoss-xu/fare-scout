import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {harness,request,register} from './harness.mjs';
import {source} from './fixtures.mjs';

async function moduleAt(path) {
  const r=await build({entryPoints:[path],bundle:true,format:'esm',platform:'browser',write:false});
  return import('data:text/javascript;base64,'+Buffer.from(r.outputFiles[0].text).toString('base64'));
}
const travel=await moduleAt('cloudflare/src/travel-time.js'),daily=await moduleAt('cloudflare/src/daily.js');
const provider=await moduleAt('cloudflare/src/provider.js');
async function finishDaily(h,session) {
  const worker=await h.mf.getWorker('fare-scout');
  for(let tick=0;tick<12;tick++) {
    await worker.scheduled({cron:'* * * * *'});
    const state=(await request(h,'/api/daily',undefined,session)).data;
    if(state.edition && state.edition.status!=='preparing') return state;
  }
  throw new Error('Bounded Cron work did not complete the daily edition');
}

function weekend(start='2026-11-07',end='2026-11-09',origin='HKG') {
  const sun=new Date(Date.parse(start)+86400000).toISOString().slice(0,10);
  return {price:1000,bookingUrl:'https://example.test/booking',outbound:{from:origin,to:'SIN',departureTime:start+'T01:40:00',arrivalTime:start+'T05:40:00',durationSeconds:14400,stops:0},inbound:{from:'SIN',to:origin,departureTime:sun+'T20:20:00',arrivalTime:end+'T00:10:00',durationSeconds:13800,stops:0}};
}
test('Saturday dawn to Monday dawn keeps two full days and no leave; later Monday arrival needs leave',()=>{
  const o=weekend(),t=travel.travelTime(o);
  assert.equal(t.leave_days,0);assert.equal(t.full_days,2);assert.equal(t.red_eye,true);assert.equal(t.calendar_reference,false);
  o.inbound.arrivalTime='2026-11-09T10:00:00';
  assert.deepEqual(travel.travelTime(o).leave_dates,['2026-11-09']);
  assert.equal(travel.suitable(o,{max_leave_days:0,min_full_days:2},{off_end:'2026-11-08'}),null);
  assert.equal(travel.suitable(o,{max_leave_days:1,min_full_days:2},{off_end:'2026-11-08'}).leave_days,1);
  o.inbound.departureTime='2026-11-08T16:00:00';assert.equal(travel.travelTime(o).full_days,1);
});
test('mainland makeup workdays, official holidays, unknown years and destination clock boundaries',()=>{
  assert.equal(travel.dayInfo('2026-10-10').off,false);
  assert.equal(travel.dayInfo('2026-10-01').off,true);
  assert.equal(travel.travelTime(weekend('2026-10-10','2026-10-12')).leave_days,1);
  const reference=travel.travelTime(weekend('2027-01-02','2027-01-04'));
  assert.equal(reference.calendar_reference,true);
  const o=weekend();o.outbound.arrivalTime='2026-11-07T09:01:00';assert.equal(travel.travelTime(o).full_days,1);
  o.outbound.arrivalTime='2026-11-07T09:00:00';o.inbound.departureTime='2026-11-08T20:00:00';assert.equal(travel.travelTime(o).full_days,2);
});
test('push times use Shanghai timezone including midnight and exact scheduled minute',()=>{
  assert.equal(daily.nextDue('00:15',new Date('2026-11-02T15:00:00Z')),'2026-11-02T16:15:00.000Z');
  assert.equal(daily.nextDue('09:00',new Date('2026-11-02T01:00:00Z')),'2026-11-03T01:00:00.000Z');
  for(const invalid of [{push_time:'25:00'},{enabled:'true'},{origins:[]},{origins:['airport:PEK']},{max_leave_days:3},{adults:1.5},{budget:null}]) assert.throws(()=>daily.preferences(invalid));
});
test('query windows include next holiday and rotating weekends, bounded to twelve source requests',()=>{
  const c={...daily.defaults,max_leave_days:1},windows=travel.travelWindows(c,'2026-12-10');
  assert.ok(windows.length<=6);assert.ok(windows.some(w=>w.name==='元旦'));
  assert.ok(windows.every(w=>w.start>='2026-12-11' && w.max_nights<=14));
  const args=provider.argumentsFor({...c,daily:true,adults:1,max_stops:1,start:'2026-11-06',end:'2026-11-07',min_nights:1,max_nights:3,weekdays:[]},{origin_id:'airport:HKG'},true);
  assert.equal(args.one_for_city,false);assert.equal(args.nights_in_dst_from,1);
});
test('ranking retains preferred dawn flights for each city and compares price within leave/preference tier',()=>{
  const a={...weekend(),travel:{leave_days:0,red_eye:true,full_days:2}},b={...a,price:500,travel:{...a.travel,red_eye:false}};
  assert.equal(daily.rankOffers([b,a],daily.defaults)[0].price,1000);
  assert.equal(daily.rankOffers([a,b],{...daily.defaults,prefer_red_eye:false})[0].price,500);
});

test('daily preferences are owner-scoped, CSRF protected, persistent and separate from watch alerts',async t=>{
  const h=await harness();t.after(()=>h.close());const a=await register(h),b=await register(h,'other@example.test');
  assert.equal((await request(h,'/api/daily')).status,401);
  assert.equal((await request(h,'/api/daily',{enabled:true},{cookie:a.cookie})).status,403);
  assert.equal((await request(h,'/api/daily',{...daily.defaults,enabled:true,push_time:'21:35',max_leave_days:1},a)).status,200);
  assert.equal((await request(h,'/api/daily',undefined,a)).data.settings.push_time,'21:35');
  assert.equal((await request(h,'/api/daily',undefined,b)).data.settings.enabled,false);
  assert.equal((await request(h,'/api/state',undefined,a)).data.daily.settings.max_leave_days,1);
  assert.equal((await h.db.prepare('SELECT COUNT(*) n FROM watches').first()).n,0);
});
test('scheduled daily discovery survives repeated ticks, records useful real-shaped offers, queues no test notification',async t=>{
  const date=new Date(Date.now()+8*3600000).toISOString().slice(0,10),window=travel.travelWindows(daily.defaults,date)[0];
  const end=new Date(Date.parse(window.off_end)+86400000).toISOString().slice(0,10);
  const upstream={offers:[weekend(window.off_start,end)]};
  const h=await harness({bindings:{QUERY_ENABLED:'true'},outbound:source(upstream)});t.after(()=>h.close());const a=await register(h);
  await request(h,'/api/daily',{...daily.defaults,enabled:true},a);
  const due=new Date(Date.now()-60000).toISOString();await h.db.prepare('UPDATE daily_preferences SET next_due=?').bind(due).run();
  const worker=await h.mf.getWorker('fare-scout');await worker.scheduled({cron:'* * * * *'});
  assert.equal((await request(h,'/api/daily',undefined,a)).data.edition.status,'preparing');
  const state=await finishDaily(h,a);
  await worker.scheduled({cron:'* * * * *'});
  assert.equal(state.edition.status,'ready');assert.equal(state.edition.offers.length,1);
  assert.equal(state.edition.offers[0].travel.full_days,2);assert.equal(state.edition.offers[0].travel.leave_days,0);
  assert.equal(state.edition.mail_status,'waiting_config');assert.equal(state.edition.total,12);
  assert.equal((await h.db.prepare('SELECT COUNT(*) n FROM daily_editions').first()).n,1);
  assert.equal((await h.db.prepare('SELECT COUNT(*) n FROM alerts').first()).n,0);
  await request(h,'/api/daily',{...daily.defaults,enabled:false},a);
  assert.equal((await request(h,'/api/daily',undefined,a)).data.edition.mail_status,'cancelled');
});
test('complete source failures differ from successful empty daily editions',async t=>{
  for(const mode of ['empty','malformed']) {
    const h=await harness({bindings:{QUERY_ENABLED:'true'},outbound:source({mode})});t.after(()=>h.close());const a=await register(h);
    await request(h,'/api/daily',{...daily.defaults,enabled:true},a);
    await h.db.prepare('UPDATE daily_preferences SET next_due=?').bind(new Date(Date.now()-60000).toISOString()).run();
    const e=(await finishDaily(h,a)).edition;
    assert.equal(e.status,mode==='empty'?'ready':'error');assert.equal(e.failures,mode==='empty'?0:12);assert.deepEqual(e.offers,[]);
  }
});
