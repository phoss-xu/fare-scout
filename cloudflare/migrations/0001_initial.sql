-- Existing SQLite-compatible application schema.
CREATE TABLE alerts (
        id INTEGER PRIMARY KEY, observation_id INTEGER NOT NULL UNIQUE,
        watch_id INTEGER NOT NULL, destination TEXT NOT NULL,
        departure TEXT NOT NULL, arrival TEXT NOT NULL, created_at TEXT NOT NULL,
        reason TEXT NOT NULL, price REAL NOT NULL, previous_price REAL,
        booking_url TEXT, read_at TEXT, route_key TEXT);

CREATE TABLE auth_limits (
        key TEXT PRIMARY KEY, count INTEGER NOT NULL, window_start REAL NOT NULL);

CREATE TABLE email_outbox (
        alert_id INTEGER PRIMARY KEY, status TEXT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0, next_attempt TEXT NOT NULL, sent_at TEXT);

CREATE TABLE location_history (
        user_id INTEGER NOT NULL, role TEXT NOT NULL, location_id TEXT NOT NULL,
        selected_at TEXT NOT NULL, PRIMARY KEY(user_id,role,location_id));

CREATE TABLE observations (
        id INTEGER PRIMARY KEY, watch_id INTEGER NOT NULL,
        destination TEXT NOT NULL, departure TEXT NOT NULL, arrival TEXT NOT NULL,
        checked_at TEXT NOT NULL, status TEXT NOT NULL, offer TEXT, dismissed_at TEXT, route_key TEXT, search_id TEXT, batch_id TEXT);

CREATE TABLE schedules (
        watch_id INTEGER PRIMARY KEY, auto_enabled INTEGER NOT NULL DEFAULT 1,
        alerts_enabled INTEGER NOT NULL DEFAULT 1, interval_hours INTEGER NOT NULL DEFAULT 6,
        min_drop REAL NOT NULL DEFAULT 100, next_check TEXT,
        last_started TEXT, last_finished TEXT, last_status TEXT,
        failure_count INTEGER NOT NULL DEFAULT 0, query_cursor INTEGER NOT NULL DEFAULT 0, last_batch_count INTEGER NOT NULL DEFAULT 0, job_count INTEGER NOT NULL DEFAULT 0);

CREATE TABLE sessions (
        token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL,
        csrf_token TEXT NOT NULL, expires_at REAL NOT NULL);

CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);

CREATE TABLE setup_tokens (
        token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL, expires_at REAL NOT NULL);

CREATE TABLE users (
        id INTEGER PRIMARY KEY, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
        name TEXT NOT NULL, password_hash TEXT, notification_email TEXT NOT NULL,
        created_at TEXT NOT NULL);

CREATE TABLE watches (
        id INTEGER PRIMARY KEY, config TEXT NOT NULL, created_at TEXT NOT NULL,
        running INTEGER NOT NULL DEFAULT 0, owner_id INTEGER, deleted_at TEXT);

CREATE INDEX alert_watch ON alerts(watch_id, destination, departure, arrival);

CREATE INDEX observation_watch ON observations(watch_id, id);

CREATE INDEX price_comparison ON observations(watch_id,route_key,status,id);

CREATE INDEX watch_owner ON watches(owner_id);
