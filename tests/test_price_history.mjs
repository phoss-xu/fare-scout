import test from 'node:test';
import assert from 'node:assert/strict';
import {priceInsight,lowestLabel,historyChart} from '../app/static/price-history-view.js';

test('price badges express levels in words, respect coverage and never call short evidence a 90-day low',()=>{
  const h={id:'a'.repeat(64),level:'low',sampled_days:8,coverage_days:12,difference_percent:-16,lowest:true,last_at:'2026-11-05T06:32:00Z'};
  const html=priceInsight({price:1680,currency:'HKD',price_history:h});
  assert.match(html,/data-price-level="low"/);assert.match(html,/偏低/);assert.match(html,/12 天采样最低/);assert.doesNotMatch(html,/近 90 天采样最低/);
  assert.match(priceInsight({price:2000,price_history:{...h,level:'high',lowest:false,difference_percent:20}}),/偏高/);
  assert.match(priceInsight({price:2000,price_history:{...h,level:'collecting',lowest:false}}),/历史积累中/);
  assert.equal(priceInsight({price:2000}), '');
  const compact=priceInsight({price:1680,currency:'HKD',price_history:h},{compact:true});
  assert.match(compact,/价格历史/);assert.match(compact,/data-price-current="1680"/);
  assert.match(compact,/data-price-currency="HKD"/);assert.match(compact,new RegExp(`data-price-history="${h.id}"`));
  assert.doesNotMatch(compact,/历史积累中|实际采样|最近查询/);
  assert.equal(lowestLabel({...h,full_window:true}), '近 90 天采样最低');
});
test('history chart leaves unsampled dates as gaps and includes accessible exact values',()=>{
  const html=historyChart([{day:'2026-11-01',price:1000},{day:'2026-11-02',price:900},{day:'2026-11-05',price:800}],'HKD');
  assert.equal((html.match(/<polyline/g)||[]).length,2);
  assert.equal((html.match(/<circle/g)||[]).length,3);
  assert.match(html,/2026-11-05 · 港币 800/);assert.match(html,/role="img"/);
  const single=historyChart([{day:'2026-11-05',price:800}],'HKD');
  assert.match(single,/只有 1 个采样日/);assert.doesNotMatch(single,/<svg/);
});
