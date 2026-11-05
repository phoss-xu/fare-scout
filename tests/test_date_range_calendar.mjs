import test from 'node:test';
import assert from 'node:assert/strict';
import {monthOffset,monthDays,chooseDate,calendarMonth} from '../app/static/date-range-calendar.js';
test('calendar months cross years and align leap days to Monday-first weeks',()=>{
 assert.equal(monthOffset('2026-12',1),'2027-01');
 assert.equal(monthOffset('2026-01',-1),'2025-12');
 assert.equal(monthDays('2028-02').days.at(-1),'2028-02-29');
 assert.equal(monthDays('2026-11').offset,6);
});
test('date selection keeps an ordered range and single departures need one click',()=>{
 const first=chooseDate('2026-11-05','2026-12-05','2026-11-13','start');
 assert.deepEqual(first,{start:'2026-11-13',end:'2026-11-13',edge:'end'});
 assert.deepEqual(chooseDate(first.start,first.end,'2026-12-02',first.edge),{start:'2026-11-13',end:'2026-12-02',edge:'start'});
 assert.deepEqual(chooseDate(first.start,first.end,'2026-11-10','end'),{start:'2026-11-10',end:'2026-11-10',edge:'end'});
 assert.deepEqual(chooseDate(first.start,first.end,'2026-12-02','start',true),{start:'2026-12-02',end:'2026-12-02',edge:'start'});
 const html=calendarMonth('2026-11','2026-11-13','2026-12-02','2026-11-05');
 assert.match(html,/range-between/);assert.match(html,/aria-current="date"/);
 assert.match(html,/data-calendar-day="2026-11-04"[^>]* disabled/);
});

test('shared calendars enforce supplied date bounds and preserve form pairing',async()=>{
 const {datePairFields}=await import('../app/static/date-input-picker.js');
 const html=calendarMonth('2026-11','2026-11-13','2026-11-14','2026-11-05',{min:'2026-11-13',max:'2026-11-15'});
 assert.match(html,/data-calendar-day="2026-11-12"[^>]* disabled/);
 assert.match(html,/data-calendar-day="2026-11-16"[^>]* disabled/);
 assert.doesNotMatch(html,/data-calendar-day="2026-11-14"[^>]* disabled/);
 const start={name:'outbound_start_date',closest:()=>null},end={name:'outbound_end_date',closest:()=>null};
 start.form=end.form={elements:{outbound_start_date:start,outbound_end_date:end}};
 assert.deepEqual(datePairFields(start),[start,end]);
 end.disabled=true;assert.deepEqual(datePairFields(start),[start]);
 const single={name:'',form:null};assert.deepEqual(datePairFields(single),[single]);
});
