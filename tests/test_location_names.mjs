import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadLocationNames,locationName,carrierLabel} from '../app/static/location-names.js';
import {setPreferences} from '../app/static/preferences.js';
test('city and airport names follow language using the shared catalogue; codes remain stable',async()=>{
 const realFetch=globalThis.fetch,realDocument=globalThis.document;
 globalThis.document={dispatchEvent(){}};
 globalThis.fetch=async()=>({ok:true,json:async()=>JSON.parse(readFileSync('app/static/location-names.json','utf8'))});
 try {
  await loadLocationNames();setPreferences({language:'zh-CN'});
  assert.equal(locationName('HKG'),'香港');assert.equal(locationName('HAN'),'河内');
  assert.equal(locationName('HKG','airport'),'香港国际机场');assert.equal(carrierLabel({carrier:'UO',carrierName:'Hong Kong Express Airways'}),'香港快运');
  setPreferences({language:'en'});assert.equal(locationName('HKG'),'Hong Kong');assert.equal(locationName('HAN'),'Hanoi');
  assert.equal(locationName('ZZZ','city'),'ZZZ');
 } finally {globalThis.fetch=realFetch;globalThis.document=realDocument;}
});
