/** Compare complete source quotes only, keeping actual airports and currency together. */
export function routeOffers(selected, offers, currency='HKD') {
  return offers.filter(o=>o.outbound.from===selected.outbound.from && o.outbound.to===selected.outbound.to &&
    (o.currency || currency)===(selected.currency || currency) &&
    Boolean(o.inbound)===Boolean(selected.inbound) && (!o.inbound ||
      (o.inbound.from===selected.inbound.from && o.inbound.to===selected.inbound.to)));
}
export const datePair=o=>[o.outbound.departureTime.slice(0,10),o.inbound?.departureTime.slice(0,10)].filter(Boolean).join('/');
export const direct=o=>o.outbound.stops===0 && (!o.inbound || o.inbound.stops===0);
export const totalDuration=o=>(o.outbound.durationSeconds || 0)+(o.inbound?.durationSeconds || 0);
export function routeDates(offers) {
  const dates=new Map();
  for(const o of offers) {const key=datePair(o);dates.set(key,Math.min(dates.get(key) ?? Infinity,o.price));}
  return [...dates].sort(([a],[b])=>a.localeCompare(b));
}
export function routeOptions(offers,{date='',onlyDirect=false,sort='price'}={}) {
  return offers.filter(o=>(!date || datePair(o)===date) && (!onlyDirect || direct(o))).slice().sort((a,b)=>
    sort==='departure'?a.outbound.departureTime.localeCompare(b.outbound.departureTime) || a.price-b.price:
    sort==='duration'?totalDuration(a)-totalDuration(b) || a.price-b.price:a.price-b.price);
}
