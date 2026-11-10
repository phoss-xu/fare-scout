import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectedNights,nightsLabel} from '../app/static/nights.js';
test('checkbox stay selection preserves gaps and shows every selected night',()=>{
  const form={querySelectorAll:selector=>{assert.equal(selector,'[name=night]:checked');return [2,4,10].map(value=>({value:String(value)}));}};
  assert.deepEqual(selectedNights(form),[2,4,10]);
  assert.match(nightsLabel([2,4,10]),/2.*4.*10/);
  assert.equal(nightsLabel([]),'');
});
test('flexible date search defaults to a bounded 2–5 night stay',()=>{
  const html=readFileSync(new URL('../app/static/index.html',import.meta.url),'utf8');
  for(const night of [2,3,4,5]) assert.match(html,new RegExp(`name="night" value="${night}" checked`));
  for(const night of [1,6,7,8,9,10]) assert.match(html,new RegExp(`name="night" value="${night}"(?! checked)`));
});
