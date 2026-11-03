CREATE TABLE IF NOT EXISTS saved_trips (
  user_id INTEGER NOT NULL, trip_key TEXT NOT NULL, snapshot TEXT NOT NULL,
  saved_at TEXT NOT NULL, PRIMARY KEY(user_id,trip_key)
);
CREATE INDEX IF NOT EXISTS saved_trips_owner ON saved_trips(user_id,saved_at);
CREATE TABLE IF NOT EXISTS shared_trips (
  id TEXT PRIMARY KEY, user_id INTEGER NOT NULL, trip_key TEXT NOT NULL,
  snapshot TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(user_id,trip_key,snapshot)
);
CREATE INDEX IF NOT EXISTS shared_trips_owner ON shared_trips(user_id);
