import {getPreferences} from './preferences.js';
let names={},pending;
export function loadLocationNames() {
  if(!pending) pending=fetch('/location-names.json').then(async response=>{
    if(!response.ok) throw new Error(`Location names HTTP ${response.status}`);
    names=await response.json();
    document.dispatchEvent(new Event('locationnameschange'));
  }).catch(error=>{pending=undefined;console.info('Localized location names unavailable',error.message);});
  return pending;
}
export function locationName(code,kind='city',fallback='') {
  const row=names[code],english=getPreferences().language==='en';
  return row?.[(kind==='airport'?2:0)+(english?1:0)] || fallback || code;
}

const carriers={UO:'香港快运',HX:'香港航空',CX:'国泰航空',CA:'中国国际航空',MU:'中国东方航空',CZ:'中国南方航空',ZH:'深圳航空',HU:'海南航空',MF:'厦门航空',SC:'山东航空','3U':'四川航空','9C':'春秋航空',VJ:'越捷航空',VN:'越南航空',SQ:'新加坡航空',TR:'酷航',AK:'亚洲航空',FD:'泰国亚洲航空',TG:'泰国国际航空',NH:'全日空',JL:'日本航空',KE:'大韩航空',OZ:'韩亚航空',TW:'德威航空','7C':'济州航空',LJ:'真航空'};
export function carrierLabel(segment) {
  return (getPreferences().language==='zh-CN' && carriers[segment.carrier]) || segment.carrierName || segment.carrier;
}
