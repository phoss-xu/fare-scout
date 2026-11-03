import {all,first,ensure} from './db.js';
import {label} from './locations.js';
export async function alertPage(db,userId,before=null) {
  ensure(before===null || /^[1-9]\d*$/.test(String(before)) && Number.isSafeInteger(Number(before)),'分页位置无效。');
  const rows=await all(db,`SELECT a.*,q.status email_status FROM alerts a JOIN watches w ON w.id=a.watch_id
    LEFT JOIN email_outbox q ON q.alert_id=a.id WHERE w.owner_id=? AND w.deleted_at IS NULL
    ${before?'AND a.id<?':''} ORDER BY a.id DESC LIMIT 101`,before?[userId,Number(before)]:[userId]);
  const more=rows.length>100;rows.length=Math.min(rows.length,100);
  const {unread}=await first(db,`SELECT COUNT(*) unread FROM alerts a JOIN watches w ON w.id=a.watch_id
    WHERE w.owner_id=? AND w.deleted_at IS NULL AND a.read_at IS NULL`,[userId]);
  return {alerts:rows,unread,next_before:more?rows.at(-1).id:null,
    destinations:Object.fromEntries([...new Set(rows.map(a=>a.destination))].map(c=>[c,label(c)]))};
}
