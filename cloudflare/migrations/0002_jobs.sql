-- Durable work; leases fence late writes from old isolates.
CREATE TABLE search_runs (
 id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('watch','deal')),
 owner_id INTEGER NOT NULL, watch_id INTEGER, config TEXT NOT NULL,
 automatic INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'running',
 total INTEGER NOT NULL, cursor_start INTEGER NOT NULL DEFAULT 0, job_count INTEGER NOT NULL,
 created_at TEXT NOT NULL, finalize_token TEXT, finished_at TEXT
);
CREATE UNIQUE INDEX one_watch_run ON search_runs(watch_id) WHERE kind='watch' AND status='running';
CREATE UNIQUE INDEX one_deal_run ON search_runs(owner_id) WHERE kind='deal' AND status='running';
CREATE TABLE search_tasks (
 id TEXT PRIMARY KEY, run_id TEXT NOT NULL REFERENCES search_runs(id) ON DELETE CASCADE,
 job TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0,
 available_at TEXT NOT NULL, lease_token TEXT, lease_until TEXT, offers TEXT, error_code TEXT
);
CREATE INDEX task_due ON search_tasks(status,available_at,lease_until);
CREATE INDEX task_run ON search_tasks(run_id,status);
ALTER TABLE observations ADD COLUMN task_id TEXT;
CREATE UNIQUE INDEX task_route ON observations(task_id,route_key) WHERE route_key IS NOT NULL;
ALTER TABLE email_outbox ADD COLUMN lease_token TEXT;
ALTER TABLE email_outbox ADD COLUMN lease_until TEXT;
