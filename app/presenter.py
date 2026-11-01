"""User-scoped state and only the location labels needed by that user's records."""
from . import locations, store
from .domain import today


def state(user):
    data = store.snapshot(user["id"])
    codes = set()
    for watch in data["watches"]:
        codes.update([watch["origin"], *watch["destinations"]])
    for row in data["observations"]:
        codes.add(row["destination"])
        if row["offer"]:
            for leg in (row["offer"].get("outbound") or {}, row["offer"].get("inbound") or {}):
                codes.update([leg.get("from"), leg.get("to")])
    return {**data, "user": user, "today": today().isoformat(), "location_stats": locations.stats(),
            "destinations": {code: locations.label(code) for code in codes if code}}
