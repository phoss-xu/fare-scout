-- Keep the latest complete sampling batch separate from the append-only history.
CREATE TABLE current_observations (
 id INTEGER PRIMARY KEY REFERENCES observations(id) ON DELETE CASCADE,
 watch_id INTEGER NOT NULL, query_key TEXT NOT NULL, batch_key TEXT NOT NULL
);
CREATE INDEX current_watch ON current_observations(watch_id,id);
CREATE INDEX current_query ON current_observations(query_key,batch_key);
INSERT INTO current_observations(id,watch_id,query_key,batch_key)
 SELECT o.id,o.watch_id,json_array(o.watch_id,COALESCE(NULLIF(o.search_id,''),o.destination),o.departure,o.arrival),COALESCE(NULLIF(o.batch_id,''),'legacy:'||o.id)
 FROM observations o JOIN (
   SELECT watch_id,COALESCE(NULLIF(search_id,''),destination) scope,departure,arrival,MAX(id) last_id
   FROM observations GROUP BY watch_id,COALESCE(NULLIF(search_id,''),destination),departure,arrival
 ) heads ON o.watch_id=heads.watch_id AND COALESCE(NULLIF(o.search_id,''),o.destination)=heads.scope
   AND o.departure=heads.departure AND o.arrival=heads.arrival
 JOIN observations last ON last.id=heads.last_id
 WHERE COALESCE(NULLIF(o.batch_id,''),'legacy:'||o.id)=COALESCE(NULLIF(last.batch_id,''),'legacy:'||last.id);
CREATE TRIGGER observation_current AFTER INSERT ON observations
BEGIN
 DELETE FROM current_observations
  WHERE query_key=json_array(NEW.watch_id,COALESCE(NULLIF(NEW.search_id,''),NEW.destination),NEW.departure,NEW.arrival)
   AND NOT EXISTS (SELECT 1 FROM current_observations same_batch
    WHERE same_batch.query_key=json_array(NEW.watch_id,COALESCE(NULLIF(NEW.search_id,''),NEW.destination),NEW.departure,NEW.arrival)
      AND same_batch.batch_key=COALESCE(NULLIF(NEW.batch_id,''),'legacy:'||NEW.id));
 INSERT INTO current_observations VALUES(NEW.id,NEW.watch_id,
  json_array(NEW.watch_id,COALESCE(NULLIF(NEW.search_id,''),NEW.destination),NEW.departure,NEW.arrival),
  COALESCE(NULLIF(NEW.batch_id,''),'legacy:'||NEW.id));
END;
CREATE INDEX removed_observations ON observations(watch_id,id) WHERE dismissed_at IS NOT NULL;
CREATE INDEX alert_recent ON alerts(watch_id,id);
CREATE INDEX active_deals ON search_runs(kind,status) WHERE json_extract(config,'$.daily') IS NOT 1;
CREATE TABLE source_cache (
 key TEXT PRIMARY KEY, offers TEXT, checked_at TEXT, expires_at TEXT NOT NULL,
 lease_token TEXT, lease_until TEXT
);
ALTER TABLE search_tasks ADD COLUMN source_checked_at TEXT;
ALTER TABLE search_tasks ADD COLUMN cache_hit INTEGER NOT NULL DEFAULT 0;
CREATE INDEX alert_unread ON alerts(watch_id,id) WHERE read_at IS NULL;
CREATE INDEX source_cache_expiry ON source_cache(expires_at);
