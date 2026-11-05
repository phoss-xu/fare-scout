import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {build} from 'esbuild';
import {config,offer,future,source} from './fixtures.mjs';
const load=async path=>{
  const result=await build({entryPoints:[path],bundle:true,format:'esm',platform:'browser',write:false});
  return import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
};
const {validate,accepts}=await load('cloudflare/src/domain.js');
const {argumentsFor,search}=await load('cloudflare/src/provider.js');
const {snapshot}=await load('cloudflare/src/search-presets.js');
const j={origin_id:'airport:HKG',location_id:'airport:SIN'};
const windows=()=>({outbound:{start:future(19)+'T22:00',end:future(20)+'T10:00'},inbound:{start:future(23)+'T19:00',end:future(24)+'T03:00',basis:'arrival'}});
const input=extra=>config({date_mode:'windows',time_windows:windows(),...extra});
function python(code,value,flight) {
  return JSON.parse(execFileSync('python3',['-c',code,JSON.stringify(value),JSON.stringify(flight)],{encoding:'utf8'}));
}
test('cross-date windows validate and save identically in both runtimes',()=>{
  for(const trip_type of ['roundtrip','oneway']) {
    const value=input({trip_type}),c=validate(value,true);
    assert.deepEqual(c,python('import json,sys;from app.deals import validate;print(json.dumps(validate(json.loads(sys.argv[1]))))',value));
    assert.deepEqual(snapshot(value),python('import json,sys;from app.search_presets import snapshot;print(json.dumps(snapshot(json.loads(sys.argv[1]))))',value));
    assert.deepEqual(c.nights,[]);assert.deepEqual(c.weekdays,[]);
    assert.equal(c.time_windows.inbound!==undefined,trip_type==='roundtrip');
  }
});
test('airport-local minute boundaries, midnight, return basis and offset timestamps filter real leg fields',()=>{
  const c=validate(input(),true);
  for(const [time,expected] of [[future(19)+'T21:59:59+08:00',false],[future(19)+'T22:00:00+08:00',true],[future(20)+'T01:30:00+08:00',true],[future(20)+'T10:00:59+08:00',true],[future(20)+'T10:01:00+08:00',false]]) {
    const o=offer();o.outbound.departureTime=time;
    assert.equal(accepts(o,c,j),expected,time);
    assert.equal(python('import json,sys;from app.deals import validate,accepts;from app.locations import resolve;c=validate(json.loads(sys.argv[1]));print(json.dumps(accepts(json.loads(sys.argv[2]),c,resolve("airport:SIN"))))',input(),o),expected);
  }
  assert.equal(accepts(offer(),c,j),true);
  assert.equal(accepts(offer(),validate(input({time_windows:{...windows(),inbound:{...windows().inbound,basis:'departure'}}}),true),j),false);
  const late=offer();late.inbound.arrivalTime=future(24)+'T03:01:00';assert.equal(accepts(late,c,j),false);
  const missing=offer();delete missing.inbound.arrivalTime;assert.equal(accepts(missing,c,j),false);
  const wrongAirport=offer();wrongAirport.inbound.to='SZX';assert.equal(accepts(wrongAirport,c,j),false);
});
test('same-day early hours, all day, one-way and invalid windows',()=>{
  const value=input({trip_type:'oneway',time_windows:{outbound:{start:future(20)+'T01:00',end:future(20)+'T03:00'}}});
  const flight=offer();delete flight.inbound;flight.outbound.departureTime=future(20)+'T02:00:00';
  assert.equal(accepts(flight,validate(value,true),j),true);
  assert.equal(accepts(offer(),validate(value,true),j),false);
  value.time_windows.outbound={start:future(20)+'T00:00',end:future(20)+'T23:59'};
  flight.outbound.departureTime=future(20)+'T23:59:59';assert.equal(accepts(flight,validate(value,true),j),true);
  for(const outbound of [null,{start:future(20)+'T22:00',end:future(20)+'T03:00'},{start:future(20)+'T25:00',end:future(21)+'T03:00'},{start:'2027-02-30T01:00',end:'2027-03-01T03:00'},{start:future(20)+'T01:00+08:00',end:future(21)+'T03:00'},{start:future(20)+'T01:00',end:future(400)+'T03:00'}]) assert.throws(()=>validate(input({time_windows:{...windows(),outbound}}),true));
  assert.throws(()=>validate(input({time_windows:{...windows(),inbound:{...windows().inbound,basis:'unknown'}}}),true));
});
test('source query covers both departure dates and earlier return takeoffs, with exact filtering before city minimum',()=>{
  const c=validate(input(),true),args=argumentsFor(c,j,true),fmt=d=>d.slice(8,10)+'/'+d.slice(5,7)+'/'+d.slice(0,4);
  assert.equal(args.departureDate,fmt(future(19)));assert.equal(args.departureDateTo,fmt(future(20)));
  assert.equal(args.returnDate,fmt(future(17)));assert.equal(args.returnDateTo,fmt(future(26)));
  assert.equal(args.one_for_city,false);
  for(const key of ['nights_in_dst_from','nights_in_dst_to','fly_days','dtime_from','dtime_to']) assert.ok(!(key in args));
  const dep=argumentsFor(validate(input({time_windows:{...windows(),inbound:{...windows().inbound,basis:'departure'}}}),true),j,true);
  assert.equal(dep.returnDate,fmt(future(23)));assert.equal(dep.returnDateTo,fmt(future(24)));
  const one=argumentsFor(validate(input({trip_type:'oneway'}),true),j,true);
  assert.equal(one.one_for_city,false);assert.ok(!('returnDate' in one));
});

test('source adapter filters time windows before choosing the cheapest offer per city',async()=>{
  const cheap=offer(500),valid=offer(1200);cheap.outbound.departureTime=future(19)+'T20:00:00';
  const state={offers:[cheap,valid]},transport=source(state),original=globalThis.fetch;
  globalThis.fetch=(url,options)=>transport(new Request(url,options));
  try {
    const results=await search(validate(input(),true),j,true);
    assert.equal(results.length,1);assert.equal(results[0].price,1200);
    assert.equal(state.args.one_for_city,false);
  } finally {globalThis.fetch=original;}
});
