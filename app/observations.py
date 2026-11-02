"""Persist a whole scope query as one batch, with distinct concrete journeys."""
import json
import uuid

from . import alerts, journeys


def record(db, watch_id, job, status, offers, timestamp):
    config = json.loads(db.execute("SELECT config FROM watches WHERE id=?", (watch_id,)).fetchone()[0])
    batch = uuid.uuid4().hex
    for offer in offers or [None]:
        destination = (offer.get("outbound") or {}).get("to") if offer else None
        actual_job = {**job, "destination": destination or job["destination"]}
        route_key = journeys.identity(config, actual_job, offer) if offer else None
        observation_id = db.execute("""INSERT INTO observations(watch_id,destination,departure,arrival,checked_at,status,
            offer,route_key,search_id,batch_id) VALUES(?,?,?,?,?,?,?,?,?,?)""",
            (watch_id, actual_job["destination"], job["departure"], job["arrival"], timestamp, status,
             json.dumps(offer) if offer else None, route_key, (job["origin_id"] + "|" if job.get("origin_id") and len(config.get("origin_locations", [])) > 1 else "") + (job.get("location_id") or "airport:" + job["destination"]), batch)).lastrowid
        if status == "ok" and offer:
            alerts.record(db, observation_id, watch_id, actual_job, offer, timestamp, route_key)
