import {test} from 'node:test';
import assert from 'node:assert/strict';
import {visibilityPoll} from '../app/static/polling.js';
function clock(task) {
  let listener,id=0;const pending=new Map();
  const doc={hidden:false,addEventListener(_,fn){listener=fn;},removeEventListener(){listener=null;}};
  const poll=visibilityPoll(task,{document:doc,delay:()=>30000,setTimer(fn,ms){pending.set(++id,{fn,ms});return id;},clearTimer(id){pending.delete(id);}});
  return {poll,doc,pending,visibility(hidden){doc.hidden=hidden;listener?.();}};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('idle refresh waits 30 seconds; hidden pages stop and resume with one immediate refresh',async()=>{
  let calls=0;const c=clock(async()=>{calls++;});c.poll.start();await tick();
  assert.equal(calls,1);assert.equal([...c.pending.values()][0].ms,30000);
  c.visibility(true);assert.equal(c.pending.size,0);c.visibility(false);await tick();assert.equal(calls,2);
  c.poll.stop();assert.equal(c.pending.size,0);c.visibility(false);await tick();assert.equal(calls,2);c.poll.dispose();
});
test('visibility changes and restarts never overlap an in-flight request or resurrect logout polling',async()=>{
  let release,calls=0;const c=clock(()=>{calls++;return new Promise(r=>release=r);});
  c.poll.start();c.visibility(true);c.visibility(false);c.poll.start();assert.equal(calls,1);
  c.poll.stop();release();await tick();assert.equal(c.pending.size,0);
  c.poll.start();assert.equal(calls,2);release();await tick();assert.equal(c.pending.size,1);c.poll.dispose();
});
