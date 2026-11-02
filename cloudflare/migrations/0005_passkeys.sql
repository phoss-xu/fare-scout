ALTER TABLE users ADD COLUMN auth_handle TEXT;
CREATE UNIQUE INDEX user_auth_handle ON users(auth_handle) WHERE auth_handle IS NOT NULL;
CREATE TABLE passkeys (
 credential_id TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id),
 public_key TEXT NOT NULL, counter INTEGER NOT NULL DEFAULT 0,
 transports TEXT NOT NULL, device_type TEXT NOT NULL, backed_up INTEGER NOT NULL,
 created_at TEXT NOT NULL, last_used_at TEXT
);
CREATE INDEX passkey_user ON passkeys(user_id);
CREATE TABLE passkey_challenges (
 id TEXT PRIMARY KEY, challenge TEXT NOT NULL, kind TEXT NOT NULL,
 email TEXT, name TEXT, user_handle TEXT, origin TEXT NOT NULL, rp_id TEXT NOT NULL,
 expires_at REAL NOT NULL
);
CREATE INDEX passkey_challenge_expiry ON passkey_challenges(expires_at);
