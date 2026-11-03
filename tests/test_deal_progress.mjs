import test from 'node:test';
import assert from 'node:assert/strict';
import {searchStatus} from '../app/static/deal-progress.js';
test('partial results remain labelled as running and failures remain visible',()=>{
  const text=searchStatus({status:'running',completed:2,total:6,offers:[{}],failures:1});
  assert.match(text,/2\/6/);assert.match(text,/查询中|Checking/);assert.match(text,/已返回 1|1 quotes/);assert.match(text,/1 组查询失败|1 failed/);
  assert.match(searchStatus({status:'running',completed:0,total:6,offers:[],failures:0}),/0\/6/);
});
