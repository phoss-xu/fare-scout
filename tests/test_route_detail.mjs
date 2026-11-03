import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {routeOffers,routeDates,routeOptions,datePair} from '../app/static/route-detail-model.js';
import {routeDetailMarkup} from '../app/static/route-detail-views.js';
const snapshot=JSON.parse(readFileSync(new URL('./fixtures/trip-snapshot.json',import.meta.url)));
const base={...snapshot.offer,currency:'HKD'};
const late={...base,price:900,outbound:{...base.outbound,departureTime:'2099-11-16T22:00:00',stops:1,durationSeconds:24000},inbound:{...base.inbound,departureTime:'2099-11-18T03:00:00'}};
test('comparison keeps complete quotes grouped by actual airports, trip type and source currency',()=>{
 const others=[{...base,currency:'USD'},{...base,inbound:null},{...base,outbound:{...base.outbound,from:'SZX'}},{...base,inbound:{...base.inbound,to:'SZX'}}];
 assert.deepEqual(routeOffers(base,[base,late,...others]),[base,late]);
 assert.deepEqual(routeDates([late,base,{...base,price:1100}]),[[datePair(base),1100],[datePair(late),900]]);
 assert.deepEqual(routeOptions([base,late]),[late,base]);
 assert.deepEqual(routeOptions([late,base],{onlyDirect:true}),[base]);
 assert.deepEqual(routeOptions([base,late],{date:datePair(late),onlyDirect:true}),[]);
 assert.deepEqual(routeOptions([late,base],{sort:'departure'}),[base,late]);
 assert.deepEqual(routeOptions([late,base],{sort:'duration'}),[base,late]);
 assert.deepEqual(routeDates([{...base,inbound:null}]),[['2099-11-14',1234]]);
});
test('detail uses the selected complete quote and rejects unsafe source content and booking schemes',()=>{
 const unsafe={...base,bookingUrl:'javascript:alert(1)',outbound:{...base.outbound,segments:[{fromCity:'<script>',carrierName:'<img>'}]}};
 const html=routeDetailMarkup([unsafe],unsafe,{adults:2,checked_at:snapshot.checked_at},{date:'',sort:'price',onlyDirect:false});
 assert.match(html,/2 位成人/);assert.match(html,/1,234/);assert.match(html,/&lt;script&gt;/);assert.match(html,/&lt;img&gt;/);
 assert.doesNotMatch(html,/javascript:|href="javascript|<script>|<img>/);
 const empty=routeDetailMarkup([late],late,{adults:2},{date:'',sort:'price',onlyDirect:true});
 assert.match(empty,/class="rd-footer" hidden/);assert.match(empty,/class="rd-selected" hidden/);
 assert.match(html,/不代表该航线全部航班/);assert.match(html,/返程日期为目的地起飞日/);
 const single={...base,inbound:null};
 const oneWay=routeDetailMarkup([single],single,{adults:1},{date:'',sort:'price',onlyDirect:false});
 assert.match(oneWay,/单程总价/);assert.doesNotMatch(oneWay,/rd-leg-label">返|返程航段/);
});
test('route follow-up requests keep selected airport dates, travellers and source currency',async()=>{
 const {comparisonRequest}=await import('../app/static/route-detail-search.js');
 const data=comparisonRequest(base,{adults:2,currency:'CNY',max_stops:1,max_duration_hours:8,budget:500});
 assert.equal(data.comparison,true);assert.equal(data.currency,'HKD');assert.equal(data.adults,2);assert.equal(data.budget,0);
 assert.deepEqual(data.origins,['airport:HKG']);assert.deepEqual(data.destinations,['airport:SIN']);
 assert.equal(data.end,base.inbound.departureTime.slice(0,10));assert.equal(data.max_stops,1);
 const one=comparisonRequest({...base,inbound:null},{});assert.equal(one.trip_type,'oneway');assert.equal(one.end,one.start);
});
