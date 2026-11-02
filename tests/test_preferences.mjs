import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizePreferences,getPreferences,setPreferences,PREFERENCES_KEY} from '../app/static/preferences.js';
import {validateRates,loadRates} from '../app/static/exchange-rates.js';
import {displayAmount,ensureRates} from '../app/static/currency.js';
import {price} from '../app/static/format.js';
import {dealCards} from '../app/static/deal_views.js';

const now=Date.parse('2026-11-02T08:00:00Z');
const rows=[{base:'HKD',quote:'USD',rate:0.125,date:'2026-11-02'},{base:'HKD',quote:'JPY',rate:20,date:'2026-11-02'}];
const memory=()=>{const values=new Map();return {getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};};
test('invalid stored settings fall back independently; failed storage still applies language',()=>{
  assert.deepEqual(normalizePreferences({language:'<script>',currency:'XXX'}),{language:'zh-CN',currency:'CNY'});
  assert.deepEqual(normalizePreferences({language:'en',currency:'XXX'}),{language:'en',currency:'CNY'});
  assert.equal(normalizePreferences(null).currency,'CNY');
  assert.equal(normalizePreferences({currency:'HKD'}).currency,'HKD');
  globalThis.localStorage=memory();
  assert.equal(getPreferences().currency,'CNY');
  setPreferences({language:'en',currency:'USD'});
  assert.equal(JSON.parse(localStorage.getItem(PREFERENCES_KEY)).currency,'USD');
  const write=localStorage.setItem;localStorage.setItem=()=>{throw new Error('disabled');};
  assert.equal(setPreferences({language:'zh-CN'}),false);
  assert.equal(getPreferences().language,'zh-CN');localStorage.setItem=write;
});
test('exchange adapter uses fresh cache and rejects stale, non-HKD and invalid rates',async()=>{
  assert.equal(validateRates({fetchedAt:now-86400001,rows},now),null);
  assert.equal(validateRates({fetchedAt:now+1,rows},now),null);
  for(const patch of [{rate:0},{rate:Infinity},{rate:'0.125'},{base:'USD'},{date:'2020-01-01'},{quote:'<img>'}]) {
    assert.equal(validateRates({fetchedAt:now,rows:[{...rows[0],...patch}]},now),null);
  }
  const storage=memory();let calls=0;
  const fetcher=async(url,options)=>{calls++;assert.match(url,/base=HKD/);assert.equal(options.credentials,'omit');return {ok:true,json:async()=>rows};};
  assert.equal((await loadRates({storage,fetcher,now})).USD.rate,0.125);
  await loadRates({storage,fetcher,now:now+100});assert.equal(calls,1);
  await assert.rejects(loadRates({storage:memory(),fetcher:async()=>({ok:false,status:503}),now}),/503/);
  await assert.rejects(loadRates({storage:memory(),fetcher:async()=>({ok:true,json:async()=>[]}),now}),/Invalid/);
});
test('display conversion preserves source prices, original amount, date and English cards',async()=>{
  const realNow=Date.now(),date=new Date(realNow).toISOString().slice(0,10);
  localStorage.setItem('fare-scout:exchange-rates',JSON.stringify({fetchedAt:realNow,rows:rows.map(row=>({...row,date}))}));
  setPreferences({language:'en',currency:'USD'});await ensureRates();
  assert.deepEqual(displayAmount(800),{code:'USD',date,converted:true,amount:'100'});
  assert.match(price(800),/≈ USD/);assert.match(price(800),/Original HK\$800/);assert.match(price(800),new RegExp(date));
  const leg={from:'HKG',to:'SIN',departureTime:'2026-11-07T01:00:00',arrivalTime:'2026-11-07T05:00:00',durationSeconds:14400,stops:0};
  const offer={price:800,bookingUrl:'https://example.test/booking',outbound:leg,inbound:{...leg,from:'SIN',to:'HKG',departureTime:'2026-11-09T01:00:00',arrivalTime:'2026-11-09T05:00:00'}};
  const html=dealCards([offer],[offer],1);
  assert.match(html,/USD/);assert.match(html,/Check price/);assert.equal(offer.price,800);
  setPreferences({currency:'JPY'});assert.equal(displayAmount(800).amount,'16,000');
  setPreferences({currency:'CNY'});assert.equal(displayAmount(800).code,'HKD');
  setPreferences({currency:'HKD',language:'zh-CN'});assert.doesNotMatch(price(800),/≈|Original/);
});
