const DAY=86400000;
export const cutoff = at => new Date(Date.parse(at)-90*DAY).toISOString();
const stable=value=>Array.isArray(value)?value.map(stable):value && typeof value==='object'?
  Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])])):value;
export function priceIdentity(c,o) {
  const leg=l=>l?[l.from,l.to,l.departureTime.slice(0,10),l.stops ?? null]:null;
  // Budget, locale, flight numbers and discovery scope do not change comparable fare conditions.
  return JSON.stringify(stable({version:1,source:'Kiwi',outbound:leg(o.outbound),inbound:leg(o.inbound),
    adults:c.adults || 1,cabin:c.cabin || 'M',currency:o.currency || c.currency || 'HKD',
    baggage:o.baggage ?? null,max_stops:c.max_stops ?? -1,max_duration_hours:c.max_duration_hours || 0,
    time_windows:c.time_windows || null,weekend:c.mode==='weekend' || !!(c.daily && o.travel?.red_eye)}));
}
export async function seriesId(identity) {
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(identity));
  return [...new Uint8Array(bytes)].map(n=>n.toString(16).padStart(2,'0')).join('');
}
export function summarize(points,firstAt,current,at) {
  const values=points.map(p=>p.price).sort((a,b)=>a-b),n=values.length;
  if(!n)return null;
  const median=n%2?values[(n-1)/2]:(values[n/2-1]+values[n/2])/2;
  const difference=(current/median-1)*100;
  return {sampled_days:n,coverage_days:Math.min(90,Math.max(1,Math.floor((Date.parse(at)-Date.parse(firstAt))/DAY)+1)),
    full_window:Date.parse(at)-Date.parse(firstAt)>=90*DAY,first_at:firstAt,last_at:points.at(-1).last_at,
    minimum:values[0],maximum:Math.max(...points.map(p=>p.maximum_price ?? p.price)),median,mean:values.reduce((a,b)=>a+b,0)/n,
    difference_percent:difference,level:n<7?'collecting':current<=median*.9?'low':current>=median*1.1?'high':'typical',
    lowest:n>=2 && current<=values[0]};
}
