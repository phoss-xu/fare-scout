import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {routeProjection,groupedRoutes,routeCurve} from '../app/static/route-projection.js';
import {dealCards} from '../app/static/deal_views.js';
test('map keeps all dates and original indexes while quoting the cheapest returned fare per route',()=>{
 const a={price:1500,outbound:{from:'HKG',to:'SIN'}},b={price:900,outbound:{from:'HKG',to:'SIN'}},c={price:800,outbound:{from:'HKG',to:'UNKNOWN'}};
 const offers=[a,b,c],{groups,missing}=groupedRoutes(offers,{HKG:[114,22],SIN:[104,1]});
 assert.deepEqual(groups[0].offers,[b,a]);assert.deepEqual(missing,[c]);assert.deepEqual(offers,[a,b,c]);
 assert.equal(offers.indexOf(groups[0].offers[0]),1);
});
test('projection fits regional, single-airport and date-line routes without a globe-spanning seam',()=>{
 for(const points of [[[114,22],[104,1]],[[179,35],[-179,40]],[[114,22],[114,22]],[[-122,37],[151,-33],[114,22]]]) {
  const project=routeProjection(points,358,420);
  for(const point of points) {
   const [x,y]=project(point);assert.ok(x>=60 && x<=298);assert.ok(y>=60 && y<=360);
  }
 }
 const project=routeProjection([[179,35],[-179,40]],1000,560);
 assert.ok(Math.abs(project([179,35])[0]-project([-179,40])[0])<100);
 assert.ok(!routeCurve([1,1],[1,1]).path.includes('NaN'));
});
test('bundled chart includes valid airport coordinates',()=>{
 const geo=JSON.parse(readFileSync(new URL('../app/static/route-airports.json',import.meta.url)));
 assert.ok(Object.keys(geo.airports).length>9000);
 assert.ok(Math.abs(geo.airports.HKG[0]-114)<1);
 for(const p of Object.values(geo.airports))assert.ok(p.length===2 && p.every(Number.isFinite) && Math.abs(p[0])<=180 && Math.abs(p[1])<=90);
});
test('collapsed quotes expose actual baggage quantities and never invent an allowance',()=>{
 const leg={from:'HKG',to:'SIN',departureTime:'2026-11-14T10:00:00',arrivalTime:'2026-11-14T14:00:00',stops:0,durationSeconds:14400};
 const o={price:1000,outbound:leg,inbound:leg,baggage:{personalItem:1,cabinBag:0,checkedBag:2}};
 const html=dealCards([o],[o],1).split('<details')[0];
 assert.ok(html.includes('随身小包 1 件'));assert.ok(html.includes('手提行李 0 件'));assert.ok(html.includes('托运行李 2 件'));
 delete o.baggage;assert.ok(dealCards([o],[o],1).split('<details')[0].includes('件数暂缺'));
});
test('dense maps keep at most six geographic price labels and cluster nearby destinations',async()=>{
 const {clusterPoints,mapLabels,MAP_LABEL_SIZE}=await import('../app/static/route-projection.js');
 for(const [width,height,limit] of [[356,360,3],[950,520,6]]) {
  const points=Array.from({length:100},(_,index)=>({index,x:60+index%10*22,y:70+Math.floor(index/10)*20,price:1000+index}));
  const clusters=clusterPoints(points);
  assert.equal(clusters.reduce((n,c)=>n+c.items.length,0),100);
  assert.ok(clusters.length<100);
  const labels=mapLabels(points,width,height,80,limit);
  assert.ok(labels.length<=limit);
  for(const [i,p] of labels.entries()) {
   assert.ok(p.x>=8 && p.x+MAP_LABEL_SIZE.width<=width-8 && p.y>=8 && p.y+MAP_LABEL_SIZE.height<=height-8);
   for(const q of labels.slice(i+1))assert.ok(p.x+MAP_LABEL_SIZE.width<q.x || q.x+MAP_LABEL_SIZE.width<p.x || p.y+MAP_LABEL_SIZE.height<q.y || q.y+MAP_LABEL_SIZE.height<p.y);
  }
 }
});
test('selected route takes priority over cheaper neighboring map labels',async()=>{
 const {mapLabels}=await import('../app/static/route-projection.js');
 const points=[{index:0,x:200,y:200,price:100},{index:1,x:201,y:201,price:9999}];
 assert.equal(mapLabels(points,600,400,1,1)[0].index,1);
});
test('compact price pins stay anchored, avoid collisions, and prioritize the selected destination',async()=>{
 const {bubbleLayout}=await import('../app/static/route-bubbles.js');
 const points=Array.from({length:100},(_,index)=>({index,x:50+index%10*28,y:60+Math.floor(index/10)*27,price:1000+index}));
 for(const [width,height] of [[356,390],[950,640]]) {
  const pins=bubbleLayout(points,width,height,48);
  assert.ok(pins.length<=Math.min(32,Math.max(3,Math.floor(width*height/17000))));
  assert.equal(pins[0].index,48);
  for(const [i,p] of pins.entries()) {
   assert.equal(p.x+p.w/2,points[p.index].x);
   assert.ok(p.x>=6 && p.x+p.w<=width-6 && p.y>=6 && p.y+p.h<=height-35);
   assert.ok(pins.slice(i+1).every(q=>p.x+p.w<q.x || q.x+q.w<p.x || p.y+p.h<q.y || q.y+q.h<p.y));
  }
 }
});
test('map fit bounds follow routes crossing the date line through the short interval',async()=>{
 const {routeBounds}=await import('../app/static/route-bubbles.js');
 const bounds=routeBounds([{from:'AAA',to:'BBB'}],{AAA:[179,30],BBB:[-179,40]});
 assert.equal(bounds[1][0]-bounds[0][0],2);assert.deepEqual([bounds[0][1],bounds[1][1]],[30,40]);
});
test('destination cards expose dates, both durations and baggage without pretending a photograph exists',async()=>{
 const {destinationRow}=await import('../app/static/route-card-views.js');
 const leg={departureTime:'2026-11-14T10:00:00',durationSeconds:7200};
 const group={from:'HKG',to:'SIN',offers:[{price:1200,destination_name:'<img onerror=x>',outbound:leg,inbound:{...leg,departureTime:'2026-11-16T10:00:00'},baggage:{personalItem:1,cabinBag:0,checkedBag:2}}]};
 const html=destinationRow(group,9,{},2);
 assert.ok(html.includes('&lt;img'));assert.ok(html.includes('11/14 – 11/16'));
 assert.ok(html.includes('去 2 小时 · 返 2 小时'));assert.ok(html.includes('随身 1 件 · 手提 0 件 · 托运 2 件'));
 assert.ok(html.includes('data-map-pick="9"'));assert.ok(!html.includes('<img src='));
});
