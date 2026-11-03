-- Only the scheduler writes this bounded heartbeat; admin APIs remain SELECT-only.
CREATE TABLE runtime_heartbeats (
 name TEXT PRIMARY KEY, invocation_id TEXT NOT NULL, started_at TEXT NOT NULL,
 finished_at TEXT, status TEXT NOT NULL, duration_ms INTEGER, error_code TEXT
);
CREATE INDEX admin_run_created ON search_runs(created_at);
CREATE INDEX admin_observation_checked ON observations(checked_at,status);
CREATE INDEX admin_mail_created ON alerts(created_at,id);
CREATE INDEX admin_daily_created ON daily_editions(scheduled_at,id);
