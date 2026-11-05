import {comparisonRequest,routeDetailSearch} from './route-detail-search.js';
import {dateWindow,queryPair} from './route-date-strip.js';

export function nearbyPairs(offer,today) {
  const outDate=offer.outbound.departureTime.slice(0,10),inDate=offer.inbound?.departureTime.slice(0,10);
  const pairs=dateWindow(outDate).filter(day=>day>=today).flatMap(out=>inDate?
    dateWindow(inDate).filter(day=>day>=today && day>=out).map(day=>({outDate:out,inDate:day})):[{outDate:out,inDate:''}]);
  // Populate the selected pair and the two currently visible price rails first.
  const rank=p=>Number(p.outDate!==outDate)+Number(!!inDate && p.inDate!==inDate);
  return pairs.sort((a,b)=>rank(a)-rank(b));
}

/** Reuse the single active discovery run allowed per account. */
export function routeDetailPrefetch({result,progress,createSearch=routeDetailSearch,now=Date.now,setTimer=setTimeout,clearTimer=clearTimeout}) {
  const cache=new Map(),tasks=new Map(),queue=[];
  let offer,context,retryTimer,completed=0,failed=0;
  const emit=()=>progress({completed,total:tasks.size,failed,failedPairs:Object.fromEntries([...tasks.values()].filter(t=>t.status==='error').map(t=>[queryPair(t.filters),true])),pendingPairs:Object.fromEntries([...tasks.values()].filter(t=>t.status==='pending').map(t=>[queryPair(t.filters),true]))});
  const lanes=Array.from({length:1},()=>{
    const lane={task:null};
    function finish(data,error) {
      const task=lane.task;if(!task)return;
      lane.task=null;
      if(error?.status===409 && task.retries++<30){
        queue.unshift(task);retryTimer=setTimer(()=>{retryTimer=undefined;pump();},1000);return;
      }
      task.status=error?'error':'done';completed++;if(error)failed++;
      if(data){
        cache.set(task.key,{at:now(),data});
        while(cache.size>100)cache.delete(cache.keys().next().value);
        result(data,task.filters);
      }
      emit();pump();
    }
    lane.search=createSearch({status(loading,message,error){if(!loading)finish(null,error || message);},done(data){finish(data);}});
    return lane;
  });
  function pump() {
    if(retryTimer!==undefined)return;
    for(const lane of lanes) {
      if(lane.task || !queue.length)continue;
      lane.task=queue.shift();void lane.search.start(offer,context,lane.task.filters);
    }
  }
  function add(filters,force=false) {
    const key=JSON.stringify(comparisonRequest(offer,context,filters));
    const existing=tasks.get(key);
    if(existing?.status==='pending') {
      const index=queue.indexOf(existing);if(index>=0){queue.splice(index,1);queue.unshift(existing);}
      return;
    }
    if(existing?.status==='done' && !force)return;
    if(existing){tasks.delete(key);completed--;if(existing.status==='error')failed--;}
    const task={key,filters:{outDate:filters.outDate,inDate:filters.inDate || ''},status:'pending',retries:0};
    tasks.set(key,task);
    const saved=cache.get(key);
    if(!force && saved && now()-saved.at<300000){task.status='done';completed++;result(saved.data,task.filters);}
    else queue.push(task);
  }
  function cancel() {
    clearTimer(retryTimer);retryTimer=undefined;
    for(const lane of lanes){lane.task=null;lane.search.cancel();}
    queue.length=0;tasks.clear();completed=failed=0;
  }
  return {cancel,clear(){cancel();cache.clear();},start(selected,c,today){
    cancel();offer=selected;context=c;
    for(const pair of nearbyPairs(offer,today))add(pair);
    emit();pump();
  },ensure(filters,force=false){add(filters,force);emit();pump();}};
}
