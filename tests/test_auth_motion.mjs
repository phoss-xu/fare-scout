import test from 'node:test';
import assert from 'node:assert/strict';
import {setupAuthMotion} from '../app/static/auth-motion.js';

function fixture(t,{reduced=false}={}) {
  t.mock.timers.enable({apis:['setTimeout','setInterval']});
  const element=(tagName='DIV')=>({tagName,value:'',textContent:'',hidden:false,disabled:false,readOnly:false,dataset:{},attrs:{},listeners:{},
    validity:{valid:true},classList:{add(){},remove(){}},addEventListener(type,fn){this.listeners[type]=fn;},
    setAttribute(k,v){this.attrs[k]=v;},removeAttribute(k){delete this.attrs[k];},closest(){return {hidden:false};}});
  const scene=element(),caption=element(),card=element(),form=element('FORM'),email=element('INPUT'),password=element('INPUT');
  const submit=element('BUTTON'),other=element('BUTTON'),confirm=element('INPUT');
  submit.textContent='登录';confirm.disabled=true;
  const view=element(),workspace=element();
  const nodes={'.auth-card':card,'#auth-form':form,'#auth-email':email,'#auth-password':password,'#auth-submit':submit,'#auth-password-confirm':confirm,'#auth-view':view,'#workspace':workspace};
  card.insertAdjacentHTML=()=>{};card.querySelector=()=>scene;scene.querySelector=()=>caption;
  card.querySelectorAll=()=>[email,password,confirm,submit,other];
  const doc={activeElement:null,querySelector:s=>nodes[s],addEventListener(){}};
  const previous={document:globalThis.document,window:globalThis.window,matchMedia:globalThis.matchMedia,localStorage:globalThis.localStorage};
  Object.assign(globalThis,{document:doc,window:{addEventListener(){}},matchMedia:()=>({matches:reduced}),localStorage:{getItem:()=>null}});
  t.after(()=>{for(const [k,v] of Object.entries(previous)){if(v===undefined)delete globalThis[k];else globalThis[k]=v;}});
  return {flow:setupAuthMotion(),scene,caption,card,email,password,confirm,submit,other,doc,form};
}

test('autofilled fields use native email validity and keep password focus private',t=>{
  const f=fixture(t);f.email.value='traveler@example.test';f.password.value='demo-only';f.flow.sync();
  assert.equal(f.scene.dataset.packed,'true');assert.equal(f.scene.dataset.ready,'true');
  f.doc.activeElement=f.password;f.flow.sync();assert.equal(f.scene.dataset.private,'true');assert.equal(f.scene.dataset.ready,'false');
  f.doc.activeElement=null;f.email.validity.valid=false;f.flow.sync();assert.equal(f.scene.dataset.packed,'false');
});

test('pending auth locks repeat actions while keeping credential fields available to FormData',t=>{
  const f=fixture(t);f.email.value='traveler@example.test';f.password.value='demo-only';
  f.flow.start();f.flow.start();assert.equal(f.flow.busy,true);assert.equal(f.other.disabled,true);
  assert.equal(f.password.disabled,false);assert.equal(f.password.readOnly,true);assert.equal(f.password.value,'demo-only');
  t.mock.timers.tick(3500);assert.equal(f.scene.dataset.state,'waiting');
  f.flow.fail();f.flow.end();assert.equal(f.scene.dataset.state,'error');assert.equal(f.submit.disabled,false);
  assert.equal(f.password.readOnly,false);assert.equal(f.confirm.disabled,true);assert.equal(f.submit.textContent,'登录');
  t.mock.timers.tick(10000);assert.equal(f.scene.dataset.state,'error');
  f.form.listeners.input();assert.equal(f.scene.dataset.state,'idle');
});

test('fast success cancels late wait messages and completes with reduced motion',async t=>{
  const f=fixture(t,{reduced:true});f.flow.start();const done=f.flow.success();
  t.mock.timers.tick(0);await Promise.resolve();t.mock.timers.tick(0);await done;
  assert.equal(f.scene.dataset.state,'departing');f.flow.end();t.mock.timers.tick(10000);
  assert.equal(f.scene.dataset.state,'idle');assert.equal(f.flow.busy,false);assert.equal(f.card.attrs['aria-busy'],undefined);
});

test('icon-only authentication retains its graphic and announces pending and restored labels',t=>{
  const f=fixture(t),label={textContent:'登录'};
  f.submit.innerHTML='<svg aria-hidden="true"></svg>';
  f.submit.querySelector=selector=>selector==='.action-label'?label:null;
  f.flow.start();
  assert.equal(label.textContent,'正在登录…');assert.equal(f.submit.attrs['aria-label'],'正在登录…');
  f.flow.fail();f.flow.end();
  assert.equal(label.textContent,'登录');assert.equal(f.submit.attrs['aria-label'],'登录');
  assert.equal(f.submit.innerHTML,'<svg aria-hidden="true"></svg>');
});
