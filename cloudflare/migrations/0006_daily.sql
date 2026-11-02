CREATE TABLE daily_preferences (
 user_id INTEGER PRIMARY KEY REFERENCES users(id), config TEXT NOT NULL,
 enabled INTEGER NOT NULL DEFAULT 0, next_due TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE daily_editions (
 id TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), day TEXT NOT NULL,
 scheduled_at TEXT NOT NULL, run_id TEXT NOT NULL UNIQUE REFERENCES search_runs(id),
 status TEXT NOT NULL DEFAULT 'preparing', offers TEXT NOT NULL DEFAULT '[]',
 failures INTEGER NOT NULL DEFAULT 0, total INTEGER NOT NULL, checked_at TEXT,
 mail_status TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0,
 next_attempt TEXT NOT NULL, lease_token TEXT, lease_until TEXT, sent_at TEXT,
 UNIQUE(user_id,day)
);
DROP INDEX one_deal_run;
CREATE UNIQUE INDEX one_deal_run ON search_runs(owner_id)
 WHERE kind='deal' AND status='running' AND json_extract(config,'$.daily') IS NOT 1;
CREATE INDEX daily_due ON daily_preferences(enabled,next_due);
