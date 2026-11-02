import test from 'node:test';
import assert from 'node:assert/strict';
import {sortedOffers, sampledDays, dealCards} from '../app/static/deal_views.js';
const offer=(day,price,duration=3600)=>({price,bookingUrl:'https://example.com/book',outbound:{from:'HKG',to:'SIN',departureTime:`2026-11-${day}T10:00:00`,arrivalTime:`2026-11-${day}T14:00:00`,durationSeconds:duration,stops:0,segments:[{toCity:'<script>x</script>'}]},inbound:{from:'SIN',to:'HKG',departureTime:'2026-11-29T10:00:00',arrivalTime:'2026-11-29T14:00:00',durationSeconds:duration,stops:0}});
test('sort and sampled dates only use returned prices without inventing missing dates',()=>{
 const offers=[offer('25',1500,7200),offer('23',1900),offer('25',1200)];
 assert.equal(sortedOffers(offers)[0].price,1200);
 assert.equal(sortedOffers(offers,'date')[0].price,1900);
 assert.equal(sortedOffers(offers,'price','2026-11-23').length,1);
 assert.deepEqual(sampledDays(offers),[['2026-11-23',1900],['2026-11-25',1200]]);
 assert.equal(offers[0].price,1500);
});
test('flight cards escape source data and reject unsafe booking links',()=>{
 const offers=[offer('25',1200)];offers[0].bookingUrl='javascript:alert(1)';
 const html=dealCards(offers,offers,2);
 assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('href="javascript:'));
 assert.ok(html.includes('/ 2 人往返'));assert.ok(html.includes('data-deal-watch="0"'));
});
test('destination navigation uses each returned destination minimum within the selected date',async()=>{
 const {destinationChoices}=await import('../app/static/deal_views.js');
 const a=offer('25',1200),b=offer('23',900),c=offer('25',1500);
 c.outbound.to='BKK';c.destination_name='曼谷';
 assert.deepEqual(destinationChoices([a,b,c]).map(c=>[c.key,c.price]),[['SIN',900],['BKK',1500]]);
 assert.deepEqual(destinationChoices([a,b,c],'2026-11-25').map(c=>[c.key,c.price]),[['SIN',1200],['BKK',1500]]);
 assert.deepEqual(destinationChoices([a,b,c],'2026-11-26'),[]);
});
test('trip nights follow destination local dates and missing arrivals never invent a stay',()=>{
 const o=offer('25',1200);
 o.outbound.arrivalTime='2026-11-26T00:30:00+07:00';
 o.inbound.departureTime='2026-11-28T23:00:00+07:00';
 assert.ok(dealCards([o],[o],1).includes('<strong>2 晚</strong>'));
 assert.ok(!dealCards([o],[o],1).includes('不用请假'));
 delete o.outbound.arrivalTime;
 assert.ok(!dealCards([o],[o],1).includes('目的地停留'));
});
