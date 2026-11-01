import test from 'node:test';
import assert from 'node:assert/strict';
import {resetHistory,rememberLocation,subscribeHistory} from '../app/static/location_history.js';

test('account switch discards an older response and its queued selections',async()=>{
  const original=globalThis.fetch, calls=[];
  globalThis.fetch=(path,options)=>new Promise(resolve=>calls.push({path,options,resolve}));
  let visible;
  subscribeHistory(data=>{visible=data;});
  try{
    resetHistory({id:1});
    rememberLocation('origin',{id:'city:TYO'});
    resetHistory({id:2});
    assert.deepEqual(visible,{origin:[],destination:[]});
    const respond=(call,data)=>call.resolve({ok:true,json:async()=>data});
    const own={origin:[{id:'city:LON'}],destination:[]};
    respond(calls[1],own);
    await new Promise(setImmediate);
    respond(calls[0],{origin:[{id:'city:TYO'}],destination:[]});
    await new Promise(setImmediate);
    assert.deepEqual(visible,own);
    assert.equal(calls.length,2,'queued choices must not be sent using the next account session');
    resetHistory(null);
    assert.deepEqual(visible,{origin:[],destination:[]});
  }finally{globalThis.fetch=original;}
});
