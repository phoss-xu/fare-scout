import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chinaToday, holidayRange, yearFor, applyHoliday} from '../app/static/holidays.js';
const calendar=JSON.parse(fs.readFileSync(new URL('../app/static/holidays.json',import.meta.url),'utf8'));
test('published calendar includes all seven holidays and actual make-up workdays',()=>{
 const year=calendar.years.find(r=>r.year===2026);
 assert.equal(year.status,'official');assert.equal(year.holidays.length,7);
 const national=year.holidays.find(r=>r.id==='national');
 assert.deepEqual([national.start,national.end],['2026-10-01','2026-10-07']);
 assert.deepEqual(national.workdays,['2026-09-20','2026-10-10']);
});
test('new year reference is explicitly distinguished and past holidays never select next year silently',()=>{
 assert.equal(yearFor(calendar,'2026-11-01'),2027);
 assert.equal(calendar.years.find(r=>r.year===2027).status,'reference');
 const national=calendar.years[0].holidays.at(-1);
 assert.equal(holidayRange(national,'2026-11-01'),null);
 assert.deepEqual(holidayRange(national,'2026-10-04'),{start:'2026-10-04',end:'2026-10-07'});
});
test('date boundary follows China mainland timezone',()=>{
 assert.equal(chinaToday(new Date('2026-12-31T16:01:00Z')),'2027-01-01');
});
test('shortcut fills only travel dates and changes weekend monitoring to fixed dates',()=>{
 const calls=[];const field=(value)=>({value,dispatchEvent:event=>calls.push(event.type)});
 const form={elements:{mode:field('weekend'),start:field(''),end:field(''),budget:field(2000)}};
 const national=calendar.years[1].holidays.at(-1);
 applyHoliday(form,national,'2026-11-01','watch');
 assert.equal(form.elements.mode.value,'fixed');assert.equal(form.elements.start.value,'2027-10-01');
 assert.equal(form.elements.end.value,'2027-10-07');assert.equal(form.elements.budget.value,2000);
 form.elements.mode.value='weekend';applyHoliday(form,national,'2026-11-01','deals');
 assert.equal(form.elements.mode.value,'weekend');
 assert.throws(()=>applyHoliday(form,calendar.years[0].holidays.at(-1),'2026-11-01','watch'));
});
