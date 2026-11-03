import {removedOffers} from './observation-history.js';
import {alertPage} from './alert-pages.js';
import {cleanSourceCache} from './source-cache.js';
import * as trips from './trips.js';
import * as searchPresets from './search-presets.js';
import {ApiError,ensure,report} from './db.js';
import {adminApi,requireAdmin} from './admin.js';
import {trackScheduled} from './runtime-health.js';
import {json,data,asset} from './http.js';
import {current,requireUser,authenticate} from './auth.js';
import {passkeyAuth} from './passkeys.js';
import * as store from './store.js';
import * as locations from './locations.js';
import {recent,remember} from './history.js';
import {validate,jobs,today} from './domain.js';
import {enqueueWatch,enqueueDeal,dealResult,schedule} from './runs.js';
import {drain} from './tasks.js';
import {deliver,mailStatus} from './mail.js';
import {verifyAction} from './email-verification.js';
import {confirmConsent} from './email-consent.js';
import {saveDaily,dailyState,dailyTick} from './daily.js';
import {deliverDaily} from './daily-mail.js';
const AUTH=new Set(['/api/auth/register','/api/auth/login','/api/auth/activate','/api/auth/logout']);
async function background(env,runId) { await drain(env,4,runId); }
function continueWork(ctx,env,runId=null) {
  ctx.waitUntil(background(env,runId).catch(error=>{report(error,'Background processing failed');throw new Error('Background processing failed');}));
}
async function api(request,env,ctx) {
  const url=new URL(request.url),path=url.pathname,db=env.DB;
  if(path==='/api/admin' || path.startsWith('/api/admin/')) return adminApi(request,env);
  if(request.method==='GET') {
    if(path==='/api/auth/session') return json({...await current(request,db)||{user:null},auth_mode:env.AUTH_MODE||'password'});
    if(path.startsWith('/api/shared-trips/')) return json(await trips.shared(db,path.slice('/api/shared-trips/'.length)));
    const user=await requireUser(request,db);
    if(path==='/api/trips') return json(await trips.listed(db,user.id));
    if(path==='/api/removed-offers') return json(await removedOffers(db,user.id,url.searchParams.get('before')));
    if(path==='/api/alerts') return json(await alertPage(db,user.id,url.searchParams.get('before')));
    if(path==='/api/state') return json(await store.state(env,user));
    const history=/^\/api\/watches\/(\d+)\/history$/.exec(path);
    if(history) return json(await store.history(db,Number(history[1]),user.id,url.searchParams.get('before')));
    if(path==='/api/daily') return json(await dailyState(db,user.id));
    if(path==='/api/search-presets') return json(await searchPresets.listed(db,user.id));
    if(path==='/api/location-history') return json(await recent(db,user.id));
    if(path==='/api/locations') {
      const q=url.searchParams;
      if(q.has('groups')) return json({groups:locations.menu()});
      if(q.has('group')) return json(locations.group(q.get('group')));
      if(q.has('id')) return json({location:locations.resolve(q.get('id'))});
      return json({locations:locations.search(q.get('q')||'',q.get('kind')||'')});
    }
    if(/^\/api\/deals\/[^/]+$/.test(path)) { const result=await dealResult(db,path.split('/')[3],user.id);if(result.status==='running') continueWork(ctx,env,result.id);return json(result); }
  } else if(request.method==='POST') {
    const body=await data(request);
    if(path.startsWith('/api/auth/passkey/')) { const auth=await passkeyAuth(request,env,path,body);return json(auth.body,200,auth.cookie); }
    if(AUTH.has(path)) { const auth=await authenticate(request,env,path,body);return json(auth.body,200,auth.cookie); }
    const user=await requireUser(request,db,true);
    if(path==='/api/trips') return json(body.action==='remove'?await trips.remove(db,user.id,body.key):await trips.save(db,user.id,body));
    if(path==='/api/shared-trips') return json(await trips.share(db,user.id,body),201);
    if(path==='/api/search-presets') return json(body.action==='remove'?await searchPresets.remove(db,user.id,body.id):await searchPresets.save(db,user.id,body));
    if(path==='/api/location-history') return json(await remember(db,user.id,body));
    if(path==='/api/daily') { await saveDaily(db,user.id,body);return json({message:'每日推荐设置已保存。'}); }
    if(path==='/api/deals') {
      ensure(env.QUERY_ENABLED==='true','当前环境尚未开启真实查价，请联系服务管理员。',503);
      const id=await enqueueDeal(db,validate(body,true),user.id);continueWork(ctx,env,id);return json({id},202);
    }
    if(path==='/api/watches') {
      const c=validate(body),id=await store.create(db,c,user.id);
      if(c.auto_enabled && env.QUERY_ENABLED==='true') { const runId=await enqueueWatch(db,id,true);continueWork(ctx,env,runId); }
      return json({id},201);
    }
    if(path==='/api/alerts/read') { await store.markRead(db,user.id,body.through_id);return json({message:'提醒已标为已读。'}); }
    if(path==='/api/email/verify' || path==='/api/email/check') {
      await verifyAction(env,user.id,path.endsWith('/check')?'check':'start');
      return json({email:await mailStatus(env,user.notification_email,user.id)});
    }
    if(path==='/api/email/confirm') {await confirmConsent(env,user.id,body.token);return json({message:'已确认接收机票提醒。'});}
    if(path==='/api/email') { await store.recipient(db,user.id,body.recipient);return json({message:'收件邮箱已保存。'}); }
    const match=/^\/api\/(watches|offers)\/(\d+)\/(delete|restore|settings|check)$/.exec(path);
    if(match) {
      const [,kind,rawId,action]=match,id=Number(rawId);
      ensure(Number.isSafeInteger(id),'记录不存在。',404);
      if(['delete','restore'].includes(action)) { await store.remove(db,kind,id,user.id,action==='restore');return json({message:action==='restore'?'已恢复。':'已删除，可在最近删除中恢复。'}); }
      ensure(kind==='watches','操作不存在。',404);
      if(action==='settings') { await store.settings(db,id,user.id,body);return json({message:'自动查价与提醒设置已保存。'}); }
      const w=await store.watch(db,id,user.id);ensure(w,'这条监控不存在。',404);
      ensure(jobs(w).some(j=>j.departure>=today()),'这条监控的出行日期已过，请新建监控。');
      ensure(env.QUERY_ENABLED==='true','当前环境尚未开启真实查价，请联系服务管理员。',503);
      ensure(await enqueueWatch(db,id),'这条监控正在查询，请稍候。',409);
      continueWork(ctx,env);return json({message:'已加入查价队列。'},202);
    }
  } else return json({error:'不支持的请求方式。'},405);
  throw new ApiError('操作不存在。',404);
}
export default {
  async fetch(request,env,ctx) {
    try {
      const path=new URL(request.url).pathname;
      if(path==='/admin' || path==='/admin/' || path==='/admin.html') {
        await requireAdmin(request,env);
        ensure(request.method==='GET','管理后台仅支持只读查询。',405);
        // Assets canonicalizes admin.html to /admin; fetch the canonical path to avoid redirects.
        const url=new URL(request.url);url.pathname='/admin';
        const response=await asset(new Request(url,request),env);
        const headers=new Headers(response.headers);headers.set('Cache-Control','no-store');
        return new Response(response.body,{status:response.status,headers});
      }
      return path.startsWith('/api/')?await api(request,env,ctx):await asset(request,env);
    }
    catch(error) {
      if(error instanceof ApiError) return json({error:error.message},error.status);
      report(error,'API failed');
      return json({error:'暂时无法完成操作，请稍后重试。'},500);
    }
  },
  async scheduled(controller,env,ctx) {
    return trackScheduled(env,async()=>{
      await cleanSourceCache(env.DB);
      await schedule(env.DB,env.QUERY_ENABLED==='true');
      await dailyTick(env);
      // Bounded network work, with pending and retry tasks left durably for the next trigger.
      await drain(env,2);
      await dailyTick(env);
      await deliver(env);
      await deliverDaily(env);
    });
  }
};
