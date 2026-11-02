// Explicit opt-in smoke check. No real account, production database or mail is used.
import assert from 'node:assert/strict';
import {harness,register,request} from './harness.mjs';
import {config,waitFor} from './fixtures.mjs';
assert.equal(process.env.FARE_LIVE_KIWI,'1','Set FARE_LIVE_KIWI=1 to intentionally query Kiwi.');
const h=await harness({bindings:{QUERY_ENABLED:'true'},outbound:async request=>{
  assert.equal(new URL(request.url).hostname,'mcp.kiwi.com');
  return fetch(request.url,{method:request.method,headers:Object.fromEntries(request.headers),body:await request.text(),signal:AbortSignal.timeout(24000)});
}});
try {
  const session=await register(h,'source-check@example.test');
  const r=await request(h,'/api/deals',config({budget:0,min_nights:2,max_nights:5,weekdays:[]}),session);
  assert.equal(r.status,202);
  const deadline=Date.now()+100000;let result;
  while(Date.now()<deadline) {
    result=(await request(h,'/api/deals/'+r.data.id,undefined,session)).data;
    if(result.status!=='running') break;
    await new Promise(r=>setTimeout(r,1000));
  }
  console.log(JSON.stringify({status:result.status,total:result.total,completed:result.completed,failures:result.failures,offers:result.offers.length,checked_at:result.checked_at}));
  assert.equal(result.status,'done','Real upstream lookup failed; see task diagnostic category.');
} finally { await h.close(); }
