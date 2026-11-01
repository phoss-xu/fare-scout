"""Persistent local watch and per-route/date observation storage."""
import json
import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path

from . import alerts, observations, schema
from .policy import validate_settings
from .mail_config import public_status, valid_email

DB = Path(os.environ.get("FARE_SCOUT_DB", Path(__file__).resolve().parents[1] / "fare_scout.db"))


def now():
    return datetime.now(timezone.utc).isoformat()


@contextmanager
def connect():
    connection = sqlite3.connect(DB, timeout=15)
    connection.row_factory = sqlite3.Row
    try:
        with connection:
            yield connection
    finally:
        connection.close()


def initialize():
    with connect() as db:
        schema.initialize(db)
        for row in db.execute("""SELECT w.id, w.created_at, MAX(o.checked_at) AS latest
                FROM watches w LEFT JOIN observations o ON o.watch_id=w.id GROUP BY w.id""").fetchall():
            due = datetime.fromisoformat(row["latest"] or row["created_at"]) + timedelta(hours=6)
            db.execute("INSERT OR IGNORE INTO schedules(watch_id,next_check) VALUES(?,?)",
                       (row["id"], due.isoformat()))
        # This process owns all local work; interrupted runs become retryable on restart.
        db.execute("UPDATE watches SET running=0")
        db.execute("UPDATE schedules SET next_check=? WHERE next_check IS NULL AND last_status IS NOT 'expired'", (now(),))
    DB.chmod(0o600)


def create(config, user_id=None):
    with connect() as db:
        watch_id = db.execute("INSERT INTO watches(config,created_at,owner_id) VALUES (?,?,?)",
                              (json.dumps(config), now(), user_id)).lastrowid
        policy = validate_settings(config)
        db.execute("""INSERT INTO schedules(watch_id,auto_enabled,alerts_enabled,interval_hours,min_drop,next_check)
                   VALUES(?,?,?,?,?,?)""", (watch_id, policy["auto_enabled"], policy["alerts_enabled"],
                                           policy["interval_hours"], policy["min_drop"], now()))
        return watch_id


def decode_watch(row):
    result = {**json.loads(row["config"]), **{k: row[k] for k in row.keys() if k != "config"}}
    for key in ("running", "auto_enabled", "alerts_enabled"):
        result[key] = bool(result[key])
    return result


WATCH_SELECT = "SELECT w.*, s.* FROM watches w JOIN schedules s ON w.id=s.watch_id"


def watch(watch_id, user_id=None):
    with connect() as db:
        scope = " AND w.owner_id=?" if user_id is not None else ""
        params = (watch_id, user_id) if user_id is not None else (watch_id,)
        row = db.execute(WATCH_SELECT + " WHERE w.id=?" + scope, params).fetchone()
        return decode_watch(row) if row else None


def claim(watch_id):
    with connect() as db:
        claimed = db.execute("UPDATE watches SET running=1 WHERE id=? AND running=0", (watch_id,)).rowcount == 1
        if claimed:
            db.execute("UPDATE schedules SET last_started=?,next_check=NULL WHERE watch_id=?", (now(), watch_id))
        return claimed


def finish(watch_id, status="ok", cursor=None, completed=0, total=0):
    with connect() as db:
        db.execute("UPDATE watches SET running=0 WHERE id=?", (watch_id,))
        policy = db.execute("SELECT * FROM schedules WHERE watch_id=?", (watch_id,)).fetchone()
        failures = min(policy["failure_count"] + 1, 8) if status == "error" else 0
        minutes = min(policy["interval_hours"] * 60, 15 * 2 ** (failures - 1)) if failures else policy["interval_hours"] * 60
        due = None if status == "expired" else (datetime.now(timezone.utc) + timedelta(minutes=minutes)).isoformat()
        db.execute("""UPDATE schedules SET last_finished=?,last_status=?,failure_count=?,next_check=?
                      WHERE watch_id=?""", (now(), status, failures, due, watch_id))
        if cursor is not None:
            db.execute("UPDATE schedules SET query_cursor=?,last_batch_count=?,job_count=? WHERE watch_id=?",
                       (cursor, completed, total, watch_id))


def observe(watch_id, job, status, offer=None):
    observe_batch(watch_id, job, status, [offer] if offer else [])


def observe_batch(watch_id, job, status, offers):
    with connect() as db:
        observations.record(db, watch_id, job, status, offers, now())


def update_settings(watch_id, data, user_id=None):
    policy = validate_settings(data)
    with connect() as db:
        scope = " AND watch_id IN (SELECT id FROM watches WHERE owner_id=?)" if user_id is not None else ""
        params = (watch_id, user_id) if user_id is not None else (watch_id,)
        existing = db.execute("SELECT * FROM schedules WHERE watch_id=?" + scope, params).fetchone()
        if not existing:
            return False
        due = existing["next_check"]
        if policy["auto_enabled"] and (not existing["auto_enabled"] or existing["interval_hours"] != policy["interval_hours"]):
            base = datetime.fromisoformat(existing["last_finished"]) if existing["last_finished"] else datetime.now(timezone.utc)
            due = (base + timedelta(hours=policy["interval_hours"])).isoformat()
        db.execute("""UPDATE schedules SET auto_enabled=?,alerts_enabled=?,interval_hours=?,min_drop=?,next_check=?
                      WHERE watch_id=?""", (policy["auto_enabled"], policy["alerts_enabled"], policy["interval_hours"],
                                            policy["min_drop"], due, watch_id))
        return True


def mark_read(through_id, user_id=None):
    if not isinstance(through_id, int) or isinstance(through_id, bool) or through_id < 1:
        raise ValueError("请选择有效的提醒记录。")
    with connect() as db:
        scope = " AND watch_id IN (SELECT id FROM watches WHERE owner_id=?)" if user_id is not None else ""
        params = (now(), through_id, user_id) if user_id is not None else (now(), through_id)
        db.execute("UPDATE alerts SET read_at=? WHERE id<=? AND read_at IS NULL" + scope, params)


def email_recipient(user_id=None):
    with connect() as db:
        if user_id is not None:
            row = db.execute("SELECT notification_email FROM users WHERE id=?", (user_id,)).fetchone()
            return row[0] if row else ""
        row = db.execute("SELECT value FROM settings WHERE key='email_recipient'").fetchone()
        return row[0] if row else os.environ.get("FARE_SCOUT_EMAIL_TO", "").strip()


def set_recipient(address, user_id=None):
    address = address.strip() if isinstance(address, str) else ""
    if not valid_email(address):
        raise ValueError("请输入有效的收件邮箱。")
    with connect() as db:
        if user_id is not None:
            db.execute("UPDATE users SET notification_email=? WHERE id=?", (address, user_id))
        else:
            db.execute("INSERT OR REPLACE INTO settings(key,value) VALUES('email_recipient',?)", (address,))


def snapshot(user_id=None):
    with connect() as db:
        scope, params = (" WHERE w.owner_id=?", (user_id,)) if user_id is not None else ("", ())
        watches = [decode_watch(row) for row in db.execute(WATCH_SELECT + scope + " ORDER BY w.id DESC", params)]
        observations = [{**dict(row), "offer": json.loads(row["offer"]) if row["offer"] else None}
                        for row in db.execute("SELECT o.* FROM observations o JOIN watches w ON w.id=o.watch_id" + scope + " ORDER BY o.id DESC", params)]
        notifications = alerts.list_alerts(db, user_id)
    return {"watches": watches, "observations": observations, "alerts": notifications,
            "email": public_status(email_recipient(user_id))}
