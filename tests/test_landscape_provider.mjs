import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizePhoto, fetchLandscape, validPhoto, REFRESH_MS} from '../app/static/landscape-provider.js';
import {toggleLike, readLikes} from '../app/static/landscape-actions.js';
const storage = () => {const map = new Map(); return {getItem:key=>map.get(key)||null,setItem:(key,value)=>map.set(key,value)};};
const page = (id=1) => ({pageid:id,title:'File:Coast.jpg', imageinfo:[{mime:'image/jpeg',width:3000,height:2000,
  url:'https://upload.wikimedia.org/a/coast.jpg',thumburl:'https://upload.wikimedia.org/a/1600px-coast.jpg',descriptionurl:'https://commons.wikimedia.org/wiki/File:Coast.jpg',
  extmetadata:{Artist:{value:'<a href="https://example.com">A photographer</a>'},LicenseShortName:{value:'CC BY-SA 4.0'},
    LicenseUrl:{value:'https://creativecommons.org/licenses/by-sa/4.0/'},ImageDescription:{value:'A coast &amp; sea'}}}]});

test('only landscape photos with explicit supported permission and trusted URLs are accepted', () => {
  const photo=normalizePhoto(page()); assert.ok(validPhoto(photo)); assert.equal(photo.author,'A photographer'); assert.equal(photo.description,'A coast & sea');
  for (const mutate of [p=>p.imageinfo[0].extmetadata.LicenseUrl.value='https://example.com/license',p=>p.imageinfo[0].thumburl='javascript:alert(1)',p=>p.imageinfo[0].width=1000,p=>p.imageinfo[0].height=4000,p=>delete p.imageinfo[0].extmetadata.Artist]) {
    const p=page(); mutate(p); assert.equal(normalizePhoto(p),null);
  }
  assert.equal(validPhoto({...photo, downloadUrl:'https://evil.test/file.jpg'}),false);
});
test('a cached photo avoids repeat requests, expires after an hour and avoids an adjacent repeat', async () => {
  const store=storage(); let calls=0;
  const fetcher=async()=>{calls++;return {ok:true,json:async()=>({query:{pages:[page(1)]}})};};
  const first=await fetchLandscape({fetcher,storage:store,now:10});
  assert.equal((await fetchLandscape({fetcher,storage:store,now:20})).id,first.id); assert.equal(calls,1);
  const next=await fetchLandscape({fetcher:async()=>({ok:true,json:async()=>({query:{pages:[page(1),page(2)]}})}),storage:store,now:REFRESH_MS+10});
  assert.equal(next.id,'commons:2');
});
test('service errors, no licensed results and unavailable storage are handled explicitly', async () => {
  await assert.rejects(fetchLandscape({fetcher:async()=>({ok:false,status:503}),storage:storage()}),/503/);
  await assert.rejects(fetchLandscape({fetcher:async()=>({ok:true,json:async()=>({error:{code:'maxlag'}})}),storage:storage()}),/maxlag/);
  await assert.rejects(fetchLandscape({fetcher:async()=>({ok:true,json:async()=>({query:{pages:[]}})}),storage:storage()}),/No licensed/);
  const blocked={getItem:()=>{throw new Error('blocked');},setItem:()=>{throw new Error('blocked');}};
  assert.ok(await fetchLandscape({storage:blocked,fetcher:async()=>({ok:true,json:async()=>({query:{pages:[page()]}})})}));
});
test('likes survive re-reading, toggle independently and report write failures', () => {
  const store=storage(),photo=normalizePhoto(page()); assert.equal(toggleLike(photo,store),true);
  assert.equal(readLikes(store)[0].id,photo.id); assert.equal(toggleLike(photo,store),false); assert.deepEqual(readLikes(store),[]);
  assert.throws(()=>toggleLike(photo,{getItem:()=>null,setItem:()=>{throw new Error('quota');}}),/quota/);
});
