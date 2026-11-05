import test from 'node:test';
import assert from 'node:assert/strict';
import {nearbyPairs,routeDetailPrefetch} from '../app/static/route-detail-prefetch.js';
import {dateStrip,queryPair} from '../app/static/route-date-strip.js';
const offer={currency:'HKD',outbound:{from:'HKG',to:'SIN',departureTime:'2099-11-14T10:00:00'},inbound:{from:'SIN',to:'HKG',departureTime:'2099-11-20T16:00:00'}};
function harness() {
  const lanes=[],calls=[],results=[],updates=[];let clock=0;
  const loader=routeDetailPrefetch({now:()=>clock,result:(data,filters)=>results.push({data,filters}),progress:p=>updates.push(p),createSearch(callbacks){
    const lane={callbacks,filters:null,start(o,c,filters){this.filters=filters;calls.push({filters,context:c});callbacks.status(true,'loading');},cancel(){this.filters=null;}};
    lanes.push(lane);return lane;
  }});
  function finish(lane=lanes.find(l=>l.filters),error=false) {
    assert.ok(lane);lane.filters=null;
    if(error)lane.callbacks.status(false,'source failed');else lane.callbacks.done({offers:[],checked_at:'2099-01-01T00:00:00Z'});
  }
  return {loader,lanes,calls,results,updates,finish,advance:()=>clock+=300001};
}
test('five days cover all valid combinations, prioritizing the selected pair and visible rails',()=>{
  const pairs=nearbyPairs(offer,'2099-11-01');assert.equal(pairs.length,25);
  assert.deepEqual(pairs[0],{outDate:'2099-11-14',inDate:'2099-11-20'});
  assert.ok(pairs.slice(0,9).every(p=>p.outDate==='2099-11-14' || p.inDate==='2099-11-20'));
  const short={...offer,inbound:{...offer.inbound,departureTime:'2099-11-15T08:00:00'}};
  assert.ok(nearbyPairs(short,'2099-11-14').every(p=>p.outDate>='2099-11-14' && p.inDate>=p.outDate));
  assert.equal(nearbyPairs({...offer,inbound:null},'2099-11-01').length,5);
  assert.deepEqual(nearbyPairs(offer,'2100-01-01'),[]);
});
test('automatic loading stays bounded, emits progress, deduplicates selected days and reuses fresh complete results',()=>{
  const h=harness();h.loader.start(offer,{adults:2},'2099-11-01');assert.equal(h.calls.length,1);
  const pair={outDate:'2099-11-16',inDate:'2099-11-22'};
  h.loader.ensure(pair);h.loader.ensure(pair);h.finish();assert.deepEqual(h.calls[1].filters,pair);
  while(h.lanes.some(l=>l.filters))h.finish();
  assert.equal(h.calls.length,25);assert.equal(new Set(h.calls.map(c=>queryPair(c.filters))).size,25);
  assert.equal(h.results.length,25);assert.equal(h.updates.at(-1).completed,25);assert.deepEqual(h.updates.at(-1).pendingPairs,{});
  h.loader.start(offer,{adults:2},'2099-11-01');assert.equal(h.calls.length,25);assert.equal(h.results.length,50);
  h.advance();h.loader.start(offer,{adults:2},'2099-11-01');assert.equal(h.calls.length,26);
  h.loader.cancel();assert.ok(h.lanes.every(l=>!l.filters));
  h.loader.clear();h.loader.start(offer,{adults:2},'2099-11-01');assert.equal(h.calls.length,27);h.loader.cancel();
});
test('failures remain distinct from empty results, retry explicitly and never share cache across passenger counts',()=>{
  const h=harness();h.loader.start({...offer,inbound:null},{adults:1},'2099-11-01');
  const filters=h.calls[0].filters;h.finish(h.lanes[0],true);
  assert.equal(h.updates.at(-1).failed,1);assert.equal(h.results.length,0);
  assert.equal(h.updates.at(-1).failedPairs[queryPair(filters)],true);
  h.loader.ensure(filters);while(h.lanes.some(l=>l.filters))h.finish();
  assert.equal(h.updates.at(-1).failed,0);assert.equal(h.calls.length,6);
  h.loader.start({...offer,inbound:null},{adults:2},'2099-11-01');assert.equal(h.calls.length,7);
  h.loader.cancel();const count=h.results.length;h.lanes[0].callbacks.done({offers:[]});assert.equal(h.results.length,count);
});
test('pending date cells can be selected and source failures never appear as no match',()=>{
  const pair='2099-11-13/2099-11-20';
  const state={outDate:'2099-11-14',inDate:'2099-11-20',today:'2099-11-01',pendingPairs:{[pair]:true}};
  const pending=dateStrip([],offer,state,false,'HKD');
  assert.match(pending,/data-rd-day="2099-11-13"[^>]*><span>[^<]+<\/span><strong>查价中/);
  const failed=dateStrip([],offer,{...state,pendingPairs:{},failedPairs:{[pair]:true}},false,'HKD');
  assert.match(failed,/>重试<\/strong>/);assert.doesNotMatch(failed,/无匹配/);
});

test('account-busy conflicts wait and retry, and closing clears the scheduled retry',()=>{
  let callbacks,retry,cleared=false,starts=0;const updates=[];
  const loader=routeDetailPrefetch({result(){},progress:p=>updates.push(p),setTimer:fn=>(retry=fn,1),clearTimer:id=>{if(id===1)cleared=true;},createSearch:c=>(callbacks=c,{start(){starts++;},cancel(){}})});
  loader.start({...offer,inbound:null},{},'2099-11-01');
  callbacks.status(false,'busy',{status:409});assert.equal(starts,1);assert.equal(updates.at(-1).failed,0);
  retry();assert.equal(starts,2);callbacks.status(false,'busy',{status:409});
  loader.cancel();assert.equal(cleared,true);
});
