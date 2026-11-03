import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {tripSnapshot,tripIdentity,watchForTrip} from '../app/static/trip-snapshot.js';
import {dealCards} from '../app/static/deal_views.js';
const fixture=()=>JSON.parse(readFileSync('tests/fixtures/trip-snapshot.json'));
test('public snapshots whitelist private fields and agree with Python including identity',()=>{
  const s=tripSnapshot(fixture());assert.equal(s.email,undefined);assert.equal(s.budget,undefined);assert.equal(s.fixture,undefined);
  const python=JSON.parse(execFileSync('python3',['-c','import json;from app.trip_snapshot import snapshot,identity;s=snapshot(json.load(open("tests/fixtures/trip-snapshot.json")));print(json.dumps(dict(snapshot=s,key=identity(s))))'],{encoding:'utf8'}));
  assert.deepEqual(python.snapshot,s);assert.equal(python.key,tripIdentity(s));
  for(const change of [{adults:0},{adults:true},{cabin:'J'},{currency:'XXX'},{offer:{...s.offer,price:NaN}},{offer:{...s.offer,bookingUrl:'javascript:alert(1)'}}]) assert.throws(()=>tripSnapshot({...s,...change}));
});
test('favorite identities distinguish passengers, flight times and single/return trips but ignore price and query time',()=>{
  const s=tripSnapshot(fixture()),key=tripIdentity(s);
  assert.equal(tripIdentity({...s,checked_at:null,offer:{...s.offer,price:900}}),key);
  assert.notEqual(tripIdentity({...s,adults:1}),key);
  assert.notEqual(tripIdentity({...s,offer:{...s.offer,inbound:null}}),key);
  assert.notEqual(tripIdentity({...s,offer:{...s.offer,outbound:{...s.offer.outbound,departureTime:'2099-11-14T08:00:00'}}}),key);
});
test('matching a price watch requires dates, passengers, trip type and the same filters',()=>{
  const s=tripSnapshot(fixture()),w={id:1,mode:'fixed',origin:'HKG',destinations:['SIN'],start:'2099-11-14',end:'2099-11-15',adults:2,max_stops:0,max_duration_hours:8};
  assert.equal(watchForTrip(s,[w]),w);
  for(const patch of [{adults:1},{max_stops:-1},{end:'2099-11-16'},{trip_type:'oneway'},{mode:'weekend'}])assert.equal(watchForTrip(s,[{...w,...patch}]),undefined);
});
test('return and one-way cards expose the same three actions; public pages omit private controls',()=>{
  const s=tripSnapshot(fixture());
  for(const o of [s.offer,{...s.offer,inbound:null}]) {
    const html=dealCards([o],[o],s.adults,false,s);
    for(const attr of ['data-trip-save','data-trip-share','data-trip-alert'])assert.ok(html.includes(attr));
    assert.ok(html.includes('报价查询于'));
    const publicHTML=dealCards([o],[o],s.adults,false,{...s,public:true,archived:true});
    assert.ok(!publicHTML.includes('data-trip-save'));assert.ok(publicHTML.includes('行程快照'));
  }
});

test('native currency survives snapshot validation, sharing identity and watch matching',()=>{
 const raw=fixture();raw.currency='CNY';const s=tripSnapshot(raw);
 assert.equal(s.currency,'CNY');assert.equal(s.offer.currency,'CNY');
 const python=JSON.parse(execFileSync('python3',['-c','import json,sys;from app.trip_snapshot import snapshot;print(json.dumps(snapshot(json.loads(sys.argv[1]))))',JSON.stringify(raw)],{encoding:'utf8'}));
 assert.deepEqual(s,python);assert.notEqual(tripIdentity(s),tripIdentity(tripSnapshot({...raw,currency:'HKD'})));
});
