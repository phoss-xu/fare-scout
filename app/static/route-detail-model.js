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
export function routeOptions(offers,{date='',onlyDirect=false,sort='price',outDate='',inDate='',outFrom='',outTo='',inFrom='',inTo=''}={}) {
  return offers.filter(o=>(!date || datePair(o)===date) && (!onlyDirect || direct(o)) && matches(o.outbound,outDate,outFrom,outTo) && (!o.inbound || matches(o.inbound,inDate,inFrom,inTo))).slice().sort((a,b)=>
    sort==='departure'?a.outbound.departureTime.localeCompare(b.outbound.departureTime) || a.price-b.price:
    sort==='duration'?totalDuration(a)-totalDuration(b) || a.price-b.price:a.price-b.price);
}

export function legIdentity(leg) {
  if(!leg)return '';
  return JSON.stringify([leg.from,leg.to,leg.departureTime,leg.arrivalTime,leg.stops,leg.durationSeconds,leg.cabinClass,
    (leg.segments || []).map(s=>[s.from,s.to,s.departureTime,s.arrivalTime,s.carrier,s.flightNumber,s.cabinClass])]);
}

export function outboundChoices(options) {
  const groups=new Map();
  for(const offer of options) {
    const key=legIdentity(offer.outbound),group=groups.get(key);
    if(group){group.offers.push(offer);if(offer.price<group.cheapest.price)group.cheapest=offer;}
    else groups.set(key,{key,cheapest:offer,offers:[offer]});
  }
  return [...groups.values()];
}

export function returnChoices(options,selected,sort='price') {
  return options.filter(o=>legIdentity(o.outbound)===legIdentity(selected.outbound)).sort((a,b)=>
    sort==='departure'?(a.inbound?.departureTime || '').localeCompare(b.inbound?.departureTime || '') || a.price-b.price:
    sort==='duration'?(a.inbound?.durationSeconds || 0)-(b.inbound?.durationSeconds || 0) || a.price-b.price:a.price-b.price);
}

export function selectOutbound(options,offer,previous) {
  const compatible=returnChoices(options,offer);
  return compatible.find(o=>legIdentity(o.inbound)===legIdentity(previous.inbound)) || compatible[0];
}

export function legDates(offers,state,returning=false) {
  const filters={...state,date:''};
  for(const suffix of ['Date','From','To'])filters[(returning?'in':'out')+suffix]='';
  const days=new Map();
  for(const offer of routeOptions(offers,filters)) {
    const day=(returning?offer.inbound:offer.outbound)?.departureTime.slice(0,10);
    if(day)days.set(day,Math.min(days.get(day) ?? Infinity,offer.price));
  }
  return [...days].sort(([a],[b])=>a.localeCompare(b));
}

function matches(leg,date,from,to) {
  const value=leg?.departureTime || '',clock=value.slice(11,16);
  const timeMatch=from && to && from>to ? clock>=from || clock<=to : (!from || clock>=from) && (!to || clock<=to);
  return (!date || value.slice(0,10)===date) && timeMatch;
}
