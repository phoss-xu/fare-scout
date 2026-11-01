"""Opaque server-side sessions with hashed tokens and per-session CSRF tokens."""
import hashlib
import hmac
import secrets
import time
from http.cookies import CookieError, SimpleCookie

from . import store
from .accounts import public_user

LIFETIME = 7 * 24 * 3600
COOKIE = "fare_session"


def token_from_cookie(header):
    try:
        cookies = SimpleCookie(header or "")
        return cookies[COOKIE].value if COOKIE in cookies else ""
    except CookieError:
        return ""


def issue(user_id, old_token=""):
    token, csrf = secrets.token_urlsafe(32), secrets.token_urlsafe(32)
    with store.connect() as db:
        db.execute("DELETE FROM sessions WHERE expires_at<=? OR token_hash=?", (time.time(), digest(old_token)))
        db.execute("INSERT INTO sessions VALUES(?,?,?,?)", (digest(token), user_id, csrf, time.time() + LIFETIME))
    return token, csrf


def digest(token):
    return hashlib.sha256(token.encode()).hexdigest()


def current(token):
    if not token or len(token) > 128:
        return None
    with store.connect() as db:
        row = db.execute("""SELECT u.*, s.csrf_token FROM sessions s JOIN users u ON u.id=s.user_id
           WHERE s.token_hash=? AND s.expires_at>? AND u.password_hash IS NOT NULL""", (digest(token), time.time())).fetchone()
    return {"user": public_user(row), "csrf_token": row["csrf_token"]} if row else None


def valid_csrf(session, supplied):
    return isinstance(supplied, str) and hmac.compare_digest(session["csrf_token"].encode(), supplied.encode())


def revoke(token):
    with store.connect() as db:
        db.execute("DELETE FROM sessions WHERE token_hash=?", (digest(token),))


def cookie_header(token, secure=False):
    value = f"{COOKIE}={token}; Path=/; Max-Age={LIFETIME if token else 0}; HttpOnly; SameSite=Lax"
    return value + ("; Secure" if secure else "")
