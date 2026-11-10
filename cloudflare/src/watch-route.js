import {ensure} from './db.js';
import {resolve} from './locations.js';
function scope(a,b) {
  if(a.id===b.id) return a.id;
  if(a.city_code && a.city_code===b.city_code) return resolve('city:'+a.city_code).id;
  ensure(a.country_code && a.country_code===b.country_code,'当前查价源暂不支持跨国家的不同机场往返提醒。');
  return resolve('country:'+a.country_code).id;
}
export function returnRoute(data,config) {
  if(data.return_route===undefined) return null;
  ensure(config.mode==='fixed' && config.trip_type!=='oneway' && config.origin_locations.length===1 && config.destination_locations.length===1,'不同返程机场的提醒请选择一组机场与固定日期。');
  const o=config.origin_locations[0],d=config.destination_locations[0],r=data.return_route;
  ensure(r && typeof r==='object' && typeof r.from==='string' && typeof r.to==='string','请检查返程机场。');
  const from=resolve('airport:'+r.from),to=resolve('airport:'+r.to);
  ensure(o.kind==='airport' && d.kind==='airport' && from.kind==='airport' && to.kind==='airport' && from.id!==to.id,'请检查往返机场。');
  return {from:from.code,to:to.code,query_from:scope(o,to),query_to:scope(d,from)};
}
