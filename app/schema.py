"""Idempotent SQLite schema upgrades; preserve legacy rows."""
import json
from . import alerts, journeys


def initialize(db):
    db.executescript("""
      CREATE TABLE IF NOT EXISTS watches (
        id INTEGER PRIMARY KEY, config TEXT NOT NULL, created_at TEXT NOT NULL,
        running INTEGER NOT NULL DEFAULT 0, owner_id INTEGER);
      CREATE TABLE IF NOT EXISTS observations (
        id INTEGER PRIMARY KEY, watch_id INTEGER NOT NULL,
        destination TEXT NOT NULL, departure TEXT NOT NULL, arrival TEXT NOT NULL,
        checked_at TEXT NOT NULL, status TEXT NOT NULL, offer TEXT);
      CREATE INDEX IF NOT EXISTS observation_watch ON observations(watch_id, id);
      CREATE TABLE IF NOT EXISTS schedules (
        watch_id INTEGER PRIMARY KEY, auto_enabled INTEGER NOT NULL DEFAULT 1,
        alerts_enabled INTEGER NOT NULL DEFAULT 1, interval_hours INTEGER NOT NULL DEFAULT 6,
        min_drop REAL NOT NULL DEFAULT 100, next_check TEXT,
        last_started TEXT, last_finished TEXT, last_status TEXT,
        failure_count INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS email_outbox (
        alert_id INTEGER PRIMARY KEY, status TEXT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0, next_attempt TEXT NOT NULL, sent_at TEXT);
      CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    """)
    db.executescript("""
      CREATE TABLE IF NOT EXISTS saved_trips (
        user_id INTEGER NOT NULL, trip_key TEXT NOT NULL, snapshot TEXT NOT NULL,
        saved_at TEXT NOT NULL, PRIMARY KEY(user_id,trip_key));
      CREATE INDEX IF NOT EXISTS saved_trips_owner ON saved_trips(user_id,saved_at);
      CREATE TABLE IF NOT EXISTS shared_trips (
        id TEXT PRIMARY KEY, user_id INTEGER NOT NULL, trip_key TEXT NOT NULL,
        snapshot TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(user_id,trip_key,snapshot));
      CREATE INDEX IF NOT EXISTS shared_trips_owner ON shared_trips(user_id);
    """)
    alerts.initialize(db)
    db.executescript("""
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
        name TEXT NOT NULL, password_hash TEXT, notification_email TEXT NOT NULL,
        created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions (
        token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL,
        csrf_token TEXT NOT NULL, expires_at REAL NOT NULL);
      CREATE TABLE IF NOT EXISTS setup_tokens (
        token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL, expires_at REAL NOT NULL);
      CREATE TABLE IF NOT EXISTS auth_limits (
        key TEXT PRIMARY KEY, count INTEGER NOT NULL, window_start REAL NOT NULL);
      CREATE TABLE IF NOT EXISTS search_presets (
        id TEXT PRIMARY KEY, user_id INTEGER NOT NULL, name TEXT NOT NULL DEFAULT '',
        config TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, UNIQUE(user_id,config));
      CREATE INDEX IF NOT EXISTS search_presets_owner ON search_presets(user_id,updated_at);
      CREATE TABLE IF NOT EXISTS location_history (
        user_id INTEGER NOT NULL, role TEXT NOT NULL, location_id TEXT NOT NULL,
        selected_at TEXT NOT NULL, PRIMARY KEY(user_id,role,location_id));
    """)
    columns = {row[1] for row in db.execute("PRAGMA table_info(watches)")}
    if "owner_id" not in columns:
        db.execute("ALTER TABLE watches ADD COLUMN owner_id INTEGER")
    db.execute("CREATE INDEX IF NOT EXISTS watch_owner ON watches(owner_id)")
    upgrades = {"watches": {"deleted_at":"TEXT"}, "observations": {"dismissed_at":"TEXT", "route_key":"TEXT", "search_id":"TEXT", "batch_id":"TEXT"},
                "alerts": {"route_key":"TEXT"},
                "schedules": {"query_cursor":"INTEGER NOT NULL DEFAULT 0",
                              "last_batch_count":"INTEGER NOT NULL DEFAULT 0", "job_count":"INTEGER NOT NULL DEFAULT 0"}}
    for table, fields in upgrades.items():
        existing = {row[1] for row in db.execute(f"PRAGMA table_info({table})")}
        for name, definition in fields.items():
            if name not in existing:
                db.execute(f"ALTER TABLE {table} ADD COLUMN {name} {definition}")
    for row in db.execute("""SELECT o.*, w.config FROM observations o JOIN watches w ON w.id=o.watch_id
                            WHERE o.batch_id IS NULL""").fetchall():
        route_key = journeys.identity(json.loads(row["config"]), dict(row), json.loads(row["offer"])) if row["offer"] else None
        db.execute("UPDATE observations SET route_key=?,search_id=?,batch_id=? WHERE id=?",
                   (route_key, "airport:" + row["destination"], f"legacy:{row['id']}", row["id"]))
    db.execute("""UPDATE alerts SET route_key=(SELECT route_key FROM observations WHERE observations.id=alerts.observation_id)
                  WHERE route_key IS NULL""")
    db.execute("CREATE INDEX IF NOT EXISTS price_comparison ON observations(watch_id,route_key,status,id)")
