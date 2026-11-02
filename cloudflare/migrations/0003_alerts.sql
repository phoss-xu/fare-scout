-- Runs in the same transaction as observation insertion. No read/write race between isolates.
CREATE TRIGGER observation_alert AFTER INSERT ON observations
WHEN NEW.status='ok' AND NEW.offer IS NOT NULL AND NEW.task_id IS NOT NULL
BEGIN
 INSERT INTO alerts(observation_id,watch_id,destination,departure,arrival,created_at,
   reason,price,previous_price,booking_url,route_key)
 SELECT NEW.id,NEW.watch_id,NEW.destination,NEW.departure,NEW.arrival,NEW.checked_at,
   CASE WHEN json_extract(w.config,'$.budget')>0
     AND json_extract(NEW.offer,'$.price')<=json_extract(w.config,'$.budget')
     AND (p.price IS NULL OR p.price>json_extract(w.config,'$.budget')) THEN 'budget' ELSE 'drop' END,
   json_extract(NEW.offer,'$.price'),p.price,json_extract(NEW.offer,'$.bookingUrl'),NEW.route_key
 FROM watches w JOIN schedules s ON s.watch_id=w.id
 LEFT JOIN (SELECT json_extract(offer,'$.price') AS price FROM observations
   WHERE watch_id=NEW.watch_id AND route_key=NEW.route_key AND status='ok' AND id<NEW.id
   ORDER BY id DESC LIMIT 1) p ON 1=1
 WHERE w.id=NEW.watch_id AND w.deleted_at IS NULL AND s.alerts_enabled=1
 AND ((p.price IS NOT NULL AND p.price-json_extract(NEW.offer,'$.price')>=s.min_drop)
   OR (json_extract(w.config,'$.budget')>0 AND json_extract(NEW.offer,'$.price')<=json_extract(w.config,'$.budget')
     AND (p.price IS NULL OR p.price>json_extract(w.config,'$.budget'))))
 AND NOT EXISTS (SELECT 1 FROM alerts a WHERE a.watch_id=NEW.watch_id AND a.route_key=NEW.route_key
   AND a.price<=json_extract(NEW.offer,'$.price'));
END;
CREATE TRIGGER alert_outbox AFTER INSERT ON alerts
BEGIN
 INSERT INTO email_outbox(alert_id,status,next_attempt) VALUES(NEW.id,'pending',NEW.created_at);
END;
