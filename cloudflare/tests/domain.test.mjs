import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {build} from 'esbuild';
import {config,offer,future} from './fixtures.mjs';
const output=await build({entryPoints:['cloudflare/src/domain.js'],bundle:true,format:'esm',platform:'browser',write:false});
const domain=await import('data:text/javascript;base64,'+Buffer.from(output.outputFiles[0].text).toString('base64'));
test('Workers domain matches existing Python expansion for fixed, multi-origin, weekend and group selections',()=>{
  for(const value of [config(),config({origins:['city:HKG','airport:SZX'],destinations:['country:JP','airport:SIN']}),config({mode:'weekend',weeks:4}),config({destinations:['group:visa-free']})]) {
    const expected=JSON.parse(execFileSync('python3',['-c','import json,sys;from app.domain import validate,jobs;c=validate(json.loads(sys.argv[1]));print(json.dumps({"config":c,"jobs":jobs(c)},ensure_ascii=False))',JSON.stringify(value)],{encoding:'utf8'}));
    const c=domain.validate(value);assert.deepEqual(c,expected.config);assert.deepEqual(domain.jobs(c),expected.jobs);
  }
});
test('actual airport membership, local-date filtering, duration and weekday/night bounds',()=>{
  const c=domain.validate(config()),j=domain.jobs(c)[0];
  assert.equal(domain.matches(offer(),c,j),true);
  const wrong=offer();wrong.inbound.to='SZX';assert.equal(domain.matches(wrong,c,j),false);
  const nextDay=offer();nextDay.outbound.departureTime=future(21)+'T10:00:00';assert.equal(domain.matches(nextDay,c,j),false);
  const tooLong=offer();tooLong.outbound.durationSeconds=40000;assert.equal(domain.matches(tooLong,{...c,max_duration_hours:8},j),false);
  const d=domain.validate(config({min_nights:2,max_nights:5,weekdays:[domain.weekday(c.start)]}),true);
  assert.equal(domain.accepts(offer(),d,j),true);
  assert.equal(domain.accepts(offer(),{...d,weekdays:[(domain.weekday(c.start)+1)%7]},j),false);
  assert.equal(domain.accepts(offer(),{...d,nights:[4,5]},j),false);
});
test('discovery fixed dates and sparse nights agree with Python validation',()=>{
  for(const extra of [{date_mode:'fixed',nights:[],weekdays:[0]}, {nights:[]}, {nights:[2,4,10,2]}, {min_nights:1,max_nights:10}]) {
    const value=config(extra),actual=domain.validate(value,true);
    const expected=JSON.parse(execFileSync('python3',['-c','import json,sys;from app.deals import validate;print(json.dumps(validate(json.loads(sys.argv[1])),ensure_ascii=False))',JSON.stringify(value)],{encoding:'utf8'}));
    assert.deepEqual(actual,expected);
  }
  assert.deepEqual(domain.validate(config({nights:[]}),true).nights,[2,3,4,5]);
  for(const nights of [null,[0],[11],[2.5],['2'],[true]]) assert.throws(()=>domain.validate(config({nights}),true));
  const j={origin_id:'airport:HKG',location_id:'airport:SIN'};
  const fixed=domain.validate(config({date_mode:'fixed'}),true);
  assert.equal(domain.accepts(offer(),fixed,j),true);
  const wrong=offer();wrong.inbound.departureTime=future(24)+'T16:00:00';
  assert.equal(domain.accepts(wrong,fixed,j),false);
  assert.equal(domain.accepts(offer(),domain.validate(config({nights:[2,4]}),true),j),false);
  assert.equal(domain.accepts(offer(),domain.validate(config({nights:[2,3,5]}),true),j),true);
});
test('provider sends fixed return dates or night bounds without filling sparse gaps',async()=>{
  const built=await build({entryPoints:['cloudflare/src/provider.js'],bundle:true,format:'esm',platform:'browser',write:false});
  const provider=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
  const j={origin_id:'airport:HKG',location_id:'airport:SIN'};
  const fixed=provider.argumentsFor(domain.validate(config({date_mode:'fixed',weekdays:[0]}),true),j,true);
  assert.ok(fixed.returnDate);
  for(const key of ['departureDateTo','nights_in_dst_from','nights_in_dst_to','fly_days']) assert.equal(key in fixed,false);
  const sparse=provider.argumentsFor(domain.validate(config({nights:[2,4,10]}),true),j,true);
  assert.equal(sparse.nights_in_dst_from,2);assert.equal(sparse.nights_in_dst_to,10);
  assert.equal(sparse.one_for_city,false);
});

test('weekend pair validation agrees across runtimes and rejects empty or mismatched dates',()=>{
  const start=domain.plusDays(future(20),(5-domain.weekday(future(20))+7)%7);
  const pairs=[{start,end:domain.plusDays(start,1)},{start:domain.plusDays(start,14),end:domain.plusDays(start,15)}];
  const value=config({date_mode:'fixed',start:pairs[0].start,end:pairs[1].end,date_pairs:pairs});
  const actual=domain.validate(value,true);
  const expected=JSON.parse(execFileSync('python3',['-c','import json,sys;from app.deals import validate;print(json.dumps(validate(json.loads(sys.argv[1])),ensure_ascii=False))',JSON.stringify(value)],{encoding:'utf8'}));
  assert.deepEqual(actual,expected);
  const wrongWindow=offer();wrongWindow.outbound.departureTime=pairs[1].start+'T10:00:00';wrongWindow.outbound.arrivalTime=pairs[1].start+'T14:00:00';wrongWindow.inbound.departureTime=pairs[1].end+'T16:00:00';wrongWindow.inbound.arrivalTime=pairs[1].end+'T20:00:00';
  assert.equal(domain.accepts(wrongWindow,actual,{origin_id:'airport:HKG',location_id:'airport:SIN',window:pairs[0]}),false);
  for(const date_pairs of [[],null,[{}],pairs.concat(pairs,pairs),[{start,end:pairs[1].end}]]) assert.throws(()=>domain.validate({...value,date_pairs},true));
  assert.throws(()=>domain.validate({...value,date_mode:'range'},true));
});

test('one-way fixed and flexible discovery agree across runtimes and omit return arguments',async()=>{
  const built=await build({entryPoints:['cloudflare/src/provider.js'],bundle:true,format:'esm',platform:'browser',write:false});
  const provider=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
  const j={origin_id:'airport:HKG',location_id:'airport:SIN'};
  for(const date_mode of ['fixed','range']) {
    const value=config({trip_type:'oneway',date_mode,nights:[],weekdays:[domain.weekday(future(20))]});
    const c=domain.validate(value,true);
    const expected=JSON.parse(execFileSync('python3',['-c','import json,sys;from app.deals import validate;print(json.dumps(validate(json.loads(sys.argv[1])),ensure_ascii=False))',JSON.stringify(value)],{encoding:'utf8'}));
    assert.deepEqual(c,expected);
    assert.deepEqual(c.nights,[]);
    const args=provider.argumentsFor(c,j,true);
    for(const key of ['returnDate','returnDateTo','nights_in_dst_from','nights_in_dst_to']) assert.equal(key in args,false);
    assert.equal('departureDateTo' in args,date_mode==='range');
    const flight=offer();delete flight.inbound;
    assert.equal(domain.accepts(flight,c,j),true);
    assert.equal(domain.accepts(offer(),c,j),false);
    if(date_mode==='range') assert.equal(domain.accepts(flight,{...c,weekdays:[(domain.weekday(c.start)+1)%7]},j),false);
    for(const bad of [{price:0},{price:1501},{outbound:{...flight.outbound,to:'BKK'}},{outbound:{...flight.outbound,stops:1}},{outbound:{...flight.outbound,durationSeconds:Infinity}}]) {
      assert.equal(domain.accepts({...flight,...bad},{...c,max_stops:0},j),false);
    }
  }
  assert.throws(()=>domain.validate(config({trip_type:'unknown'}),true));
  assert.equal(domain.validate(config({trip_type:'oneway'})).trip_type,'oneway');
});

test('one-way watch jobs, membership and price identity agree across runtimes without return-date arguments',async()=>{
  const value=config({trip_type:'oneway',max_stops:0}),c=domain.validate(value),j=domain.jobs(c)[0],o=offer();delete o.inbound;
  const expected=JSON.parse(execFileSync('python3',['-c','import json,sys;from app.domain import validate,jobs,matches;from app.journeys import identity;c=validate(json.loads(sys.argv[1]));o=json.loads(sys.argv[2]);j=jobs(c)[0];print(json.dumps(dict(config=c,jobs=jobs(c),matches=matches(o,c,j),key=identity(c,j,o)),ensure_ascii=False))',JSON.stringify(value),JSON.stringify(o)],{encoding:'utf8'}));
  assert.deepEqual(c,expected.config);assert.deepEqual(domain.jobs(c),expected.jobs);assert.equal(c.start,c.end);
  assert.equal(domain.matches(o,c,j),true);assert.equal(expected.matches,true);assert.equal(domain.routeKey(c,j,o),expected.key);
  assert.equal(domain.matches(offer(),c,j),false);assert.equal(domain.matches({...o,outbound:{...o.outbound,to:'BKK'}},c,j),false);
  const built=await build({entryPoints:['cloudflare/src/provider.js'],bundle:true,format:'esm',platform:'browser',write:false});
  const provider=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
  assert.ok(!('returnDate' in provider.argumentsFor(c,j,false)));
});
test('selected quote currencies are validated, passed to source and preserved in both runtimes',async()=>{
 const built=await build({entryPoints:['cloudflare/src/provider.js'],bundle:true,format:'esm',platform:'browser',write:false});
 const provider=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
 for(const currency of ['CNY','USD','JPY']) {
  const input=config({currency,budget:600,date_mode:'fixed'}),c=domain.validate(input,true);
  const python=JSON.parse(execFileSync('python3',['-c','import json,sys;from app.deals import validate;print(json.dumps(validate(json.loads(sys.argv[1]))))',JSON.stringify(input)],{encoding:'utf8'}));
  assert.deepEqual(c,python);
  const args=provider.argumentsFor(c,{origin_id:'airport:HKG',location_id:'airport:SIN'},true);
  assert.equal(args.currency,currency);assert.equal(args.price_to,600);
  assert.equal(domain.validate(input).currency,currency);
 }
 assert.throws(()=>domain.validate(config({currency:'XXX'}),true));
});
