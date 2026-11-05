import {request} from './api.js';
import {visibilityPoll} from './polling.js';
import {getPreferences} from './preferences.js';
import {tr} from './i18n.js';

export function comparisonRequest(offer,context,filters={}) {
  return {comparison:true,date_mode:'fixed',trip_type:offer.inbound?'roundtrip':'oneway',
    origins:['airport:'+offer.outbound.from],destinations:['airport:'+offer.outbound.to],
    start:filters.outDate || offer.outbound.departureTime.slice(0,10),end:offer.inbound?(filters.inDate || offer.inbound.departureTime.slice(0,10)):(filters.outDate || offer.outbound.departureTime.slice(0,10)),
    adults:context.adults || 1,currency:offer.currency || context.currency || 'HKD',locale:getPreferences().language,
    max_stops:context.max_stops ?? -1,max_duration_hours:context.max_duration_hours || 0,budget:0,nights:[],weekdays:[]};
}
export function routeDetailSearch({status,done}) {
  let generation=0,job;
  const poller=visibilityPoll(async()=>{
    if(!job)return;const {id,version,filters:jobFilters}=job;
    try {
      const result=await request('/api/deals/'+encodeURIComponent(id));
      if(version!==generation)return;
      if(result.status==='running')return;
      poller.stop();job=undefined;
      if(result.status==='error' || result.failures)throw new Error(tr('这次航线查询失败，原有报价仍保留，请重试。','Route search failed. Previous quotes are retained; try again.'));
      done(result,jobFilters);
    } catch(error){if(version===generation){poller.stop();job=undefined;status(false,error.message,error);}}
  },{delay:()=>1500});
  function cancel(){generation++;job=undefined;poller.stop();}
  return {cancel,async start(offer,context,filters={}) {
    cancel();const version=generation;
    status(true,tr('正在查询这条航线，价格可能较上次变化。','Searching this route. Prices may have changed.'));
    try {
      const result=await request('/api/deals',comparisonRequest(offer,context,filters));
      if(version!==generation)return;
      job={id:result.id,version,filters:{...filters}};poller.start();
    } catch(error){if(version===generation)status(false,error.message,error);}
  }};
}
