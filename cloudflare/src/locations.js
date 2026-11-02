import catalogue from '../../app/data/locations.json';
import groups from './groups.json';
import {ensure} from './db.js';
const records = new Map(catalogue.locations.map(row => [row.id, {...row}]));
const counts = {city: {}, country: {}};
for (const row of records.values()) if (row.kind === 'airport') {
  for (const kind of ['city', 'country']) counts[kind][row[kind + '_code']] = (counts[kind][row[kind + '_code']] || 0) + 1;
}
for (const row of records.values()) {
  row.country_name = records.get('country:' + row.country_code)?.name || '';
  row.city_name = records.get('city:' + row.city_code)?.name || '';
  row.airport_count = row.kind === 'airport' ? 1 : counts[row.kind][row.code] || 0;
}
const fold = value => String(value || '').toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '');
// Fold the public catalogue once per isolate; requests only scan prepared strings.
const kindOrder = {country:0,city:1,airport:2};
const indexed = [...records.values()].sort((a,b)=>kindOrder[a.kind]-kindOrder[b.kind] || a.english_name.localeCompare(b.english_name)).map(row=>{
  const fields=['name','english_name','code'].map(key=>fold(row[key]));
  return {row,fields,content:[...fields,fold(row.country_name),fold(row.city_name)].join(' ')};
});
const catalogueStats = {country:0,city:0,airport:0,updated_at:catalogue.updated_at};
for (const row of records.values()) catalogueStats[row.kind]++;
export function group(key) {
  ensure(Object.hasOwn(groups, key), '没有找到这个地区分类，请重新选择。');
  return groups[key];
}
export const menu = () => Object.values(groups).map(({id, label}) => ({id, label}));
export function resolve(value) {
  let id = typeof value === 'object' && value ? value.id : value;
  ensure(typeof id === 'string' && id.length <= 80, '请从地点候选中选择国家/地区、城市或机场。');
  id = id.trim();
  if (id.startsWith('group:')) {
    const g = group(id.slice(6));
    const rows = g.sections.flatMap(s => s.locations).filter(r => r.kind === 'country');
    ensure(rows.length, '此分类仅供浏览，请选择其中的具体地点。');
    return {id, kind:'group', code:`${rows.length} 国/地区`, name:g.id === 'visa-free' ? '免签精选' : g.label,
      english_name:g.label, members:rows.map(r => r.id), country_name:'', city_name:'', airport_count:rows.reduce((n,r) => n+r.airport_count,0)};
  }
  if (!id.includes(':')) id = ['airport','city','country'].map(k => k + ':' + id.toUpperCase()).find(k => records.has(k));
  ensure(records.has(id), '没有找到该地点，请重新搜索并从候选中选择。');
  return records.get(id);
}
export function selections(raw, allowEmpty = false) {
  ensure(Array.isArray(raw) && raw.length <= 100 && (allowEmpty || raw.length), '请至少选择一个地点范围，最多 100 个。');
  return [...new Map(raw.map(resolve).map(r => [r.id,r])).values()];
}
export function expand(rows) {
  const result = [...new Map(rows.flatMap(r => r.kind === 'group' ? r.members.map(resolve) : [r]).map(r => [r.id,r])).values()];
  ensure(result.length <= 100, '展开后超过 100 个地点范围，请缩小选择。');
  return result;
}
export const origins = c => c.origin_locations || [resolve(c.origin_location || c.origin)];
export const destinations = c => (c.destination_locations || c.destinations).map(resolve);
export function contains(scope, airport) {
  if (scope.kind === 'airport') return scope.code === airport;
  const member = records.get('airport:' + airport);
  return !!member && member[scope.kind === 'country' ? 'country_code' : 'city_code'] === scope.code;
}
export function search(query = '', kind = '') {
  ensure(['','country','city','airport'].includes(kind) && query.length <= 100, '请检查地点类型或缩短搜索内容。');
  const q=fold(query.trim()),terms=q.split(/\s+/).filter(Boolean);
  if(!q) return indexed.filter(item=>!kind || item.row.kind===kind).slice(0,20).map(item=>item.row);
  const buckets=[[],[],[]];
  for(const item of indexed) {
    if(kind && item.row.kind!==kind) continue;
    if(!terms.every(term=>item.content.includes(term))) continue;
    const score=item.fields.includes(q)?0:item.fields.some(field=>field.startsWith(q))?1:2;
    if(buckets[score].length<20) buckets[score].push(item.row);
  }
  return buckets.flat().slice(0,20);
}
export function label(code) {
  const r = ['airport','city','country'].map(k => records.get(k + ':' + code)).find(Boolean);
  return r ? r.city_name || r.name : code;
}
export const stats = () => ({...catalogueStats});
