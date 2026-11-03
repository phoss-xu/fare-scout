import test from 'node:test';
import assert from 'node:assert/strict';
import {boardingItinerary} from '../app/static/boarding-itinerary.js';
const outbound={from:'HKG',to:'SIN',departureTime:'2026-11-21T23:10:00',arrivalTime:'2026-11-22T03:00:00',durationSeconds:13800,stops:0,segments:[{fromCity:'香港',toCity:'新加坡',fromName:'香港国际机场',toName:'樟宜机场',carrierName:'Example Air',flightNumber:'EA100'}]};
const inbound={...outbound,from:'SIN',to:'HKG',departureTime:'2026-11-24T22:30:00',arrivalTime:'2026-11-25T02:30:00'};
test('return route anchors both airports equally and reverses return times with their local dates',()=>{
 const html=boardingItinerary({outbound,inbound});
 assert.match(html,/香港<\/strong>.*HKG.*新加坡<\/strong>.*SIN/);
 assert.match(html,/aria-label="返程 HKG ← SIN"/);
 assert.match(html,/boarding-return.*02:30.*2026-11-25.*HKG · 到达.*返程.*22:30.*2026-11-24.*SIN · 起飞/);
 assert.match(html,/机场当地时间/);assert.match(html,/Example Air EA100/);
});
test('one-way uses a single direction and escapes source place and airline text',()=>{
 const html=boardingItinerary({outbound:{...outbound,segments:[{fromCity:'<img>',carrierName:'<script>'}]}});
 assert.equal((html.match(/class="boarding-leg/g)||[]).length,1);
 assert.doesNotMatch(html,/boarding-return|返程/);
 assert.match(html,/&lt;img&gt;/);assert.match(html,/&lt;script&gt;/);
});
