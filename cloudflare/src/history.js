import {all,batch,now,ensure} from './db.js';
import {resolve} from './locations.js';
export async function recent(db,userId) {
  const result={origin:[],destination:[]};
  const append=(role,value)=>{
    if(result[role].length>=8) return;
    try { const row=resolve(value);if(!result[role].some(r=>r.id===row.id)) result[role].push(row); }
    catch { console.warn('Recent location unavailable'); }
  };
  for(const row of await all(db,'SELECT role,location_id FROM location_history WHERE user_id=? ORDER BY selected_at DESC,location_id',[userId])) append(row.role,row.location_id);
  for(const row of await all(db,'SELECT config FROM watches WHERE owner_id=? ORDER BY id DESC',[userId])) {
    const c=JSON.parse(row.config);
    for(const value of c.origin_selections || c.origin_locations || [c.origin_location || c.origin]) append('origin',value);
    for(const value of c.destination_selections || c.destination_locations || c.destinations) append('destination',value);
  }
  return result;
}
export async function remember(db,userId,data) {
  ensure(['origin','destination'].includes(data.role),'请选择出发地或目的地。');
  const row=resolve(data.id);
  await batch(db,[['INSERT INTO location_history VALUES(?,?,?,?) ON CONFLICT(user_id,role,location_id) DO UPDATE SET selected_at=excluded.selected_at',[userId,data.role,row.id,now()]],
    [`DELETE FROM location_history WHERE user_id=? AND role=? AND location_id NOT IN
    (SELECT location_id FROM location_history WHERE user_id=? AND role=? ORDER BY selected_at DESC,location_id LIMIT 8)`,[userId,data.role,userId,data.role]]]);
  return recent(db,userId);
}
