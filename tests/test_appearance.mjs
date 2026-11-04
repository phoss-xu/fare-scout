import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {themes,normalizeAppearance,DEFAULT_APPEARANCE,getAppearance,setAppearance,subscribeAppearance} from '../app/static/appearance-store.js';

test('invalid, old or injected browser preferences fall back to known values', () => {
  for(const value of [null,{},'night',{theme:'url(evil)',landscape:'__proto__'}]) assert.deepEqual(normalizeAppearance(value),DEFAULT_APPEARANCE);
  assert.deepEqual(normalizeAppearance({theme:'night',landscape:'daily',extra:'ignored'}),{font:'serif',theme:'night',landscape:'daily',surfaceOpacity:65,motion:true});
});
test('all six real theme palettes retain readable text and button labels', () => {
  const css=readFileSync(new URL('../app/static/themes.css',import.meta.url),'utf8');
  const lum=hex=>hex.match(/\w\w/g).map(c=>parseInt(c,16)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4).reduce((sum,c,i)=>sum+c*[.2126,.7152,.0722][i],0);
  const contrast=(a,b)=>{const [lo,hi]=[lum(a),lum(b)].sort((x,y)=>x-y);return(hi+.05)/(lo+.05);};
  for(const theme of themes){
    const block=css.match(new RegExp(`:root\\[data-theme=${theme.id}\\][^{]*\\{([^}]+)\\}`))[1];
    const colors=Object.fromEntries([...block.matchAll(/--theme-([\w-]+):#([\da-f]{6})/gi)].map(m=>[m[1],m[2]]));
    for(const [a,b] of [['text','bg'],['muted','bg'],['text','surface'],['muted','surface'],['on-accent','accent']]) assert.ok(contrast(colors[a],colors[b])>=4.5,`${theme.id}: ${a} on ${b}`);
  }
});
test('saved dark theme is applied before paint and malformed storage remains usable', () => {
  const script=readFileSync(new URL('../app/static/theme-init.js',import.meta.url),'utf8');
  for(const [saved,expected] of [['{"theme":"night"}','night'],['not json','paper'],['{"theme":"unknown"}','paper']]){
    const document={documentElement:{dataset:{}}};
    vm.runInNewContext(script,{document,localStorage:{getItem:()=>saved},console:{info:()=>{}}});
    assert.equal(document.documentElement.dataset.theme,expected);
  }
});
test('appearance changes persist both settings; storage failure still previews and informs subscribers', t => {
  const oldDocument=globalThis.document, oldStorage=globalThis.localStorage;
  let saved=JSON.stringify({theme:'night',landscape:'fixed'});
  globalThis.document={documentElement:{dataset:{}}};
  globalThis.localStorage={getItem:()=>saved,setItem:(_,value)=>{saved=value;}};
  t.after(()=>{globalThis.document=oldDocument;globalThis.localStorage=oldStorage;});
  assert.equal(getAppearance().theme,'night');
  const changes=[],unsubscribe=subscribeAppearance((prefs,success)=>changes.push({prefs,success}));
  t.after(unsubscribe);
  assert.equal(setAppearance({theme:'rose'}),true);
  assert.deepEqual(JSON.parse(saved),{font:'serif',theme:'rose',landscape:'fixed',surfaceOpacity:65,motion:true});
  localStorage.setItem=()=>{throw new Error('storage disabled');};
  assert.equal(setAppearance({landscape:'daily'}),false);
  assert.equal(document.documentElement.dataset.theme,'rose');
  assert.deepEqual(changes.at(-1),{prefs:{font:'serif',theme:'rose',landscape:'daily',surfaceOpacity:65,motion:true},success:false});
});

test('header veil opacity migrates old photo preferences and clamps only finite numeric values', () => {
  assert.equal(normalizeAppearance({opacity:90}).surfaceOpacity,65);
  assert.equal(Object.hasOwn(normalizeAppearance({opacity:90}), 'opacity'),false);
  for (const surfaceOpacity of [undefined,null,'50',NaN,Infinity]) assert.equal(normalizeAppearance({surfaceOpacity}).surfaceOpacity,65);
  for (const [value,expected] of [[0,0],[100,100],[-20,0],[140,100],[62.7,63]]) assert.equal(normalizeAppearance({surfaceOpacity:value}).surfaceOpacity,expected);
  assert.equal(normalizeAppearance({motion:false}).motion,false);
  assert.equal(normalizeAppearance({motion:'false'}).motion,true);
});
