import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchLandscape, validPhoto, remoteLandscapes, REFRESH_MS} from '../app/static/landscape-provider.js';
import {toggleLike, readLikes} from '../app/static/landscape-actions.js';
const storage=()=>{const map=new Map();return {getItem:key=>map.get(key)||null,setItem:(key,value)=>map.set(key,value)};};
test('catalogue accepts only recorded images, authors and source identities',()=>{
  assert.ok(remoteLandscapes.length>1);
  for(const photo of remoteLandscapes){
    assert.ok(validPhoto(photo));assert.match(photo.source,/^https:\/\/unsplash.com\/photos\//);
    assert.match(photo.imageUrl,/^https:\/\/images.unsplash.com\/photo-/);
    assert.equal(photo.licenseUrl,'https://unsplash.com/license');
    for(const key of ['imageUrl','downloadUrl','source','licenseUrl','author','name']) assert.equal(validPhoto({...photo,[key]:'https://evil.test'}),false);
  }
});
test('cache is written only after decoding; cached images are rechecked and expire after an hour',async()=>{
 const store=storage();const calls=[];
 const loadImage=async p=>{assert.equal(store.getItem('fare-scout:landscape:feed:v2'),null);calls.push(p.id);};
 const first=await fetchLandscape({storage:store,now:10,random:()=>0,loadImage});
 assert.equal(first.id,'braies');assert.equal(calls.length,1);
 assert.equal((await fetchLandscape({storage:store,now:20,loadImage:async p=>calls.push(p.id)})).id,first.id);
 const next=await fetchLandscape({storage:store,now:REFRESH_MS+10,random:()=>0,loadImage:async()=>{}});
 assert.notEqual(next.id,first.id);
});
test('failed images are skipped, a broken cached photo is replaced, total failure remains an error',async()=>{
 const store=storage();const attempts=[];
 const result=await fetchLandscape({storage:store,now:10,random:()=>0,loadImage:async p=>{attempts.push(p.id);if(p.id==='braies')throw new Error('unreachable');}});
 assert.equal(attempts.length,2);assert.notEqual(result.id,'braies');
 const replaced=await fetchLandscape({storage:store,now:20,random:()=>0,loadImage:async p=>{if(p.id===result.id)throw new Error('cached unreachable');}});
 assert.notEqual(replaced.id,result.id);
 let count=0;
 await assert.rejects(fetchLandscape({storage:storage(),random:()=>0,loadImage:async()=>{count++;throw new Error('offline');}}),AggregateError);
 assert.equal(count,3);
});
test('storage failure does not prevent a successfully loaded image or hide failed loads',async()=>{
 const blocked={getItem:()=>{throw new Error('blocked');},setItem:()=>{throw new Error('blocked');}};
 assert.ok(await fetchLandscape({storage:blocked,loadImage:async()=>{}}));
 await assert.rejects(fetchLandscape({storage:blocked,loadImage:async()=>{throw new Error('offline');}}),AggregateError);
});
test('existing favourites survive and new Unsplash photos can be liked independently',()=>{
 const store=storage(),photo=remoteLandscapes[0];assert.equal(toggleLike(photo,store),true);
 assert.equal(readLikes(store)[0].id,photo.id);assert.equal(toggleLike(photo,store),false);assert.deepEqual(readLikes(store),[]);
 assert.throws(()=>toggleLike(photo,{getItem:()=>null,setItem:()=>{throw new Error('quota');}}),/quota/);
});
