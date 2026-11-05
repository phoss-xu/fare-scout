import {all,first,batch,ensure,now} from './db.js';
import {cutoff,priceIdentity,seriesId,summarize} from './price-history-model.js';

// Called inside the same fenced transaction as task completion; cached source times deduplicate.
export async function sampleQueries(c,offers,checkedAt,active,args) {
  const groups=new Map();
  for(const o of offers) {
    const identity=priceIdentity(c,o);
    if(!groups.has(identity))groups.set(identity,[]);
    groups.get(identity).push(o);
  }
  if(!groups.size)return [];
  const payload=JSON.stringify(await Promise.all([...groups].map(async([identity,quotes])=>
    ({id:await seriesId(identity),identity,price:Math.min(...quotes.map(o=>o.price)),quotes:JSON.stringify(quotes)}))));
  const owner='(SELECT owner_id FROM search_runs WHERE id=(SELECT run_id FROM search_tasks WHERE id=?))';
  return [
    [`INSERT INTO price_series(user_id,id,identity,first_at)
      SELECT ${owner},json_extract(value,'$.id'),json_extract(value,'$.identity'),? FROM json_each(?) WHERE ${active}
      ON CONFLICT(user_id,id) DO UPDATE SET first_at=MIN(price_series.first_at,excluded.first_at)`,[args[0],checkedAt,payload,...args]],
    [`INSERT INTO price_samples(user_id,series_id,checked_at,price,quotes)
      SELECT ${owner},json_extract(value,'$.id'),?,json_extract(value,'$.price'),json_extract(value,'$.quotes') FROM json_each(?) WHERE ${active}
      ON CONFLICT(user_id,series_id,checked_at) DO NOTHING`,[args[0],checkedAt,payload,...args]]
  ];
}
const dailySQL=`SELECT series_id,date(checked_at,'+8 hours') day,MIN(price) price,MAX(price) maximum_price,MAX(checked_at) last_at
  FROM price_samples WHERE user_id=? AND checked_at>=? AND checked_at<=?`;
export async function annotatePrices(db,userId,c,offers,at=now()) {
  if(!offers.length)return offers;
  const ids=await Promise.all(offers.map((o,i)=>seriesId(priceIdentity(Array.isArray(c)?c[i]:c,o))));
  const keys=JSON.stringify([...new Set(ids)]);
  const [points,series]=await Promise.all([
    all(db,dailySQL+` AND series_id IN (SELECT value FROM json_each(?)) GROUP BY series_id,day ORDER BY day`,[userId,cutoff(at),at,keys]),
    all(db,'SELECT id,first_at FROM price_series WHERE user_id=? AND id IN (SELECT value FROM json_each(?))',[userId,keys])
  ]);
  const grouped=new Map(),firsts=new Map(series.map(s=>[s.id,s.first_at]));
  for(const p of points){if(!grouped.has(p.series_id))grouped.set(p.series_id,[]);grouped.get(p.series_id).push(p);}
  return offers.map((o,i)=>({...o,price_history:o._checked_at && (Date.parse(o._checked_at)<Date.parse(cutoff(at)) || Date.parse(o._checked_at)>Date.parse(at))?null:
    {id:ids[i],...summarize(grouped.get(ids[i]) || [],firsts.get(ids[i]),o.price,at)}}));
}
export async function priceHistory(db,userId,id,at=now()) {
  ensure(/^[a-f0-9]{64}$/.test(id),'这份价格历史不存在。',404);
  const series=await first(db,'SELECT identity,first_at FROM price_series WHERE user_id=? AND id=?',[userId,id]);
  ensure(series,'这份价格历史不存在或已过期。',404);
  const points=await all(db,dailySQL+' AND series_id=? GROUP BY series_id,day ORDER BY day',[userId,cutoff(at),at,id]);
  ensure(points.length,'这份价格历史已超出 90 天保留期。',404);
  return {id,identity:JSON.parse(series.identity),points,summary:summarize(points,series.first_at,points.at(-1).price,at)};
}
export async function cleanPriceHistory(db,at=now()) {
  await batch(db,[['DELETE FROM price_samples WHERE checked_at<?',[cutoff(at)]],
    ['DELETE FROM price_series WHERE NOT EXISTS(SELECT 1 FROM price_samples p WHERE p.user_id=price_series.user_id AND p.series_id=price_series.id)',[]]]);
}
