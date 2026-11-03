// Read-only HTTP benchmark for an isolated local server with queries and email disabled.
// Usage: node scripts/benchmark_local.mjs http://localhost:8788 /tmp/fare-performance-session.json
import {readFile} from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
const origin=new URL(process.argv[2]||'http://localhost:8788');
if(!['localhost','127.0.0.1','[::1]'].includes(origin.hostname) || origin.protocol!=='http:') throw new Error('Local HTTP targets only');
const {cookie}=JSON.parse(await readFile(process.argv[3],'utf8'));
const headers={Cookie:cookie};
const stateResponse=await fetch(new URL('/api/state',origin),{headers});
if(!stateResponse.ok) throw new Error('An isolated QA session is required');
const state=await stateResponse.json();
if(state.query_enabled!==false || state.email.configured) throw new Error('Disable queries and email before benchmarking');
console.log(JSON.stringify({target:origin.origin,current_rows:state.observations.length,payload_bytes:Buffer.byteLength(JSON.stringify(state))}));
for(const concurrency of [1,10,50,100]) {
  const durations=[],statuses={},started=performance.now();let completed=0;
  await Promise.all(Array.from({length:concurrency},async()=>{
    for(;;) {
      const index=completed++;if(index>=100) return;
      const start=performance.now(),r=await fetch(new URL('/api/state',origin),{headers});
      await r.arrayBuffer();durations.push(performance.now()-start);statuses[r.status]=(statuses[r.status]||0)+1;
    }
  }));
  durations.sort((a,b)=>a-b);const elapsed=performance.now()-started;
  console.log(JSON.stringify({concurrency,requests:durations.length,statuses,p50_ms:Math.round(durations[49]),p95_ms:Math.round(durations[94]),elapsed_ms:Math.round(elapsed),requests_per_second:Math.round(100000/elapsed)}));
}
