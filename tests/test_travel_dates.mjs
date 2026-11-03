import test from 'node:test';
import assert from 'node:assert/strict';
import {upcomingWeekends, applyWeekend, selectedWeekends} from '../app/static/travel-dates.js';

test('weekend choices include today on Saturday and skip a partial Sunday weekend', () => {
  assert.deepEqual(upcomingWeekends('2026-11-07', 1), [{start:'2026-11-07',end:'2026-11-08'}]);
  assert.equal(upcomingWeekends('2026-11-08')[0].start, '2026-11-14');
  assert.deepEqual(upcomingWeekends('2026-12-29'), [
    {start:'2027-01-02',end:'2027-01-03'}, {start:'2027-01-09',end:'2027-01-10'},
    {start:'2027-01-16',end:'2027-01-17'}, {start:'2027-01-23',end:'2027-01-24'}]);
});

test('weekend choices toggle independently and preserve gaps', () => {
  let changes=0;
  const weekdays=[{checked:true},{checked:false}];
  const form={elements:{date_mode:{value:'range'},date_pairs:{value:'[]'},start:{value:''},end:{value:''}},
    dispatchEvent:event=>{assert.equal(event.type,'change');changes++;},querySelectorAll:()=>weekdays};
  const weekends=upcomingWeekends('2026-11-03');
  applyWeekend(form,weekends[0]);applyWeekend(form,weekends[2]);
  assert.equal(form.elements.date_mode.value,'weekends');
  assert.deepEqual(selectedWeekends(form),[weekends[0],weekends[2]]);
  assert.equal(form.elements.start.value,'2026-11-07');
  assert.equal(form.elements.end.value,'2026-11-22');
  applyWeekend(form,weekends[0]);
  assert.deepEqual(selectedWeekends(form),[weekends[2]]);
  applyWeekend(form,weekends[2]);
  assert.deepEqual(selectedWeekends(form),[]);
  assert.ok(weekdays.every(box=>!box.checked));assert.equal(changes,4);
});
