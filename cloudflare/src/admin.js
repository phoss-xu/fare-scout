import {first,batch,ensure,now} from './db.js';
import {requireUser} from './auth.js';
import {json} from './http.js';
import {ready} from './mail.js';
import {adminUsers,adminTasks,adminMail} from './admin-pages.js';

export async function requireAdmin(request,env) {
  const user=await requireUser(request,env.DB);
  const ids=String(env.ADMIN_USER_IDS||'').split(',').map(x=>x.trim()).filter(x=>/^[1-9]\d*$/.test(x));
  ensure(ids.includes(String(user.id)),'当前账号没有管理后台访问权限。',403);
  return user;
}
async function overview(env) {
  const at=now(),since=new Date(Date.now()-86400000).toISOString();
  const queries=[
    ['SELECT COUNT(*) AS users FROM users',[]],
    ['SELECT COUNT(*) AS watches FROM watches WHERE deleted_at IS NULL',[]],
    [`SELECT t.status,COUNT(*) AS count FROM search_tasks t JOIN search_runs r ON r.id=t.run_id
      WHERE r.status='running' AND t.status IN ('pending','running') GROUP BY t.status`,[]],
    [`SELECT COUNT(*) AS expired_leases FROM search_tasks t JOIN search_runs r ON r.id=t.run_id
      WHERE r.status='running' AND t.status='running' AND t.lease_until<=?`,[at]],
    ['SELECT status,COUNT(*) AS count FROM observations WHERE checked_at>=? GROUP BY status',[since]],
    ['SELECT MAX(checked_at) AS checked_at FROM observations WHERE status=\'ok\'',[]],
    ["SELECT started_at,finished_at,status,duration_ms,error_code FROM runtime_heartbeats WHERE name='cron'",[]],
    [`SELECT status,SUM(count) AS count FROM (
      SELECT status,COUNT(*) AS count FROM email_outbox GROUP BY status UNION ALL
      SELECT mail_status AS status,COUNT(*) AS count FROM daily_editions GROUP BY mail_status
      ) GROUP BY status`,[]],
    ['SELECT MIN(checked_at) AS first_sample,MAX(checked_at) AS last_sample,COUNT(*) AS samples FROM observations',[]]
  ];
  const rows=(await batch(env.DB,queries)).map(r=>r.results);
  return {generated_at:at,window_start:since,users:rows[0][0].users,watches:rows[1][0].watches,
    queue:rows[2],expired_leases:rows[3][0].expired_leases,observations_24h:rows[4],
    last_success:rows[5][0].checked_at,heartbeat:rows[6][0]||null,mail:rows[7],sampling:rows[8][0],
    query_enabled:env.QUERY_ENABLED==='true',mail_enabled:env.MAIL_ENABLED==='true',mail_ready:ready(env),
    note:'采样按报价记录计数，不等于请求次数；任务列表受清理策略影响。邮件已发送表示供应商接受，不代表收件箱送达。'};
}
export async function adminApi(request,env) {
  await requireAdmin(request,env);
  ensure(request.method==='GET','管理后台仅支持只读查询。',405);
  const url=new URL(request.url),path=url.pathname;
  if(path==='/api/admin/overview') return json(await overview(env));
  if(path==='/api/admin/users') return json(await adminUsers(env,url.searchParams));
  if(path==='/api/admin/tasks') return json(await adminTasks(env.DB,url.searchParams));
  if(path==='/api/admin/mail') return json(await adminMail(env.DB,url.searchParams));
  if(path.startsWith('/api/admin/tasks/')) {
    const id=path.slice('/api/admin/tasks/'.length);
    ensure(id.length<=128,'任务编号无效。');
    const task=await first(env.DB,`SELECT t.id,t.run_id,r.owner_id,r.kind,r.created_at,r.finished_at,
      r.watch_id,r.status AS run_status,t.status,t.attempts,t.available_at,t.lease_until,t.error_code,
      t.job,t.source_checked_at,t.cache_hit,json_array_length(t.offers) AS offer_count
      FROM search_tasks t JOIN search_runs r ON r.id=t.run_id WHERE t.id=?`,[id]);
    ensure(task,'任务不存在，或已按保留策略清理。',404);
    // job contains query scopes/dates only; never return run config, offers or lease tokens.
    return json({task:{...task,job:JSON.parse(task.job)}});
  }
  return json({error:'管理查询不存在。'},404);
}
