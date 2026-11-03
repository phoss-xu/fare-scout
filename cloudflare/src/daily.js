import {all,first,run,batch,now,ensure} from './db.js';
import {validate,plusDays,today} from './domain.js';
import {travelWindows} from './travel-time.js';
import {resolve} from './locations.js';

export const defaults = {enabled:false,push_time:'08:30',origins:['airport:HKG','airport:SZX'],budget:0,adults:1,
  max_leave_days:0,min_full_days:2,prefer_red_eye:true,currency:'HKD'};
export function preferences(d) {
  const c={...defaults,...d};
  ensure(['HKD','CNY','USD','EUR','JPY','GBP','SGD','AUD','CAD'].includes(c.currency),'请选择支持的报价货币。');
  ensure(typeof c.enabled==='boolean' && typeof c.prefer_red_eye==='boolean','请选择是否开启每日推荐及凌晨航班优先。');
  ensure(typeof c.push_time==='string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(c.push_time),'请选择有效的推送时间。');
  ensure(Array.isArray(c.origins) && c.origins.length && c.origins.every(o=>['airport:HKG','airport:SZX'].includes(o)),'请选择香港或深圳机场。');
  for(const [key,min,max] of [['budget',0,1000000],['adults',1,9],['max_leave_days',0,2],['min_full_days',1,5]]) {
    ensure((typeof c[key]==='number' || typeof c[key]==='string' && c[key].trim()!=='') && Number.isFinite(Number(c[key])),'请检查预算、人数和请假天数。');
    c[key]=Number(c[key]);ensure(c[key]>=min && c[key]<=max && Number.isInteger(c[key]),'请检查预算、人数和请假天数。');
  }
  return Object.fromEntries(Object.keys(defaults).map(k=>[k,k==='origins'?[...new Set(c[k])]:c[k]]));
}
export function nextDue(time,at=new Date()) {
  const date=new Date(at.getTime()+8*3600000).toISOString().slice(0,10);
  let due=new Date(date+'T'+time+':00+08:00');
  if(due<=at) due=new Date(plusDays(date,1)+'T'+time+':00+08:00');
  return due.toISOString();
}
export async function saveDaily(db,userId,data) {
  const c=preferences(data),existing=await first(db,'SELECT * FROM daily_preferences WHERE user_id=?',[userId]);
  const due=existing && existing.enabled && c.enabled && JSON.parse(existing.config).push_time===c.push_time?existing.next_due:nextDue(c.push_time);
  const day=new Date(Date.parse(due)+8*3600000).toISOString().slice(0,10);
  const changedTime=existing && JSON.parse(existing.config).push_time!==c.push_time;
  await batch(db,[['INSERT INTO daily_preferences(user_id,config,enabled,next_due,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET config=excluded.config,enabled=excluded.enabled,next_due=excluded.next_due,updated_at=excluded.updated_at',[userId,JSON.stringify(c),Number(c.enabled),due,now()]],
    ["UPDATE daily_editions SET mail_status='cancelled',lease_token=NULL WHERE user_id=? AND mail_status IN ('pending','waiting_config','waiting_verification','retry','sending') AND ?=0",[userId,Number(c.enabled)]],
    ["UPDATE daily_editions SET scheduled_at=?,next_attempt=? WHERE user_id=? AND day=? AND mail_status IN ('pending','waiting_config','waiting_verification','retry') AND ?=1",[due,due,userId,day,Number(!!changedTime)]],
    ["UPDATE daily_editions SET mail_status='cancelled',lease_token=NULL WHERE user_id=? AND day<>? AND mail_status IN ('pending','waiting_config','waiting_verification','retry') AND ?=1",[userId,day,Number(!!changedTime)]]]);
}
export async function dailyState(db,userId) {
  const p=await first(db,'SELECT * FROM daily_preferences WHERE user_id=?',[userId]);
  const edition=await first(db,`SELECT e.*,r.config FROM daily_editions e JOIN search_runs r ON r.id=e.run_id WHERE e.user_id=? ORDER BY e.day DESC LIMIT 1`,[userId]);
  return {settings:p?JSON.parse(p.config):defaults,next_due:p?.enabled?p.next_due:null,
    edition:edition?{day:edition.day,status:edition.status,offers:JSON.parse(edition.offers),failures:edition.failures,total:edition.total,
      checked_at:edition.checked_at,scheduled_at:edition.scheduled_at,mail_status:edition.mail_status,config:JSON.parse(edition.config)}:null};
}
async function enqueueDaily(db,p) {
  const pref=JSON.parse(p.config),day=new Date(Date.parse(p.next_due)+8*3600000).toISOString().slice(0,10);
  const c={...validate({...pref,destinations:[],start:plusDays(today(),1),end:plusDays(today(),84),min_nights:1,max_nights:10,max_duration_hours:8,max_stops:1},true),...pref,nights:undefined,daily:true};
  const windows=travelWindows(c,today()),tasks=windows.flatMap(window=>c.origin_locations.map(o=>({origin_id:o.id,location_id:null,window})));
  const id=crypto.randomUUID(),timestamp=now(),edition=crypto.randomUUID();
  await batch(db,[
    [`INSERT INTO search_runs(id,kind,owner_id,config,total,job_count,created_at)
      SELECT ?,'deal',?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM daily_editions WHERE user_id=? AND day=?)`,[id,p.user_id,JSON.stringify(c),tasks.length,tasks.length,timestamp,p.user_id,day]],
    ['INSERT OR IGNORE INTO daily_editions(id,user_id,day,scheduled_at,run_id,total,next_attempt) SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM search_runs WHERE id=?)',[edition,p.user_id,day,p.next_due,id,tasks.length,p.next_due,id]],
    ...tasks.map(job=>['INSERT INTO search_tasks(id,run_id,job,available_at) SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM search_runs WHERE id=?)',[crypto.randomUUID(),id,JSON.stringify(job),timestamp,id]]),
    ['UPDATE daily_preferences SET next_due=? WHERE user_id=? AND next_due=?',[nextDue(pref.push_time,new Date(p.next_due)),p.user_id,p.next_due]]
  ]);
}
export function rankOffers(offers,c) {
  const best=new Map();
  const compare=(a,b)=>a.travel.leave_days-b.travel.leave_days || (c.prefer_red_eye?Number(b.travel.red_eye)-Number(a.travel.red_eye):0) || a.price-b.price || b.travel.full_days-a.travel.full_days;
  for(const o of offers) {
    const airport=resolve('airport:'+o.outbound.to),key=airport.city_code || airport.code;
    if(!best.has(key) || compare(o,best.get(key))<0) best.set(key,o);
  }
  return [...best.values()].sort(compare).slice(0,6);
}
export async function dailyTick(env) {
  const db=env.DB,timestamp=now();
  if(env.QUERY_ENABLED==='true') for(const p of await all(db,'SELECT * FROM daily_preferences WHERE enabled=1 AND next_due<=? ORDER BY next_due LIMIT 3',[new Date(Date.now()+30*60000).toISOString()])) {
    // Missed days are coalesced; never replay an old edition with today's prices.
    if(new Date(Date.parse(p.next_due)+8*3600000).toISOString().slice(0,10)<today()) {
      await run(db,'UPDATE daily_preferences SET next_due=? WHERE user_id=?',[nextDue(JSON.parse(p.config).push_time),p.user_id]);continue;
    }
    await enqueueDaily(db,p);
  }
  for(const e of await all(db,`SELECT e.*,r.status AS run_status,r.config FROM daily_editions e JOIN search_runs r ON r.id=e.run_id WHERE e.status='preparing' AND r.status<>'running' LIMIT 10`)) {
    const tasks=await all(db,'SELECT status,offers FROM search_tasks WHERE run_id=?',[e.run_id]);
    const failures=tasks.filter(t=>t.status==='error').length;
    await run(db,`UPDATE daily_editions SET status=?,offers=?,failures=?,checked_at=? WHERE id=? AND status='preparing'`,
      [failures===tasks.length?'error':'ready',JSON.stringify(rankOffers(tasks.flatMap(t=>JSON.parse(t.offers||'[]')),JSON.parse(e.config))),failures,timestamp,e.id]);
  }
}
