-- Provider state is scoped to the Cloudflare account and exact normalized recipient.
-- Never infer verification from a login, a saved email, or a different recipient.
CREATE TABLE email_destinations (
 account_id TEXT NOT NULL, email TEXT NOT NULL, destination_id TEXT,
 verified_at TEXT, checked_at TEXT, requested_at TEXT, check_error INTEGER NOT NULL DEFAULT 0,
 lease_token TEXT, lease_until TEXT, PRIMARY KEY(account_id,email)
);
CREATE TABLE email_verification_limits (
 key TEXT PRIMARY KEY, count INTEGER NOT NULL, window_start REAL NOT NULL
);
-- Account-wide provider verification is not proof for an individual app account.
CREATE TABLE email_consents (
 user_id INTEGER NOT NULL REFERENCES users(id), account_id TEXT NOT NULL, email TEXT NOT NULL,
 token_hash TEXT, expires_at REAL, requested_at REAL, confirmed_at TEXT,
 PRIMARY KEY(user_id,account_id,email)
);
