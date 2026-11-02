// Opt-in remote protocol acceptance with a temporary synthetic account; no actual user's credentials.
import assert from 'node:assert/strict';
import {randomBytes,createHash} from 'node:crypto';
import {writeFile,mkdir} from 'node:fs/promises';
import {authenticator} from './passkey-fixtures.mjs';
import {future} from './fixtures.mjs';
assert.equal(process.env.FARE_REMOTE_ACCEPTANCE,'1','Explicit opt-in required.');
const origin='https://fare-scout.phosssuki.workers.dev';
const address='passkey-qa-'+randomBytes(8).toString('hex')+'@example.invalid';
let cookie='',csrf,userId;
async function call(path,body,extra={}) {
 const headers={Origin:origin,...extra};if(cookie) headers.Cookie=cookie;if(csrf) headers['X-CSRF-Token']=csrf;
 if(body!==undefined) headers['Content-Type']='application/json';
 const response=await fetch(origin+path,{method:body===undefined?'GET':'POST',headers,body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
 const set=response.headers.get('Set-Cookie');
 if(set) {const pair=set.split(';')[0],name=pair.split('=')[0],parts=cookie.split('; ').filter(p=>p&&p.split('=')[0]!==name);if(pair.split('=')[1])parts.push(pair);cookie=parts.join('; ');}
 const text=await response.text();let data;try{data=JSON.parse(text);}catch{data={error:text.slice(0,160)};}
 if(data.csrf_token) csrf=data.csrf_token;
 return {status:response.status,data};
}
try {
 assert.equal((await call('/api/state')).status,401);
 const key=authenticator(),o=await call('/api/auth/passkey/register/options',{email:address,name:'临时协议验收'});
 assert.equal(o.status,200,JSON.stringify(o.data));
 const registered=await call('/api/auth/passkey/register/verify',{response:key.register(o.data.options,{origin})});
 assert.equal(registered.status,200,JSON.stringify(registered.data));userId=registered.data.user.id;
 assert.equal((await call('/api/state')).status,200);
 const places=await call('/api/locations?q='+encodeURIComponent('香港'));
 assert.equal(places.status,200,JSON.stringify(places.data));assert.ok(places.data.locations.some(r=>r.id==='airport:HKG'));
 await call('/api/auth/logout',{});assert.equal((await call('/api/state')).status,401);
 const login=await call('/api/auth/passkey/login/options',{});
 assert.equal(login.status,200,JSON.stringify(login.data));
 const signed=key.login(login.data.options,{origin});
 assert.equal((await call('/api/auth/passkey/login/verify',{response:signed})).status,200);
 assert.equal((await call('/api/auth/passkey/login/verify',{response:signed})).status,400);
 const s=await call('/api/state');assert.equal(s.status,200);assert.equal(s.data.user.id,userId);
 const task=await call('/api/deals',{origins:['airport:HKG'],destinations:['airport:SIN'],start:future(20),end:future(23),adults:1,budget:0,min_nights:2,max_nights:5,weekdays:[]});
 assert.equal(task.status,202,JSON.stringify(task.data));let result;
 const deadline=Date.now()+110000;
 while(Date.now()<deadline) {const r=await call('/api/deals/'+task.data.id);assert.equal(r.status,200,JSON.stringify(r.data));result=r.data;if(result.status!=='running')break;await new Promise(r=>setTimeout(r,1500));}
 assert.equal(result.status,'done',JSON.stringify({status:result.status,failures:result.failures}));
 console.log(JSON.stringify({passkeyRegistration:'ok',passkeySignatureLogin:'ok',replayRejected:true,protectedApi:'ok',locationSearch:'ok',source:{status:result.status,completed:result.completed,failures:result.failures,offers:result.offers.length},temporaryUserId:userId}));
} finally {
 // Use an exact synthetic email AND matching user ID; never targets a real account or prior data.
 await mkdir('.wrangler',{recursive:true});
 const q=value=>"'"+String(value).replaceAll("'","''")+"'";
 const owner=`SELECT id FROM users WHERE email=${q(address)}${Number.isSafeInteger(userId)?' AND id='+userId:''}`;
 const limit=createHash('sha256').update('account:'+address).digest('hex');
 const sql=[`DELETE FROM sessions WHERE user_id IN (${owner})`,`DELETE FROM search_tasks WHERE run_id IN (SELECT id FROM search_runs WHERE owner_id IN (${owner}))`,`DELETE FROM search_runs WHERE owner_id IN (${owner})`,`DELETE FROM passkeys WHERE user_id IN (${owner})`,`DELETE FROM passkey_challenges WHERE email=${q(address)}`,`DELETE FROM auth_limits WHERE key=${q(limit)}`,`DELETE FROM users WHERE id IN (${owner})`].join(';\n')+';\n';
 await writeFile('.wrangler/remote-qa-cleanup.sql',sql,{mode:0o600});
}
