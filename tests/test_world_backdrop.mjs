import test from 'node:test';
import assert from 'node:assert/strict';
import {buildingOffsets} from '../app/static/world-backdrop.js';

test('independent skyline planes follow scroll with bounded motion and a still option', () => {
  assert.deepEqual(buildingOffsets(0),[0,0,0].map(value=>-value));
  const middle=buildingOffsets(450),end=buildingOffsets(900);
  assert.ok(middle.every((offset,i)=>offset===end[i]/2));
  assert.equal(new Set(end).size,3);
  assert.deepEqual(buildingOffsets(90000),end);
  assert.deepEqual(buildingOffsets(-100),buildingOffsets(0));
  assert.deepEqual(buildingOffsets(NaN),buildingOffsets(0));
  assert.deepEqual(buildingOffsets(900,false),buildingOffsets(0));
  assert.equal(buildingOffsets(900,true,true).at(-1),end.at(-1)/2);
});
