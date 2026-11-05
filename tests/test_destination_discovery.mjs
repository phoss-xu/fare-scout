import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {countryCities} from '../app/static/destination-discovery.js';
const groups=JSON.parse(readFileSync(new URL('../cloudflare/src/groups.json',import.meta.url)));

test('Southeast Asia recommendations place Chiang Mai with Thai cities and preserve canonical IDs',()=>{
  const rows=countryCities(groups['southeast-asia'].sections);
  const thai=rows.find(row=>row.country.id==='country:TH');
  assert.deepEqual(thai.cities.map(city=>city.id),['city:CNX','city:BKK','city:HKT']);
  assert.ok(rows.every(row=>row.cities.every(city=>city.country_code===row.country.code)));
});

test('every recommended region groups only cities, with country metadata from the catalogue',()=>{
  for(const key of ['southeast-asia','east-asia','europe','oceania','middle-east','north-america','south-america','africa']) {
    const rows=countryCities(groups[key].sections);
    assert.ok(rows.length,key);
    assert.ok(rows.every(row=>row.country?.kind==='country' && row.cities.every(city=>city.kind==='city')),key);
  }
});
