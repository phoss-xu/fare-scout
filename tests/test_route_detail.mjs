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
 assert.match(oneWay,/单程总价/);assert.doesNotMatch(oneWay,/rd-leg-label">返|返程航段|选择返程|往返起/);
});
test('route follow-up requests keep selected airport dates, travellers and source currency',async()=>{
 const {comparisonRequest}=await import('../app/static/route-detail-search.js');
 const data=comparisonRequest(base,{adults:2,currency:'CNY',max_stops:1,max_duration_hours:8,budget:500});
 assert.equal(data.comparison,true);assert.equal(data.currency,'HKD');assert.equal(data.adults,2);assert.equal(data.budget,0);
 assert.deepEqual(data.origins,['airport:HKG']);assert.deepEqual(data.destinations,['airport:SIN']);
 assert.equal(data.end,base.inbound.departureTime.slice(0,10));assert.equal(data.max_stops,1);
 const one=comparisonRequest({...base,inbound:null},{});assert.equal(one.trip_type,'oneway');assert.equal(one.end,one.start);
});
test('independent date and local time filters support overnight windows',()=>{
 assert.deepEqual(routeOptions([base,late],{outDate:'2099-11-16',inDate:'2099-11-18',outFrom:'21:00',outTo:'06:00',inFrom:'02:00',inTo:'04:00'}),[late]);
 assert.deepEqual(routeOptions([late],{inDate:'2099-11-19'}),[]);
 assert.deepEqual(routeOptions([late],{outFrom:'08:00',outTo:'20:00'}),[]);
 assert.deepEqual(routeOptions([late],{inFrom:'04:00'}),[]);
});
test('custom search dates override the displayed itinerary without changing source offer',async()=>{
 const {comparisonRequest}=await import('../app/static/route-detail-search.js');
 const data=comparisonRequest(base,{}, {outDate:'2099-12-01',inDate:'2099-12-08'});
 assert.equal(data.start,'2099-12-01');assert.equal(data.end,'2099-12-08');
 const single=comparisonRequest({...base,inbound:null},{},{outDate:'2099-12-03',inDate:'2099-12-08'});
 assert.equal(single.start,single.end);
});

test('linked flight selection groups identical outbounds and only selects quoted return combinations',async()=>{
 const {legIdentity,outboundChoices,returnChoices,selectOutbound}=await import('../app/static/route-detail-model.js');
 const anotherReturn={...base,price:1500,inbound:{...base.inbound,departureTime:'2099-11-15T20:00:00'}};
 const anotherOut={...base,price:1800,outbound:{...base.outbound,departureTime:'2099-11-14T09:00:00'}};
 const differentFlight={...base,price:2000,outbound:{...base.outbound,segments:base.outbound.segments.map(s=>({...s,flightNumber:'QA999'}))}};
 const options=[base,anotherReturn,anotherOut,differentFlight];
 assert.equal(outboundChoices(options).length,3);
 assert.deepEqual(returnChoices(options,base),[base,anotherReturn]);
 assert.equal(selectOutbound(options,anotherOut,anotherReturn),anotherOut,'falls back to a real complete quote when that return is unavailable');
 assert.equal(selectOutbound(options,base,anotherReturn),anotherReturn,'preserves return when the source actually offers the combination');
 assert.notEqual(legIdentity(base.outbound),legIdentity(differentFlight.outbound));
});

test('return price differences use compatible complete quotes, and booking follows selected return',()=>{
 const alternate={...base,price:1500,bookingUrl:'https://example.test/alternate',inbound:{...base.inbound,departureTime:'2099-11-15T20:00:00'}};
 const unrelated={...base,price:100,outbound:{...base.outbound,departureTime:'2099-11-14T09:00:00'}};
 const html=routeDetailMarkup([base,alternate,unrelated],alternate,{adults:2},{outDate:'2099-11-14',inDate:'2099-11-15',sort:'price'});
 assert.match(html,/data-rd-outbound=/);assert.match(html,/选择返程/);
 assert.match(html,/aria-pressed="true"/);assert.match(html,/fare-symbol">\+HK\$<\/small><span class="fare-value">266/);
 assert.match(html,/href="https:\/\/example.test\/alternate"/);
 assert.match(html,/class="rd-itinerary" >/,'flight details start collapsed');
 assert.match(html,/1,500/);
});

test('each date rail ignores only its own date and time while retaining the other leg filters',async()=>{
 const {legDates}=await import('../app/static/route-detail-model.js');
 const tomorrow={...base,price:900,outbound:{...base.outbound,departureTime:'2099-11-16T09:00:00'}};
 const laterReturn={...base,price:1000,inbound:{...base.inbound,departureTime:'2099-11-19T20:00:00'}};
 assert.deepEqual(legDates([base,tomorrow,laterReturn],{outDate:'2099-11-14',inDate:'2099-11-15'}),[['2099-11-14',1234],['2099-11-16',900]]);
 assert.deepEqual(legDates([base,tomorrow,laterReturn],{outDate:'2099-11-14',inDate:'2099-11-15'},true),[['2099-11-15',1234],['2099-11-19',1000]]);
});
