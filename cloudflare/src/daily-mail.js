import {all,first,run,now} from './db.js';
import {ready,sendText,WaitingForVerification} from './mail.js';

export function editionText(e) {
  const c=JSON.parse(e.config),offers=JSON.parse(e.offers),unit=c.currency && c.currency!=='HKD'?c.currency+' ':'HK$';
  const heading=e.status==='error'?'今日查询失败，暂时无法生成推荐。':offers.length?'今天为你找到这些出行选择：':'本次有限结果中没有符合偏好的行程，不代表市场上没有航班。';
  const rows=offers.map(o=>`${o.outbound.from} → ${o.destination_name || o.outbound.to} · 往返 ${unit}${o.price}\n`+
    `去程 ${o.outbound.departureTime} → ${o.outbound.arrivalTime}\n返程 ${o.inbound.departureTime} → ${o.inbound.arrivalTime} 抵达\n`+
    `${o.travel.calendar_reference?'预计':'需'}请假 ${o.travel.leave_days} 天 · 可玩 ${o.travel.full_days} 个完整白天（09:00–20:00）${o.travel.red_eye?' · 凌晨往返':''}\n`+
    `请假日期：${o.travel.leave_dates.join('、')||'无'}${o.travel.calendar_reference?'；假期/补班安排尚待正式公布，需复核':''}\n核价链接：${o.bookingUrl || '暂无'}`);
  return `Fare Scout · ${e.day} 每日推荐\n${heading}\n\n${rows.join('\n\n')}\n\n`+
    `${c.adults} 位成人 · 经济舱 · ${c.currency || 'HKD'} 往返总价 · 最近查询 ${e.checked_at}\n`+
    `查询 ${e.total} 组，失败 ${e.failures} 组。有限结果不代表完整市场最低价。所有起降为机场当地时间。\n`+
    '请假按内地工作日/调休、18:00 下班、06:00 前抵达可上班估算，未计跨境交通和休息时间。可在网页修改时间或关闭每日推荐。';
}
export async function deliverDaily(env) {
  const db=env.DB,timestamp=now();
  const rows=await all(db,`SELECT e.*,r.config,p.enabled FROM daily_editions e JOIN search_runs r ON r.id=e.run_id
    JOIN daily_preferences p ON p.user_id=e.user_id WHERE e.status IN ('ready','error') AND e.scheduled_at<=?
    AND ((e.mail_status IN ('pending','retry','waiting_config','waiting_verification') AND e.next_attempt<=?) OR (e.mail_status='sending' AND e.lease_until<=?))
    ORDER BY e.next_attempt,e.scheduled_at LIMIT 3`,[timestamp,timestamp,timestamp]);
  for(const e of rows) {
    const status=!e.enabled?'cancelled':Date.now()-Date.parse(e.scheduled_at)>86400000?'skipped':!ready(env)?'waiting_config':null;
    if(status) {await run(db,"UPDATE daily_editions SET mail_status=? WHERE id=? AND mail_status<>'sent'",[status,e.id]);continue;}
    const token=crypto.randomUUID();
    const claim=await first(db,`UPDATE daily_editions SET mail_status='sending',lease_token=?,lease_until=? WHERE id=?
      AND (mail_status IN ('pending','retry','waiting_config','waiting_verification') OR (mail_status='sending' AND lease_until<=?)) RETURNING id`,[token,new Date(Date.now()+90000).toISOString(),e.id,timestamp]);
    if(!claim) continue;
    const active=await first(db,`SELECT u.notification_email FROM users u JOIN daily_preferences p ON p.user_id=u.id JOIN daily_editions e ON e.user_id=u.id
      WHERE e.id=? AND e.lease_token=? AND p.enabled=1`,[e.id,token]);
    if(!active) continue;
    try {
      await sendText(env,active.notification_email,`Fare Scout · ${e.day} 每日机票推荐`,editionText(e),'fare-daily-'+e.id,e.user_id,async()=>!!await first(db,`SELECT e.id FROM daily_editions e JOIN daily_preferences p ON p.user_id=e.user_id
        JOIN users u ON u.id=e.user_id WHERE e.id=? AND e.lease_token=? AND e.mail_status='sending' AND p.enabled=1 AND u.notification_email=?`,
        [e.id,token,active.notification_email]));
      await run(db,"UPDATE daily_editions SET mail_status='sent',sent_at=?,attempts=attempts+1,lease_token=NULL WHERE id=? AND lease_token=?",[now(),e.id,token]);
    } catch(error) {
      console.warn('Daily delivery failed',e.id,/^mail_http_\d+$/.test(error.message)?error.message:error.name);
      if(error instanceof WaitingForVerification) {
        await run(db,"UPDATE daily_editions SET mail_status='waiting_verification',next_attempt=?,lease_token=NULL WHERE id=? AND lease_token=?",
          [new Date(Date.now()+60000).toISOString(),e.id,token]);continue;
      }
      const attempt=e.attempts+1;
      await run(db,'UPDATE daily_editions SET mail_status=?,attempts=?,next_attempt=?,lease_token=NULL WHERE id=? AND lease_token=?',
        [attempt>=5?'failed':'retry',attempt,new Date(Date.now()+Math.min(60,2**attempt)*60000).toISOString(),e.id,token]);
    }
  }
}
