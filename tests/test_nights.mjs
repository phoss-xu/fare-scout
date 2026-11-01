import test from 'node:test';
import assert from 'node:assert/strict';
import {constrainNights} from '../app/static/nights.js';
test('range handles clamp to bounds and never cross',()=>{
 assert.deepEqual(constrainNights(2,5,'min_nights'),[2,5]);
 assert.deepEqual(constrainNights(9,5,'min_nights'),[5,5]);
 assert.deepEqual(constrainNights(8,2,'max_nights'),[8,8]);
 assert.deepEqual(constrainNights(-10,80,'max_nights'),[1,30]);
 assert.deepEqual(constrainNights(4.7,7.2,'min_nights'),[5,7]);
});
