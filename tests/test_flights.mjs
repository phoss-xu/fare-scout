import assert from 'node:assert/strict';
import test from 'node:test';
import {baggageItems, duration, flightDetails} from '../app/static/flights.js';
import {latest} from '../app/static/views.js';

const segment = {
  from:'HKG', to:'SGN', fromName:'Hong Kong International', toName:'Tan Son Nhat International',
  fromCity:'Hong Kong', toCity:'Ho Chi Minh City', fromCountry:'Hong Kong', toCountry:'Vietnam',
  departureTime:'2026-11-07T18:40:00', arrivalTime:'2026-11-07T20:25:00', durationSeconds:9900,
  carrierName:'Vietnam Airlines', flightNumber:'VN595', cabinClass:'Economy',
};
const outbound = {...segment, stops:0, segments:[segment]};

test('use provider flight duration across time zones and show airport and carrier metadata', () => {
  const html = flightDetails({outbound, baggage:{personalItem:1,cabinBag:1,checkedBag:0}});
  assert.match(html, /2 小时 45 分钟/);
  assert.match(html, /18:40/);
  assert.match(html, /20:25/);
  assert.match(html, /Hong Kong International/);
  assert.match(html, /Tan Son Nhat International/);
  assert.match(html, /Vietnam Airlines/);
  assert.match(html, /VN595/);
  assert.match(html, /机场当地时间/);
  assert.match(html, /托运行李 0 件/);
  assert.doesNotMatch(html, /20\s*kg|每人 1 件|免费/);
});

test('missing baggage and duration remain unknown rather than zero', () => {
  assert.deepEqual(baggageItems(null), ['随身小包 件数暂缺','手提行李 件数暂缺','托运行李 件数暂缺']);
  assert.equal(duration(null), '时长暂缺');
  assert.equal(duration(-1), '时长暂缺');
  assert.equal(duration(14400), '4 小时');
  assert.match(flightDetails({}), /航段信息暂缺/);
  assert.match(flightDetails({}), /重量、尺寸/);
});

test('metadata is escaped and cannot inject markup', () => {
  const hostile = {...segment, fromName:'<img src=x onerror=alert(1)>', carrierName:'<script>alert(1)</script>'};
  const html = flightDetails({outbound:{...outbound, segments:[hostile]}});
  assert.match(html, /&lt;img/);
  assert.match(html, /&lt;script/);
  assert.doesNotMatch(html, /<img|<script/);
});

test('show layover interval and distinguish airport transfers', () => {
  const first = {...segment, to:'BKK', arrivalTime:'2026-11-07T23:00:00'};
  const second = {...segment, from:'BKK', departureTime:'2026-11-08T01:00:00'};
  let html = flightDetails({outbound:{...outbound, stops:1, segments:[first, second]}});
  assert.match(html, /BKK 中转 · 间隔约 2 小时/);
  assert.match(html, /1 次中转/);
  html = flightDetails({outbound:{...outbound, stops:1, segments:[first, {...second, from:'DMK'}]}});
  assert.match(html, /需更换机场：BKK → DMK/);
  assert.doesNotMatch(html, /间隔约 2 小时/);
});

test('all concrete routes from the latest country query stay visible', () => {
  const common = {watch_id:1,search_id:'country:JP',departure:'2026-11-07',arrival:'2026-11-09'};
  const rows = [{...common,id:3,batch_id:'new',route_key:'HKG-HND',status:'ok'},
    {...common,id:2,batch_id:'new',route_key:'HKG-NRT',status:'ok'},
    {...common,id:1,batch_id:'old',route_key:'HKG-NRT',status:'ok'}];
  assert.equal(latest(rows).length, 2);
  const failure = {...common,id:4,batch_id:'failed',status:'error'};
  assert.deepEqual(latest([failure,...rows]), [failure]);
});
