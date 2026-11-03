import {all,first,run,ensure,now,ApiError} from './db.js';
import {tripSnapshot,tripIdentity} from '../../app/static/trip-snapshot.js';
function snapshot(data) {try{return tripSnapshot(data);}catch{throw new ApiError('行程信息不完整，请重新查询后再试。');}}
export async function listed(db,userId) {
  const rows=await all(db,'SELECT trip_key,snapshot,saved_at FROM saved_trips WHERE user_id=? ORDER BY saved_at DESC,trip_key',[userId]);
  return {trips:rows.map(r=>({key:r.trip_key,snapshot:JSON.parse(r.snapshot),saved_at:r.saved_at}))};
}
export async function save(db,userId,data) {
  const s=snapshot(data),key=tripIdentity(s);
  const result=await run(db,`INSERT INTO saved_trips(user_id,trip_key,snapshot,saved_at)
    SELECT ?,?,?,? WHERE (SELECT COUNT(*) FROM saved_trips WHERE user_id=?)<200 OR EXISTS(SELECT 1 FROM saved_trips WHERE user_id=? AND trip_key=?)
    ON CONFLICT(user_id,trip_key) DO UPDATE SET snapshot=excluded.snapshot,saved_at=excluded.saved_at`,[userId,key,JSON.stringify(s),now(),userId,userId,key]);
  ensure(result.meta.changes,'最多收藏 200 个行程，请先移除不用的行程。');
  return listed(db,userId);
}
export async function remove(db,userId,key) {
  ensure(typeof key==='string' && key.length<=12000,'请选择有效的行程。');
  await run(db,'DELETE FROM saved_trips WHERE user_id=? AND trip_key=?',[userId,key]);
  return listed(db,userId);
}
export async function share(db,userId,data) {
  const s=snapshot(data),encoded=JSON.stringify(s),key=tripIdentity(s);
  const existing=await first(db,'SELECT id FROM shared_trips WHERE user_id=? AND trip_key=? AND snapshot=?',[userId,key,encoded]);
  if(existing)return existing;
  const id=crypto.randomUUID();
  const result=await run(db,`INSERT INTO shared_trips(id,user_id,trip_key,snapshot,created_at) SELECT ?,?,?,?,?
    WHERE (SELECT COUNT(*) FROM shared_trips WHERE user_id=?)<1000 ON CONFLICT(user_id,trip_key,snapshot) DO NOTHING`,[id,userId,key,encoded,now(),userId]);
  if(!result.meta.changes) {
    const duplicate=await first(db,'SELECT id FROM shared_trips WHERE user_id=? AND trip_key=? AND snapshot=?',[userId,key,encoded]);
    ensure(duplicate,'分享数量已达上限，请联系维护者。');return duplicate;
  }
  return {id};
}
export async function shared(db,id) {
  ensure(typeof id==='string' && /^[a-f0-9-]{36}$/.test(id),'分享不存在或已失效。',404);
  const row=await first(db,'SELECT snapshot,created_at FROM shared_trips WHERE id=?',[id]);
  ensure(row,'分享不存在或已失效。',404);
  return {snapshot:JSON.parse(row.snapshot),created_at:row.created_at};
}
