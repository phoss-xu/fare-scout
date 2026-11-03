import test from 'node:test';
import assert from 'node:assert/strict';
import {selectedNights,nightsLabel} from '../app/static/nights.js';
test('checkbox stay selection preserves gaps and shows every selected night',()=>{
  const form={querySelectorAll:selector=>{assert.equal(selector,'[name=night]:checked');return [2,4,10].map(value=>({value:String(value)}));}};
  assert.deepEqual(selectedNights(form),[2,4,10]);
  assert.match(nightsLabel([2,4,10]),/2.*4.*10/);
  assert.match(nightsLabel([]),/请选择|Choose/);
});
