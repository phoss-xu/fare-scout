import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {readFile,readdir,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
export async function harness(options={}) {
  const dir=await mkdtemp(path.join(tmpdir(),'fare-worker-test-'));
  const result=await build({entryPoints:['cloudflare/src/index.js'],bundle:true,format:'esm',platform:'browser',write:false});
  const converted=convertV4MiniflareOptions({name:'fare-scout',modules:true,script:result.outputFiles[0].text,compatibilityDate:'2026-11-02',compatibilityFlags:['nodejs_compat'],
    d1Databases:['DB'],d1Persist:options.persist || path.join(dir,'d1'),
    assets:{directory:path.resolve('app/static'),binding:'ASSETS',run_worker_first:["/api/*","/setup"],routerConfig:{has_user_worker:true}},
    bindings:{QUERY_ENABLED:'false',MAIL_ENABLED:'false',...options.bindings},
    ...(options.mockEmail?{serviceBindings:{EMAIL:'email-capture'}}:{}),
    outboundService:options.outbound || (()=>{throw new Error('Unexpected external request in local test');})});
  if(options.nativeEmail) converted.workers[0].config.env.EMAIL={type:'send-email'};
  const capture=convertV4MiniflareOptions({name:'email-capture',modules:true,compatibilityDate:'2026-11-02',
    script:`import {WorkerEntrypoint} from 'cloudflare:workers';
      export default class extends WorkerEntrypoint {
        async send(message) {
          const r=await fetch('https://email-capture.test/send',{method:'POST',body:JSON.stringify(message)});
          if(!r.ok) throw new Error('simulated_email_failure');return r.json();
        }
      }`,outboundService:options.outbound}).workers[0];
  const mf=new Miniflare({...(options.mockEmail?{...converted,workers:[...converted.workers,capture]}:converted),resourcePersistencePath:options.persist || path.join(dir,'resources')});
  try {
  const db=await mf.getD1Database('DB');
  if(!options.skipMigrations) for(const name of (await readdir('cloudflare/migrations')).sort()) {
    if(options.beforeMigration && name>=options.beforeMigration) continue;
    const sql=await readFile('cloudflare/migrations/'+name,'utf8');
    // SQLite trigger bodies contain semicolons; prepare each entire trigger as a statement.
    const triggers=[];
    const simple=sql.replace(/^--.*$/gm,'').replace(/CREATE TRIGGER[\s\S]*?\nEND;/g,body=>{triggers.push(body);return '';});
    const statements=[...simple.split(';').map(s=>s.trim()).filter(Boolean),...triggers];
    for(const statement of statements) await db.prepare(statement).run();
  }
  return {mf,db,async close(){await mf.dispose();await rm(dir,{recursive:true,force:true});}};
  } catch(error) { await mf.dispose();await rm(dir,{recursive:true,force:true});throw error; }
}
export async function request(h,path,body,session={},extra={}) {
  const headers={'CF-Connecting-IP':session.ip||'127.0.0.1',...extra};
  if(session.cookie) headers.Cookie=session.cookie;
  if(session.csrf) headers['X-CSRF-Token']=session.csrf;
  if(body!==undefined) headers['Content-Type']='application/json';
  const response=await h.mf.dispatchFetch('http://localhost'+path,{method:body===undefined?'GET':'POST',headers,body:body===undefined?undefined:JSON.stringify(body)});
  const text=await response.text();let data;try{data=JSON.parse(text);}catch{data=text;}
  if(response.headers.get('Set-Cookie')) {
    const value=response.headers.get('Set-Cookie').split(';')[0],key=value.split('=')[0];
    const parts=(session.cookie||'').split('; ').filter(p=>p && p.split('=')[0]!==key);
    if(value.split('=')[1]) parts.push(value);session.cookie=parts.join('; ');
  }
  if(data?.csrf_token) session.csrf=data.csrf_token;
  return {status:response.status,data,response};
}
export async function register(h,email='qa@example.test') {
  const session={ip:email};
  const result=await request(h,'/api/auth/register',{email,password:'local-test-password',name:'本地验收'},session);
  if(result.status!==200) throw new Error(JSON.stringify(result));
  return session;
}
