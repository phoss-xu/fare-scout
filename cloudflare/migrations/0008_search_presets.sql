CREATE TABLE IF NOT EXISTS search_presets (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  config TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  UNIQUE(user_id,config)
);
CREATE INDEX IF NOT EXISTS search_presets_owner ON search_presets(user_id,updated_at);
