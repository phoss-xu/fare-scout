import {first,run,now} from './db.js';
import {search,SourceError} from './provider.js';
const TTL_MS=60000;
const stable=value=>Array.isArray(value)?value.map(stable):value && typeof value==='object'?
  Object.fromEntries(Object.keys(value).sort().filter(k=>value[k]!==undefined).map(k=>[k,stable(value[k])])):value;
export async function cacheKey(config,job) {
  const bytes=new TextEncoder().encode(JSON.stringify(stable({version:1,config,job})));
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
}
export async function querySource(env,c,job,discovery) {
  // Explicit watch checks always obtain a new sample. Discovery shares only identical conditions.
  if(!discovery) return {offers:await search(c,job,false),checkedAt:now(),cached:false};
  const db=env.DB,key=await cacheKey(c,job),at=now();
  const cached=await first(db,'SELECT offers,checked_at FROM source_cache WHERE key=? AND offers IS NOT NULL AND expires_at>?',[key,at]);
  if(cached) return {offers:JSON.parse(cached.offers),checkedAt:cached.checked_at,cached:true};
  const token=crypto.randomUUID();
  const claim=await first(db,`INSERT INTO source_cache(key,expires_at,lease_token,lease_until) VALUES(?,?,?,?)
    ON CONFLICT(key) DO UPDATE SET lease_token=excluded.lease_token,lease_until=excluded.lease_until
    WHERE source_cache.expires_at<=? AND (source_cache.lease_until IS NULL OR source_cache.lease_until<=?) RETURNING key`,
    [key,at,token,new Date(Date.now()+90000).toISOString(),at,at]);
  if(!claim) return {busy:true};
  try {
    const offers=await search(c,job,true);
    if(offers.length>100) throw new SourceError('result_limit');
    const checkedAt=now();
    await run(db,'UPDATE source_cache SET offers=?,checked_at=?,expires_at=?,lease_token=NULL,lease_until=NULL WHERE key=? AND lease_token=?',
      [JSON.stringify(offers),checkedAt,new Date(Date.now()+TTL_MS).toISOString(),key,token]);
    return {offers,checkedAt,cached:false};
  } catch(error) {
    await run(db,'DELETE FROM source_cache WHERE key=? AND lease_token=?',[key,token]);
    throw error;
  }
}
export async function cleanSourceCache(db) {
  await run(db,'DELETE FROM source_cache WHERE expires_at<=? AND (lease_until IS NULL OR lease_until<=?)',[now(),now()]);
}
