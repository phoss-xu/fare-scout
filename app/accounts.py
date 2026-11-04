"""Account creation, password authentication and local legacy-data activation."""
import hashlib
import secrets
import sqlite3
import time

from . import passwords, store
from .mail_config import valid_email


class AuthError(Exception):
    def __init__(self, message, status=401):
        super().__init__(message)
        self.status = status


def canonical_email(value):
    email = value.strip().casefold() if isinstance(value, str) else ""
    if not valid_email(email):
        raise ValueError("请输入有效的登录邮箱。")
    return email


def display_name(value, email):
    name = value.strip() if isinstance(value, str) else ""
    if len(name) > 40:
        raise ValueError("昵称最多 40 个字符。")
    return name or email.split("@")[0]


def public_user(row):
    return {key: row[key] for key in ("id", "email", "name", "notification_email")}


def throttle(email, ip):
    timestamp = time.time()
    blocked = False
    with store.connect() as db:
        db.execute("DELETE FROM auth_limits WHERE window_start<?", (timestamp - 900,))
        for key, limit in (("ip:" + ip, 30), ("account:" + canonical_email(email), 10)):
            key = hashlib.sha256(key.encode()).hexdigest()
            db.execute("""INSERT INTO auth_limits(key,count,window_start) VALUES(?,1,?)
                ON CONFLICT(key) DO UPDATE SET count=count+1""", (key, timestamp))
            blocked |= db.execute("SELECT count FROM auth_limits WHERE key=?", (key,)).fetchone()[0] > limit
    if blocked:
        raise AuthError("尝试次数较多，请 15 分钟后再试。", 429)


def register(data):
    email = canonical_email(data.get("email"))
    name = display_name(data.get("name"), email)
    password_hash = passwords.hash_password(passwords.validate(data.get("password")))
    try:
        with store.connect() as db:
            user_id = db.execute("""INSERT INTO users(email,name,password_hash,notification_email,created_at)
                 VALUES(?,?,?,?,?)""", (email, name, password_hash, email, store.now())).lastrowid
            return public_user(db.execute("SELECT * FROM users WHERE id=?", (user_id,)).fetchone())
    except sqlite3.IntegrityError:
        raise AuthError("该邮箱暂时无法注册，请尝试登录；已有本地账号请使用初始化入口。", 409) from None


def login(data):
    email = canonical_email(data.get("email"))
    with store.connect() as db:
        row = db.execute("SELECT * FROM users WHERE email=?", (email,)).fetchone()
    stored = row["password_hash"] if row else None
    if not passwords.verify(data.get("password"), stored):
        raise AuthError("邮箱或密码不正确。")
    return public_user(row)


def migrate_legacy(owner_email):
    """Called before serving requests; never assign legacy data to the first registrant."""
    email = canonical_email(owner_email)
    with store.connect() as db:
        if not db.execute("SELECT 1 FROM watches WHERE owner_id IS NULL LIMIT 1").fetchone():
            return
        row = db.execute("SELECT id FROM users WHERE email=?", (email,)).fetchone()
        if row:
            user_id = row["id"]
        else:
            recipient = db.execute("SELECT value FROM settings WHERE key='email_recipient'").fetchone()
            user_id = db.execute("""INSERT INTO users(email,name,notification_email,created_at) VALUES(?,?,?,?)""",
                                 (email, display_name(None, email), recipient[0] if recipient else email, store.now())).lastrowid
        db.execute("UPDATE watches SET owner_id=? WHERE owner_id IS NULL", (user_id,))


def setup_token(email, replace=True):
    """Local operator capability; not exposed through a public API."""
    token = secrets.token_urlsafe(32)
    with store.connect() as db:
        row = db.execute("SELECT id FROM users WHERE email=? AND password_hash IS NULL", (canonical_email(email),)).fetchone()
        if not row:
            return None
        if not replace and db.execute("SELECT 1 FROM setup_tokens WHERE user_id=? AND expires_at>?", (row["id"], time.time())).fetchone():
            return None
        db.execute("DELETE FROM setup_tokens WHERE user_id=?", (row["id"],))
        db.execute("INSERT INTO setup_tokens VALUES(?,?,?)", (hashlib.sha256(token.encode()).hexdigest(), row["id"], time.time() + 7200))
    return token


def recovery_token(email):
    """Issue a 15-minute password reset capability from the local terminal only."""
    token = secrets.token_urlsafe(32)
    with store.connect() as db:
        row = db.execute("SELECT id FROM users WHERE email=?", (canonical_email(email),)).fetchone()
        if not row:
            raise ValueError("该账号不存在。")
        db.execute("DELETE FROM setup_tokens WHERE user_id=?", (row["id"],))
        db.execute("INSERT INTO setup_tokens VALUES(?,?,?)", (hashlib.sha256(token.encode()).hexdigest(), row["id"], time.time() + 900))
    return token


def activate(data):
    token = data.get("token")
    if not isinstance(token, str) or len(token) > 128:
        raise AuthError("设置密码入口无效或已过期。", 400)
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    with store.connect() as db:
        row = db.execute("""SELECT u.* FROM setup_tokens t JOIN users u ON u.id=t.user_id
            WHERE t.token_hash=? AND t.expires_at>?""", (token_hash, time.time())).fetchone()
    if not row:
        raise AuthError("设置密码入口无效或已过期。", 400)
    hashed = passwords.hash_password(passwords.validate(data.get("password")))
    with store.connect() as db:
        # Conditional update ensures concurrent requests cannot reuse a setup capability.
        changed = db.execute("""UPDATE users SET password_hash=? WHERE id=?
            AND EXISTS(SELECT 1 FROM setup_tokens WHERE token_hash=? AND expires_at>?)""",
                             (hashed, row["id"], token_hash, time.time())).rowcount
        if not changed:
            raise AuthError("设置密码入口已使用，请直接登录。", 400)
        db.execute("DELETE FROM setup_tokens WHERE user_id=?", (row["id"],))
        db.execute("DELETE FROM sessions WHERE user_id=?", (row["id"],))
    return public_user(row)


def set_password(email, password):
    """Local operator action; not reachable through an HTTP route."""
    hashed = passwords.hash_password(passwords.validate(password))
    with store.connect() as db:
        row = db.execute("SELECT id FROM users WHERE email=?", (canonical_email(email),)).fetchone()
        if not row:
            raise ValueError("该账号不存在。")
        db.execute("UPDATE users SET password_hash=? WHERE id=?", (hashed, row["id"]))
        db.execute("DELETE FROM sessions WHERE user_id=?", (row["id"],))
        db.execute("DELETE FROM setup_tokens WHERE user_id=?", (row["id"],))


if __name__ == "__main__":
    import argparse
    import getpass
    parser = argparse.ArgumentParser(description="本机账号管理")
    parser.add_argument("command", choices=["set-password", "reset-password-link"])
    parser.add_argument("email")
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()
    if args.command == "reset-password-link":
        token = recovery_token(args.email)
        print(f"重设密码入口（15 分钟内有效，仅可使用一次）：http://localhost:{args.port}/setup#token={token}")
    else:
        set_password(args.email, getpass.getpass("新密码（输入隐藏）："))
        print("密码已设置，旧会话和初始化入口已失效。")
