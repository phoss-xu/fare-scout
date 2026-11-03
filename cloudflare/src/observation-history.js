import {all,first,ensure} from './db.js';
import {label} from './locations.js';
const decode = row => ({...row,offer:row.offer?JSON.parse(row.offer):null});
export async function currentObservations(db,userId) {
  // History size no longer determines the cost of a normal page refresh.
  const rows=await all(db,`SELECT o.* FROM watches w JOIN current_observations c ON c.watch_id=w.id
    JOIN observations o ON o.id=c.id WHERE w.owner_id=? AND w.deleted_at IS NULL ORDER BY o.id DESC`,[userId]);
  return rows.map(decode);
}
export async function history(db,id,userId,before) {
  ensure(Number.isSafeInteger(id) && id>0,'这条监控不存在。',404);
  ensure(await first(db,'SELECT id FROM watches WHERE id=? AND owner_id=? AND deleted_at IS NULL',[id,userId]),'这条监控不存在。',404);
  ensure(before===null || /^[1-9]\d*$/.test(before) && Number.isSafeInteger(Number(before)),'分页位置无效。');
  const rows=await all(db,`SELECT o.*,(SELECT MIN(json_extract(p.offer,'$.price')) FROM observations p
      WHERE p.watch_id=o.watch_id AND p.route_key IS o.route_key AND p.status='ok'
        AND (o.route_key IS NOT NULL OR (p.destination=o.destination AND p.departure=o.departure AND p.arrival=o.arrival))) monitored_min
    FROM observations o WHERE o.watch_id=? ${before?'AND o.id<?':''} ORDER BY o.id DESC LIMIT 101`,before?[id,Number(before)]:[id]);
  const more=rows.length>100;rows.length=Math.min(rows.length,100);
  const summary=await first(db,`SELECT COUNT(*) total,MIN(checked_at) first_at,COUNT(DISTINCT date(checked_at,'+8 hours')) sampled_days
    FROM observations WHERE watch_id=?`,[id]);
  return {observations:rows.map(decode),summary,next_before:more?rows.at(-1).id:null,
    destinations:Object.fromEntries([...new Set(rows.map(o=>o.destination))].map(c=>[c,label(c)]))};
}
export async function removedOffers(db,userId,before=null) {
  ensure(before===null || /^[1-9]\d*$/.test(String(before)) && Number.isSafeInteger(Number(before)),'分页位置无效。');
  const rows=await all(db,`SELECT o.* FROM observations o JOIN watches w ON w.id=o.watch_id
    WHERE w.owner_id=? AND w.deleted_at IS NULL AND o.dismissed_at IS NOT NULL ${before?'AND o.id<?':''}
    ORDER BY o.id DESC LIMIT 101`,before?[userId,Number(before)]:[userId]);
  const more=rows.length>100;rows.length=Math.min(rows.length,100);
  return {offers:rows.map(decode),next_before:more?rows.at(-1).id:null};
}
