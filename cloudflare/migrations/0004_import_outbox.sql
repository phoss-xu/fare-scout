-- Legacy alert imports already include their outbox rows. Only new Worker samples enqueue mail.
DROP TRIGGER alert_outbox;
CREATE TRIGGER alert_outbox AFTER INSERT ON alerts
WHEN EXISTS(SELECT 1 FROM observations WHERE id=NEW.observation_id AND task_id IS NOT NULL)
BEGIN
 INSERT INTO email_outbox(alert_id,status,next_attempt) VALUES(NEW.id,'pending',NEW.created_at);
END;
