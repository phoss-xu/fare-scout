import {test} from 'node:test';
import assert from 'node:assert/strict';
import {historyView} from '../app/static/views.js';
test('paged history displays full coverage and server minimum instead of the visible-page minimum',()=>{
  const row={id:1005,watch_id:1,destination:'SIN',departure:'2027-01-01',arrival:'2027-01-04',checked_at:'2026-11-03T00:00:00Z',status:'ok',route_key:'same',offer:{price:1200},monitored_min:800};
  const html=historyView({observations:[],destinations:{}},1,{observations:[row],summary:{total:1005,first_at:'2026-10-01T00:00:00Z',sampled_days:34},next_before:906,destinations:{SIN:'新加坡 <test>'}});
  assert.match(html,/1005/);assert.match(html,/34/);assert.match(html,/800/);assert.match(html,/data-history-more/);assert.match(html,/&lt;test&gt;/);
});
test('Python local state remains compatible and exhausted pages omit the load-more control',()=>{
  const row={watch_id:1,destination:'SIN',departure:'2027-01-01',arrival:'2027-01-04',checked_at:'2026-11-03T00:00:00Z',status:'error'};
  assert.match(historyView({observations:[row],destinations:{SIN:'新加坡'}},1),/数据源查询失败/);
  assert.doesNotMatch(historyView({observations:[],destinations:{}},1,{observations:[row],summary:{total:1,sampled_days:1},next_before:null}),/data-history-more/);
});
