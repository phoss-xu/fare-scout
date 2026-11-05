import test from 'node:test';
import assert from 'node:assert/strict';
import {setupJourneyDisclosures} from '../app/static/journey-disclosures.js';
function fixture() {
  const doc=new EventTarget();doc.modal=false;doc.querySelector=()=>doc.modal?{}:null;
  const editors=Array.from({length:3},()=>{
    const editor=new EventTarget();editor.open=false;
    editor.summary={attributes:{},focusCount:0,setAttribute(key,value){this.attributes[key]=value;},focus(){this.focusCount++;}};
    editor.querySelector=()=>editor.summary;
    return editor;
  });
  setupJourneyDisclosures({querySelectorAll:()=>editors},{document:doc});
  function dispatch(target,type,path=[],properties={}) {
    const event=new Event(type,{cancelable:true});
    Object.assign(event,{composedPath:()=>path},properties);
    target.dispatchEvent(event);return event;
  }
  return {doc,editors,dispatch};
}
test('clicking the scenery outside the form dismisses the editor, while choosing inside stays open',()=>{
  const {doc,editors:[destination],dispatch}=fixture();
  destination.open=true;
  dispatch(doc,'pointerdown',[{},destination]);
  assert.equal(destination.open,true);
  dispatch(doc,'pointerdown',[{}]);
  assert.equal(destination.open,false);
  assert.equal(destination.summary.attributes['aria-expanded'],'false');
  assert.equal(destination.summary.focusCount,0,'outside clicks retain the clicked target focus');
});
test('Done and Escape dismiss the editor and return focus to its summary',()=>{
  const {doc,editors:[destination],dispatch}=fixture();
  destination.open=true;
  const click=new Event('click');Object.defineProperty(click,'target',{value:{closest:()=>({})}});
  destination.dispatchEvent(click);
  assert.equal(destination.open,false);assert.equal(destination.summary.focusCount,1);
  destination.open=true;
  const key=dispatch(doc,'keydown',[destination],{key:'Escape'});
  assert.equal(key.defaultPrevented,true);
  assert.equal(destination.open,false);assert.equal(destination.summary.focusCount,2);
});
test('a nested location dialog owns its outside clicks and Escape, and opening another editor dismisses the first',()=>{
  const {doc,editors:[destination,date],dispatch}=fixture();
  destination.open=true;doc.modal=true;
  dispatch(doc,'pointerdown',[{}]);
  const key=dispatch(doc,'keydown',[],{key:'Escape'});
  assert.equal(destination.open,true);assert.equal(key.defaultPrevented,false);
  doc.modal=false;date.open=true;dispatch(date,'toggle');
  assert.equal(destination.open,false);assert.equal(date.open,true);
  assert.equal(date.summary.attributes['aria-expanded'],'true');
});
