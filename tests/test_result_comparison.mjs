import test from 'node:test';
import assert from 'node:assert/strict';
import {datePriceRail,resultPriceNote} from '../app/static/result-comparison.js';
import {flightDate} from '../app/static/format.js';
import {setPreferences} from '../app/static/preferences.js';
const offer=(to,date,price)=>({price,outbound:{to,departureTime:date+'T23:45:00-10:00'}});
test('date rail scopes minima to the selected destination and retains missing-date boundaries',()=>{
 const offers=[offer('HAN','2026-11-07',1000),offer('SIN','2026-11-07',500),offer('HAN','2026-11-08',2000)];
 const html=datePriceRail(offers,{destination:'HAN',currency:'CNY'});
 assert.match(html,/11-07 周六/);assert.match(html,/11-08 周日/);
 assert.match(html,/>1,000</);assert.doesNotMatch(html,/>500</);assert.doesNotMatch(html,/CNY|人民币|11-09|style=/);
 assert.match(html,/y="16" width="70" height="16"/);assert.match(html,/height="32"/);
 assert.equal((html.match(/is-lowest/g)||[]).length,1);
 const ties=datePriceRail([offer('HAN','2026-11-07',1000),offer('HAN','2026-11-08',1000)]);
 assert.equal((ties.match(/is-lowest/g)||[]).length,2);
 assert.doesNotMatch(datePriceRail([]),/最低起价|Infinity/);
});
test('weekday labels follow airport calendar dates across offsets and years in both languages',()=>{
 assert.equal(flightDate('2027-01-01T23:00:00-10:00'),'2027-01-01 周五');
 setPreferences({language:'en'});
 assert.equal(flightDate('2026-11-07',true),'11-07 Sat');
 setPreferences({language:'zh-CN'});
});
test('result header declares currency and total-price scope once, without promising equal stays',()=>{
 const text=resultPriceNote({config:{currency:'CNY',adults:2,trip_type:'oneway'}},'河内');
 assert.match(text,/人民币（CNY）/);assert.match(text,/2 人单程总价/);assert.match(text,/河内当日起价/);assert.match(text,/停留晚数与航班可能不同/);
});
