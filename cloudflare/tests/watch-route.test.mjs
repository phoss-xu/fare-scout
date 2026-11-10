import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const bundled=await build({entryPoints:['cloudflare/src/provider.js'],bundle:true,format:'esm',platform:'browser',write:false});
const provider=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const out=await build({entryPoints:['cloudflare/src/domain.js'],bundle:true,format:'esm',platform:'browser',write:false});
const domain=await import('data:text/javascript;base64,'+Buffer.from(out.outputFiles[0].text).toString('base64'));
const start=domain.plusDays(domain.today(),20),end=domain.plusDays(start,3);
const input={origin:'airport:HKG',destinations:['airport:NRT'],start,end,mode:'fixed',return_route:{from:'HND',to:'HKG'}};
test('different return airport persists, queries city scope, and strictly matches all four airports',()=>{
 const c=domain.validate(input),j=domain.jobs(c)[0],args=provider.argumentsFor(c,j,false);
 assert.equal(c.return_route.from,'HND');assert.equal(args.flyFrom,'HKG');assert.equal(args.flyTo,'TYO');assert.equal(args.one_for_city,false);
 const leg=(from,to,date)=>({from,to,departureTime:date+'T10:00:00',arrivalTime:date+'T14:00:00',stops:0,durationSeconds:14400});
 const offer={price:1000,outbound:leg('HKG','NRT',start),inbound:leg('HND','HKG',end)};
 assert.equal(domain.matches(offer,c,j),true);
 assert.equal(domain.matches({...offer,inbound:leg('NRT','HKG',end)},c,j),false);
 const old=domain.validate({...input,return_route:undefined});assert.equal(domain.matches(offer,old,j),false);
 assert.throws(()=>domain.validate({...input,trip_type:'oneway'}));
});
