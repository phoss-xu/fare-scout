import test from 'node:test';
import assert from 'node:assert/strict';
import {presetCards,presetDescription} from '../app/static/search-presets.js';
import {restoreSearch} from '../app/static/search-form.js';
const config={origins:['airport:HKG'],destinations:['country:JP'],date_mode:'fixed',start:'2027-01-02',end:'2027-01-03',adults:2,budget:3000,max_stops:0,max_duration_hours:8,nights:[],weekdays:[]};
test('saved cards escape user content and distinguish dates, routes and preferences',()=>{
  const html=presetCards([{id:'safe',name:'<img src=x onerror=alert(1)>',config}], 'safe');
  assert.ok(!html.includes('<img'));assert.ok(html.includes('&lt;img'));assert.match(html,/aria-pressed="true"/);
  assert.match(html,/2027-01-02/);assert.match(html,/3000/);assert.match(html,/HKG/);
  const pairs=[{start:'2027-01-02',end:'2027-01-03'},{start:'2027-01-16',end:'2027-01-17'}];
  assert.match(presetDescription({...config,date_pairs:pairs}),/01-02–01-03.*01-16–01-17/);
});
test('restoration fills every filter and exact weekend pairs without issuing a search',async()=>{
  const fields=Object.fromEntries(['start','end','adults','budget','max_stops','max_duration_hours','date_mode','date_pairs','anywhere'].map(key=>[key,{}]));
  const nights=[1,2,4].map(value=>({value})),weekdays=[0,5,6].map(value=>({value}));let changes=0;
  const form={elements:fields,querySelectorAll:s=>s==='[name=night]'?nights:weekdays,dispatchEvent:()=>changes++};
  let origins,destinations;
  const from={setValues:async values=>origins=values},to={setValues:async values=>destinations=values};
  await restoreSearch(form,from,to,{...config,date_mode:'range',nights:[2,4],weekdays:[5],destinations:[]});
  assert.deepEqual(origins,config.origins);assert.deepEqual(destinations,[]);assert.equal(fields.anywhere.checked,true);
  assert.deepEqual(nights.map(b=>b.checked),[false,true,true]);assert.deepEqual(weekdays.map(b=>b.checked),[false,true,false]);
  assert.equal(fields.budget.value,3000);assert.equal(fields.max_stops.value,0);assert.equal(changes,1);
  const pairs=[{start:config.start,end:config.end}];
  await restoreSearch(form,from,to,{...config,date_pairs:pairs});assert.equal(fields.date_mode.value,'weekends');assert.deepEqual(JSON.parse(fields.date_pairs.value),pairs);
  await restoreSearch(form,from,to,{...config,adults:9},()=>false);assert.equal(fields.adults.value,2);
});
