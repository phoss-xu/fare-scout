import test from 'node:test';
import assert from 'node:assert/strict';
import {dailyCards} from '../app/static/daily.js';
import {watchDraft} from '../app/static/deal_views.js';
test('daily recommendation cards show arrival date, leave assumptions and reject unsafe provider content',()=>{
  const offer={price:900,destination_name:'<img src=x onerror=alert(1)>',bookingUrl:'javascript:alert(1)',
    outbound:{from:'HKG',to:'SIN',departureTime:'2027-01-02T01:40:00'},inbound:{departureTime:'2027-01-03T20:20:00',arrivalTime:'2027-01-04T00:10:00'},
    travel:{leave_days:0,full_days:2,leave_dates:[],calendar_reference:true,red_eye:true}};
  const html=dailyCards([offer],1);
  assert.ok(html.includes('2027-01-04 返抵'));assert.ok(html.includes('预计不用请假'));
  assert.ok(html.includes('假期及补班待公布'));assert.ok(html.includes('可玩 2 个白天'));
  assert.ok(html.includes('&lt;img'));assert.ok(!html.includes('href="javascript:'));
  assert.ok(html.includes('class="card deal-card"'));assert.ok(html.includes('data-trip-alert="'));
  const draft=watchDraft(offer,{adults:2,budget:2000,max_stops:1,max_duration_hours:8});
  assert.equal(draft.start,'2027-01-02');assert.equal(draft.end,'2027-01-03');assert.equal(draft.adults,2);
});
