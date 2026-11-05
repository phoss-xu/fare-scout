-- Separate from permanent watch evidence and alert references. No historical prices invented.
CREATE TABLE price_series (
  user_id INTEGER NOT NULL REFERENCES users(id),
  id TEXT NOT NULL,
  identity TEXT NOT NULL,
  first_at TEXT NOT NULL,
  PRIMARY KEY(user_id,id)
);
CREATE TABLE price_samples (
  user_id INTEGER NOT NULL,
  series_id TEXT NOT NULL,
  checked_at TEXT NOT NULL,
  price REAL NOT NULL CHECK(price>0),
  quotes TEXT NOT NULL,
  PRIMARY KEY(user_id,series_id,checked_at),
  FOREIGN KEY(user_id,series_id) REFERENCES price_series(user_id,id) ON DELETE CASCADE
);
CREATE INDEX price_samples_expiry ON price_samples(checked_at);
