import test from 'node:test';
import assert from 'node:assert/strict';
import {hourKey, nextHourDelay, nextSceneIndex} from '../app/static/landscape-rotation.js';

test('return visits rotate through every photograph without adjacent repeats', () => {
  const visited = []; let index = -1;
  for (let n = 0; n < 10; n++) { index = nextSceneIndex(5, index, 2); visited.push(index); }
  assert.equal(new Set(visited.slice(0, 5)).size, 5);
  assert.deepEqual(visited.slice(0, 5), visited.slice(5));
  assert.ok(visited.every((item, n) => !n || item !== visited[n-1]));
});
test('removed or unavailable saved selection uses an in-range entry', () => {
  assert.equal(nextSceneIndex(5, -1, 17), 2);
  assert.equal(nextSceneIndex(5, undefined, 4294967295), 0);
  assert.equal(nextSceneIndex(1, 0), 0);
  assert.throws(() => nextSceneIndex(0, 0), RangeError);
});
test('hour boundaries update once and schedule the next full hour without busy polling', () => {
  const before = Date.parse('2026-11-02T15:59:59.900+08:00');
  assert.equal(nextHourDelay(before), 100);
  assert.equal(hourKey(before + 99), hourKey(before));
  assert.equal(hourKey(before + 100), hourKey(before) + 1);
  assert.equal(nextHourDelay(before + 100), 3600000);
  assert.ok(hourKey(before + 25 * 3600000) > hourKey(before));
});

test('a hidden page catches up once, preserves the selected scene, and ignores same-hour visibility changes', async t => {
  const {startLandscapeRotation} = await import('../app/static/landscape-rotation.js');
  const savedDocument = globalThis.document, savedWindow = globalThis.window;
  const listeners = new Map();
  globalThis.document = {hidden:false, addEventListener:(name, callback) => listeners.set(name, callback)};
  globalThis.window = {addEventListener:(name, callback) => listeners.set(name, callback)};
  t.mock.timers.enable({apis:['setTimeout']});
  t.after(() => { globalThis.document = savedDocument; globalThis.window = savedWindow; });
  let now = Date.parse('2026-11-02T15:25:00+08:00');
  const values = new Map([['fare-scout:landscape:last','forest']]);
  const seen = [], items = ['forest','sculpture','beach','city','rice'].map(id => ({id}));
  const storage = {getItem:key => values.get(key), setItem:(key, value) => values.set(key,value)};
  const rotation = startLandscapeRotation({items, storage, now:() => now, render:item => seen.push(item.id)});
  assert.deepEqual(seen, ['sculpture']);
  rotation.check(); assert.equal(seen.length, 1);
  document.hidden = true; now += 25 * 3600000; rotation.check();
  assert.equal(seen.length, 1);
  document.hidden = false; listeners.get('visibilitychange')();
  assert.deepEqual(seen, ['sculpture','beach']); assert.equal(values.get('fare-scout:landscape:last'), 'beach');
  listeners.get('pageshow')(); assert.equal(seen.length, 2);
  now += 3600000; rotation.check();
  assert.deepEqual(seen, ['sculpture','beach','city']);
});

test('daily changes at Shanghai midnight, survives reload, and fixed mode never advances', async t => {
  const {startLandscapeRotation, dayKey, nextDayDelay} = await import('../app/static/landscape-rotation.js');
  const savedDocument=globalThis.document, savedWindow=globalThis.window;
  globalThis.document={hidden:false,addEventListener:()=>{}}; globalThis.window={addEventListener:()=>{}};
  t.mock.timers.enable({apis:['setTimeout']});
  t.after(()=>{globalThis.document=savedDocument;globalThis.window=savedWindow;});
  let now=Date.parse('2026-11-02T23:59:59.900+08:00');
  assert.equal(nextDayDelay(now),100);
  assert.equal(dayKey(now+100),dayKey(now)+1);
  const values=new Map([['fare-scout:landscape:last','forest'],['fare-scout:landscape:period',`daily:${dayKey(now)}`]]);
  const storage={getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)};
  const items=['forest','sculpture','beach'].map(id=>({id})), seen=[];
  const daily=startLandscapeRotation({items,storage,now:()=>now,mode:'daily',render:item=>seen.push(item.id)});
  assert.deepEqual(seen,['forest']); // Same-day reload keeps the landscape.
  now+=100; daily.check(); assert.deepEqual(seen,['forest','sculpture']);
  daily.setMode('fixed'); now+=3*86400000; daily.check(); assert.equal(seen.length,2);
  const fixed=[];
  startLandscapeRotation({items,storage,now:()=>now,mode:'fixed',render:item=>fixed.push(item.id)});
  assert.deepEqual(fixed,['sculpture']);
});

test('a manually chosen photograph persists in fixed mode and can resume automatic rotation', async t => {
  const {startLandscapeRotation} = await import('../app/static/landscape-rotation.js');
  const oldDocument=globalThis.document,oldWindow=globalThis.window;
  globalThis.document={hidden:false,addEventListener:()=>{}};globalThis.window={addEventListener:()=>{}};
  t.mock.timers.enable({apis:['setTimeout']});
  t.after(()=>{globalThis.document=oldDocument;globalThis.window=oldWindow;});
  let now=Date.parse('2026-11-02T12:30:00+08:00');
  const values=new Map([['fare-scout:landscape:last','forest']]);
  const storage={getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)};
  const items=['forest','city','harbour'].map(id=>({id})),seen=[];
  const rotation=startLandscapeRotation({items,storage,now:()=>now,mode:'hourly',render:item=>seen.push(item.id)});
  rotation.setMode('fixed');assert.equal(rotation.select('harbour'),true);
  assert.equal(seen.at(-1),'harbour');assert.equal(values.get('fare-scout:landscape:last'),'harbour');
  assert.equal(rotation.select('removed'),false);assert.equal(seen.at(-1),'harbour');
  now+=86400000;rotation.check();assert.equal(seen.at(-1),'harbour');
  const reloaded=[];
  startLandscapeRotation({items,storage,now:()=>now,mode:'fixed',render:item=>reloaded.push(item.id)});
  assert.deepEqual(reloaded,['harbour']);
  rotation.setMode('hourly');now+=3600000;rotation.check();assert.equal(seen.at(-1),'forest');
});
