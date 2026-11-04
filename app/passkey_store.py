"""Local passkey public credentials and browser/session-bound one-time challenges."""
import json
import secrets
import time
from http.cookies import SimpleCookie, CookieError

from . import accounts, sessions, store

FLOW = 'fare_passkey_flow'


def initialize(db):
    db.executescript('''
      CREATE TABLE IF NOT EXISTS local_passkey_users (
        user_id INTEGER PRIMARY KEY, user_handle TEXT NOT NULL UNIQUE);
      CREATE TABLE IF NOT EXISTS local_passkeys (
        credential_id TEXT PRIMARY KEY, user_id INTEGER NOT NULL, rp_id TEXT NOT NULL,
        public_key TEXT NOT NULL, counter INTEGER NOT NULL, transports TEXT NOT NULL,
        created_at TEXT NOT NULL, last_used_at TEXT);
      CREATE INDEX IF NOT EXISTS local_passkeys_owner ON local_passkeys(user_id,rp_id);
      CREATE TABLE IF NOT EXISTS local_passkey_challenges (
        token_hash TEXT PRIMARY KEY, challenge TEXT NOT NULL, kind TEXT NOT NULL,
        user_id INTEGER, session_hash TEXT NOT NULL, origin TEXT NOT NULL,
        rp_id TEXT NOT NULL, expires_at REAL NOT NULL);
    ''')


def flow_token(handler):
    try:
        cookie = SimpleCookie(handler.headers.get('Cookie', ''))
        return cookie[FLOW].value if FLOW in cookie else ''
    except CookieError:
        return ''


def cookie(value):
    return f'{FLOW}={value}; Path=/api/auth/passkey; Max-Age={300 if value else 0}; HttpOnly; SameSite=Strict'


def keys(user_id, rp_id):
    with store.connect() as db:
        return [dict(r) for r in db.execute('SELECT * FROM local_passkeys WHERE user_id=? AND rp_id=?', (user_id, rp_id))]


def user_handle(user_id):
    with store.connect() as db:
        db.execute('INSERT OR IGNORE INTO local_passkey_users VALUES(?,?)', (user_id, secrets.token_urlsafe(32)))
        return db.execute('SELECT user_handle FROM local_passkey_users WHERE user_id=?', (user_id,)).fetchone()[0]


def save_flow(handler, challenge, kind, user_id, origin, rp_id):
    token = secrets.token_urlsafe(32)
    session_hash = sessions.digest(sessions.token_from_cookie(handler.headers.get('Cookie'))) if user_id else ''
    with store.connect() as db:
        db.execute('DELETE FROM local_passkey_challenges WHERE expires_at<=? OR token_hash=?', (time.time(), sessions.digest(flow_token(handler))))
        db.execute('INSERT INTO local_passkey_challenges VALUES(?,?,?,?,?,?,?,?)',
                   (sessions.digest(token), challenge, kind, user_id, session_hash, origin, rp_id, time.time()+300))
    return token


def consume(handler, kind, user_id, origin, rp_id):
    with store.connect() as db:
        row = db.execute('DELETE FROM local_passkey_challenges WHERE token_hash=? RETURNING *', (sessions.digest(flow_token(handler)),)).fetchone()
    session_hash = sessions.digest(sessions.token_from_cookie(handler.headers.get('Cookie'))) if user_id else ''
    if not row or row['expires_at']<=time.time() or any((row[k]!=v for k, v in (
        ('kind', kind), ('user_id', user_id), ('origin', origin), ('rp_id', rp_id), ('session_hash', session_hash)))):
        raise accounts.AuthError('通行密钥验证已过期或已使用，请重试。', 400)
    return dict(row)


def save_key(user_id, rp_id, credential):
    with store.connect() as db:
        db.execute('INSERT INTO local_passkeys VALUES(?,?,?,?,?,?,?,NULL)',
                   (credential['id'], user_id, rp_id, credential['publicKey'], credential['counter'], json.dumps(credential.get('transports', [])), store.now()))
