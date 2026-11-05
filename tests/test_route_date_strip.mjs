import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dateWindow,shiftDay,dateStrip,queryPair} from '../app/static/route-date-strip.js';
const base=JSON.parse(readFileSync(new URL('./fixtures/trip-snapshot.json',import.meta.url))).offer;
test('adjacent dates stay continuous through months, leap days and years',()=>{
 assert.deepEqual(dateWindow('2028-03-01'),['2028-02-27','2028-02-28','2028-02-29','2028-03-01','2028-03-02','2028-03-03','2028-03-04']);
 assert.equal(shiftDay('2026-12-31',1),'2027-01-01');
 assert.equal(shiftDay('2027-01-01',-7),'2026-12-25');
 assert.equal(shiftDay('invalid',1),'');
});
test('nearby days distinguish observed prices, unqueried days and a completed empty query',()=>{
 const state={outDate:'2099-11-14',inDate:'2099-11-15',today:'2099-11-12',checkedPairs:{'2099-11-13/2099-11-15':0}};
 const html=dateStrip([base],base,state,false,'HKD');
 assert.equal((html.match(/data-rd-day="2099/g)||[]).length,7);
 assert.match(html,/data-rd-day="2099-11-14"[^>]+aria-pressed="true"/);
 assert.match(html,/港币 1,234/);assert.match(html,/无匹配/);assert.match(html,/>查价<\/strong>/);
 assert.match(html,/data-rd-day="2099-11-11"[^>]+disabled/);
 assert.match(html,/data-rd-day="2099-11-17"[^>]+disabled/);
 assert.equal(queryPair(state),'2099-11-14/2099-11-15');
 const returning=dateStrip([base],base,state,true,'HKD');
 assert.match(returning,/data-rd-day="2099-11-13"[^>]+disabled/);
 assert.match(returning,/保持去程日期/);
});
test('switching outbound and return dates keeps each comparison on the other selected date',()=>{
 const differentReturn={...base,price:1,inbound:{...base.inbound,departureTime:'2099-11-19T08:00:00'}};
 const state={outDate:'2099-11-14',inDate:'2099-11-15',today:'2099-01-01'};
 assert.doesNotMatch(dateStrip([base,differentReturn],base,state,false,'HKD'),/>港币 1<\/strong>/);
 const one={...base,inbound:null};
 assert.match(dateStrip([one],one,{outDate:'2099-11-14',today:'2099-01-01'},false,'HKD'),/单程起/);
});

test('route date lookup returns the requested pair and discards an older lookup after switching dates',async()=>{
 const originalFetch=globalThis.fetch,originalDocument=globalThis.document;
 globalThis.document={hidden:false,addEventListener(){},removeEventListener(){}};
 let releaseOld;
 const calls=[];
 globalThis.fetch=async(path,options)=>{
   calls.push({path,body:options?.body?JSON.parse(options.body):null});
   if(options?.method==='POST' && calls.length===1)return new Promise(resolve=>releaseOld=()=>resolve({ok:true,json:async()=>({id:'old'})}));
   return {ok:true,json:async()=>options?.method==='POST'?{id:'new'}:{status:'done',offers:[],failures:0}};
 };
 const {routeDetailSearch}=await import('../app/static/route-detail-search.js');
 let returned;
 const search=routeDetailSearch({status(){},done(result,filters){returned={result,filters};}});
 try {
   const first=search.start(base,{adults:2},{outDate:'2099-11-13',inDate:'2099-11-15'});
   await search.start(base,{adults:2},{outDate:'2099-11-14',inDate:'2099-11-16'});
   await new Promise(setImmediate);
   releaseOld();await first;await new Promise(setImmediate);
   assert.equal(returned.filters.inDate,'2099-11-16');
   assert.deepEqual(calls.map(c=>c.path),['/api/deals','/api/deals','/api/deals/new']);
   assert.equal(calls[1].body.end,'2099-11-16');
   assert.equal(calls[1].body.adults,2);
 } finally {search.cancel();globalThis.fetch=originalFetch;globalThis.document=originalDocument;}
});
