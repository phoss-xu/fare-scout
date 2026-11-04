import {icon,setIconButton} from '../app/static/ui-icons.js';
import {createFilmPreferences,nextFilmIndex,FILM_PREFERENCES_KEY} from '../app/static/film-preferences.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {authFilms,filmPath} from '../app/static/auth-films-data.js';
class Element extends EventTarget {
 constructor(){super();this.children=[];this.style={};this.dataset={};this.attributes={};this.classes=new Set();this.classList={add:x=>this.classes.add(x),remove:x=>this.classes.delete(x)};}
 setAttribute(k,v){this.attributes[k]=v;}
 getAttribute(k){return k==='src'?this.src??null:this.attributes[k]??null;}
 click(){this.dispatchEvent(new Event('click'));}
}
function fixture({reduced=false,saveData=false,entries={}}={}) {
 const elements=Object.fromEntries(['.auth-films','.auth-film-controls','#auth-film-toggle','#auth-film-status','#auth-film-place','#auth-film-credit','#auth-film-like','#auth-film-dislike','#auth-film-undo'].map(x=>[x,new Element()]));
 const poster=new Element(),failures=new Set(),pending=[];
 const players=[0,1].map(()=>{
  const p=new Element();p.paused=true;
  p.pause=()=>{p.paused=true;};p.play=async()=>{p.paused=false;};
  p.load=()=>pending.push(()=>p.dispatchEvent(new Event(failures.has(p.src)?'error':'canplay')));return p;
 });
 elements['.auth-films'].querySelectorAll=()=>players;elements['.auth-films'].querySelector=()=>poster;
 const view={hidden:false,querySelector:key=>elements[key]};
 const document=new EventTarget();document.hidden=false;document.querySelector=()=>view;
 const media=new EventTarget();media.matches=reduced;
 const memory=new Map([[FILM_PREFERENCES_KEY,JSON.stringify({version:1,entries})]]);
 const storage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)};
 let observer;
 const timers=new Map();let timerId=0;
 const context=vm.createContext({document,navigator:{connection:{saveData}},window:new EventTarget(),matchMedia:()=>media,
  MutationObserver:class{constructor(callback){observer=callback;}observe(){}},
  setTimeout:(fn,ms)=>{timers.set(++timerId,{fn,ms});return timerId;},clearTimeout:id=>timers.delete(id),
  console:{warn(){}},tr:zh=>zh,authFilms,filmPath,icon,setIconButton,FILM_PREFERENCES_KEY,nextFilmIndex,createFilmPreferences:()=>createFilmPreferences(storage)});
 const source=readFileSync(new URL('../app/static/auth-films.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace('export function setupAuthFilms','function setupAuthFilms');
 vm.runInContext(source+'\nsetupAuthFilms();',context);
 return {elements,players,poster,failures,pending,document,view,timers,media,storage,visibility:()=>observer()};
}
const settle=async()=>{for(let i=0;i<20;i++) await Promise.resolve();};
async function load(f){f.pending.splice(0).forEach(fn=>fn());await settle();}
const playing=f=>f.players.find(p=>!p.paused);
const dislike=f=>f.elements['#auth-film-dislike'].click();
test('reduced motion and save data never load video; dislikes still advance the still',()=>{
 for(const option of [{reduced:true},{saveData:true}]){
  const f=fixture(option);assert.equal(f.pending.length,0);dislike(f);
  assert.equal(f.pending.length,0);assert.equal(f.poster.src,filmPath(authFilms[1],'jpg'));
 }
});
test('natural clip end advances once; players do not loop or use a rotation timer',async()=>{
 const f=fixture();await load(f);assert.equal(playing(f).loop,false);assert.equal(f.timers.size,0);
 playing(f).dispatchEvent(new Event('ended'));await load(f);
 assert.equal(playing(f).src,filmPath(authFilms[1]));assert.equal(f.players.filter(p=>!p.paused).length,1);
});
test('like toggles a durable stable ID without interrupting playback',async()=>{
 const f=fixture();await load(f);const p=playing(f),button=f.elements['#auth-film-like'];button.click();
 assert.equal(createFilmPreferences(f.storage).reaction(authFilms[0].id),'liked');assert.equal(playing(f),p);
 assert.equal(button.getAttribute('aria-pressed'),'true');button.click();
 assert.equal(createFilmPreferences(f.storage).reaction(authFilms[0].id),null);
});
test('disliked scenes disappear immediately and stay excluded after reload',async()=>{
 const f=fixture();await load(f);dislike(f);assert.ok(f.players.every(p=>p.paused));await load(f);
 const entries=JSON.parse(f.storage.getItem(FILM_PREFERENCES_KEY)).entries;
 const reopened=fixture({entries});await load(reopened);
 assert.equal(playing(reopened).src,filmPath(authFilms[1]));assert.equal(reopened.poster.src,filmPath(authFilms[1],'jpg'));
});
test('all disliked scenes show a neutral surface and broken heart can undo',async()=>{
 const entries=Object.fromEntries(authFilms.map(f=>[f.id,{reaction:'disliked',updatedAt:'2026-11-04T00:00:00.000Z'}]));
 const f=fixture({entries});assert.equal(f.pending.length,0);assert.equal(f.poster.hidden,true);
 assert.equal(f.elements['#auth-film-like'].disabled,true);dislike(f);await load(f);assert.ok(playing(f));
});
test('failed next clip is skipped rather than appearing as a successful empty scene',async()=>{
 const f=fixture();await load(f);f.failures.add(filmPath(authFilms[1]));
 playing(f).dispatchEvent(new Event('ended'));await load(f);await load(f);
 assert.equal(playing(f).src,filmPath(authFilms[2]));
});
test('hidden login pauses, returning resumes, manual pause prevents automatic advance',async()=>{
 const f=fixture();await load(f);f.view.hidden=true;f.visibility();assert.ok(f.players.every(p=>p.paused));
 f.view.hidden=false;f.visibility();await settle();assert.ok(playing(f));
 const original=playing(f);f.elements['#auth-film-toggle'].click();original.dispatchEvent(new Event('ended'));
 assert.ok(f.players.every(p=>p.paused));assert.equal(f.pending.length,0);
});
test('reduced motion change immediately pauses playback',async()=>{
 const f=fixture();await load(f);f.media.matches=true;f.media.dispatchEvent(new Event('change'));
 assert.ok(f.players.every(p=>p.paused));assert.equal(f.timers.size,0);
});
test('playlist excludes every blocked clip and can wrap to its only eligible clip',()=>{
 const p={reaction:id=>id===authFilms[1].id?'liked':'disliked'};
 assert.equal(nextFilmIndex(authFilms,1,p),1);
 assert.equal(nextFilmIndex(authFilms,1,p,new Set([authFilms[1].id])),-1);
 assert.ok(!authFilms.some(f=>f.id==='terrace-coffee'));
});
test('storage write failures remain explicit while retaining the choice for this visit',()=>{
 const storage={getItem:()=>null,setItem:()=>{throw new Error('quota');}};
 const p=createFilmPreferences(storage);assert.equal(p.set('seaside-coffee','disliked'),false);
 assert.equal(p.saved,false);assert.equal(p.reaction('seaside-coffee'),'disliked');
});

test('undo restores a disliked scene after reload without changing unrelated favorites',async()=>{
 const entries={[authFilms[0].id]:{reaction:'disliked',updatedAt:'2026-11-04'},[authFilms[2].id]:{reaction:'liked',updatedAt:'2026-11-04'}};
 const f=fixture({entries});await load(f);f.elements['#auth-film-undo'].click();await load(f);
 assert.equal(playing(f).src,filmPath(authFilms[0]));
 assert.equal(createFilmPreferences(f.storage).reaction(authFilms[2].id),'liked');
});
