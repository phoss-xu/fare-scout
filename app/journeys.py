"""Comparable prices share actual airports and actual local travel dates."""
import json


def identity(config, job, offer):
    out, back = offer.get("outbound") or {}, offer.get("inbound") or {}
    return json.dumps([out.get("from") or config["origin"], out.get("to") or job["destination"],
                       back.get("from") or job["destination"], back.get("to") or config["origin"],
                       (out.get("departureTime") or job["departure"])[:10],
                       (back.get("departureTime") or job["arrival"])[:10],
                       (back.get("arrivalTime") or job["arrival"])[:10]], separators=(",", ":"))
