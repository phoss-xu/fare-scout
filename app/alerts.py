"""Transactional, persistent alerts. Never sends an external notification."""
import json


def initialize(db):
    db.executescript("""
      CREATE TABLE IF NOT EXISTS alerts (
        id INTEGER PRIMARY KEY, observation_id INTEGER NOT NULL UNIQUE,
        watch_id INTEGER NOT NULL, destination TEXT NOT NULL,
        departure TEXT NOT NULL, arrival TEXT NOT NULL, created_at TEXT NOT NULL,
        reason TEXT NOT NULL, price REAL NOT NULL, previous_price REAL,
        booking_url TEXT, read_at TEXT);
      CREATE INDEX IF NOT EXISTS alert_watch ON alerts(watch_id, destination, departure, arrival);
    """)


def record(db, observation_id, watch_id, job, offer, timestamp, route_key):
    watch = db.execute("SELECT config FROM watches WHERE id=?", (watch_id,)).fetchone()
    policy = db.execute("SELECT * FROM schedules WHERE watch_id=?", (watch_id,)).fetchone()
    if not policy["alerts_enabled"]:
        return
    config = json.loads(watch["config"])
    key = (watch_id, job["destination"], job["departure"], job["arrival"])
    prior = db.execute("""SELECT offer FROM observations WHERE watch_id=? AND route_key=?
        AND status='ok' AND id<? ORDER BY id DESC LIMIT 1""", (watch_id, route_key, observation_id)).fetchone()
    previous_price = json.loads(prior["offer"])["price"] if prior else None
    price = offer["price"]
    drop = previous_price is not None and previous_price - price >= policy["min_drop"]
    budget = config["budget"]
    crossing = budget > 0 and price <= budget and (previous_price is None or previous_price > budget)
    if not (drop or crossing):
        return
    notified = db.execute("SELECT MIN(price) FROM alerts WHERE watch_id=? AND route_key=?", (watch_id, route_key)).fetchone()[0]
    # Rebounds and identical prices must not repeatedly remind the user.
    if notified is not None and price >= notified:
        return
    db.execute("""INSERT INTO alerts(observation_id,watch_id,destination,departure,arrival,
        created_at,reason,price,previous_price,booking_url,route_key) VALUES(?,?,?,?,?,?,?,?,?,?,?)""",
               (observation_id, *key, timestamp, "budget" if crossing else "drop",
                price, previous_price, offer.get("bookingUrl"), route_key))
    alert_id = db.execute("SELECT id FROM alerts WHERE observation_id=?", (observation_id,)).fetchone()[0]
    db.execute("INSERT INTO email_outbox(alert_id,status,next_attempt) VALUES(?,'pending',?)", (alert_id, timestamp))


def list_alerts(db, user_id=None):
    scope = " WHERE w.owner_id=?" if user_id is not None else ""
    return [dict(row) for row in db.execute("""SELECT a.*, q.status AS email_status FROM alerts a
        JOIN watches w ON w.id=a.watch_id LEFT JOIN email_outbox q ON q.alert_id=a.id"""
        + scope + " ORDER BY a.id DESC", (user_id,) if user_id is not None else ())]
