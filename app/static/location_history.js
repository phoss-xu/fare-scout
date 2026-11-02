import {request} from './api.js';
let generation=0, active=false, data={origin:[],destination:[]}, status='', queue=Promise.resolve();
const listeners=new Set();
const publish=()=>listeners.forEach(listener=>listener(data,status));
export function subscribeHistory(listener){listeners.add(listener);listener(data,status);}
export function resetHistory(user){
  const current=++generation;
  active=Boolean(user);data={origin:[],destination:[]};status='';publish();
  queue=active?load(current):Promise.resolve();
}
async function load(current){
  try{
    const result=await request('/api/location-history');
    if(current===generation){data=result;status='';publish();}
  }catch(error){if(current===generation){status='最近选择加载失败';publish();}}
}
export function rememberLocation(role,row){
  if(!active) return;
  const current=generation;
  // Serialize writes so rapid choices retain their actual selection order.
  queue=queue.then(async()=>{
    if(current!==generation) return;
    try{
      const result=await request('/api/location-history',{role,id:row.id});
      if(current===generation){data=result;status='';publish();}
    }catch(error){if(current===generation){status='最近选择未保存';publish();}}
  });
}
