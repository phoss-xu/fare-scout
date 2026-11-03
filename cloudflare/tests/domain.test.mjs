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
  assert.equal(domain.accepts(offer(),{...d,min_nights:4},j),false);
});
test('discovery fixed dates and sparse nights agree with Python validation',()=>{
  for(const extra of [{date_mode:'fixed',nights:[],weekdays:[0]}, {nights:[2,4,10,2]}, {min_nights:1,max_nights:10}]) {
    const value=config(extra),actual=domain.validate(value,true);
    const expected=JSON.parse(execFileSync('python3',['-c','import json,sys;from app.deals import validate;print(json.dumps(validate(json.loads(sys.argv[1])),ensure_ascii=False))',JSON.stringify(value)],{encoding:'utf8'}));
    assert.deepEqual(actual,expected);
  }
  for(const nights of [null,[],[0],[11],[2.5],['2'],[true]]) assert.throws(()=>domain.validate(config({nights}),true));
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
