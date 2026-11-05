import {all,run,now,ensure} from './db.js';
import {validate} from './domain.js';

export function snapshot(data) {
  ensure(data && typeof data==='object' && !Array.isArray(data),'请检查要保存的查询组合。');
  const c=validate(data,true);
  const result=Object.fromEntries(['start','end','date_mode','adults','budget','max_stops','max_duration_hours','nights','weekdays'].map(key=>[key,c[key]]));
  if(c.trip_type==='oneway') result.trip_type='oneway';
  if(c.currency!=='HKD') result.currency=c.currency;
  result.origins=c.origin_selections.map(row=>row.id).sort();
  result.destinations=c.destination_selections.map(row=>row.id).sort();
  if(c.time_windows) result.time_windows=c.time_windows;
  if(c.date_pairs) result.date_pairs=c.date_pairs;
  return Object.fromEntries(Object.entries(result).sort(([a],[b])=>a.localeCompare(b)));
}
export async function listed(db,userId) {
  const rows=await all(db,'SELECT id,name,config,updated_at FROM search_presets WHERE user_id=? AND deleted_at IS NULL ORDER BY updated_at DESC,id',[userId]);
  return {presets:rows.map(row=>({...row,config:JSON.parse(row.config)}))};
}
export async function save(db,userId,data) {
  const name=data.name ?? '';
  ensure(typeof name==='string' && name.trim().length<=60,'组合名称请控制在 60 个字符以内。');
  const config=JSON.stringify(snapshot(data.config ?? {}));
  const result=await run(db,`INSERT INTO search_presets(id,user_id,name,config,updated_at)
    SELECT ?,?,?,?,? WHERE (SELECT COUNT(*) FROM search_presets WHERE user_id=? AND deleted_at IS NULL)<20
      OR EXISTS(SELECT 1 FROM search_presets WHERE user_id=? AND config=? AND deleted_at IS NULL)
    ON CONFLICT(user_id,config) DO UPDATE SET name=CASE WHEN excluded.name='' THEN search_presets.name ELSE excluded.name END,updated_at=excluded.updated_at,deleted_at=NULL`,
    [crypto.randomUUID(),userId,name.trim(),config,now(),userId,userId,config]);
  ensure(result.meta.changes,'最多保存 20 个查询组合，请先移除不用的组合。');
  return listed(db,userId);
}
export async function remove(db,userId,id) {
  ensure(typeof id==='string' && id.length<=40,'这条查询组合不存在。');
  const result=await run(db,'UPDATE search_presets SET deleted_at=? WHERE id=? AND user_id=? AND deleted_at IS NULL',[now(),id,userId]);
  ensure(result.meta.changes,'这条查询组合不存在。',404);
  return listed(db,userId);
}
