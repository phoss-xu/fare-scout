"""Validate watch conditions and expand bounded search jobs."""
import math
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from .policy import validate_settings
from . import locations, location_scopes

def today():
    return datetime.now(ZoneInfo("Asia/Shanghai")).date()


def validate(data):
    trip_type = data.get('trip_type', 'roundtrip')
    if trip_type not in ('roundtrip', 'oneway'):
        raise ValueError('请选择有效的行程类型。')
    if trip_type == 'oneway':
        if data.get('mode', 'fixed') != 'fixed':
            raise ValueError('单程提醒请选择固定出发日期。')
        data = {**data, 'end': data.get('start')}
    origin_selections = location_scopes.selections(data.get("origins", [data.get("origin", "HKG")]))
    destination_selections = location_scopes.selections(data.get("destinations", []))
    origins = location_scopes.expand(origin_selections)
    destinations = location_scopes.expand(destination_selections)
    origin = origins[0]
    if len(origins) == len(destinations) == 1 and origin['kind'] == 'airport' and origin['id'] == destinations[0]['id']:
        raise ValueError("出发机场和目的机场不能相同。")
    currency = data.get("currency", "HKD")
    if currency not in ("HKD", "CNY", "USD", "EUR", "JPY", "GBP", "SGD", "AUD", "CAD"):
        raise ValueError("请选择支持的报价货币。")
    mode = data.get("mode", "fixed")
    if mode not in {"fixed", "weekend"}:
        raise ValueError("请选择固定日期或周末出行。")
    try:
        start = date.fromisoformat(data["start"])
        end = date.fromisoformat(data["end"])
        adults = int(data.get("adults", 1))
        weeks = int(data.get("weeks", 1))
        budget = float(data.get("budget", 0) or 0)
        max_duration = float(data.get("max_duration_hours", 0) or 0)
        max_stops = int(data.get("max_stops", -1))
    except (KeyError, TypeError, ValueError):
        raise ValueError("请检查日期、人数、周末数量和预算。") from None
    if start < today() or end < start:
        raise ValueError("出发日期不能早于今天，返程日期不能早于出发日期。")
    if not 1 <= adults <= 9 or not 1 <= weeks <= 4:
        raise ValueError("成人数须为 1–9，周末数量须为 1–4。")
    if not math.isfinite(budget) or budget < 0 or budget > 1000000:
        raise ValueError("请输入有效的往返总预算。")
    if not math.isfinite(max_duration) or not 0 <= max_duration <= 72 or max_stops not in (-1, 0, 1, 2, 3):
        raise ValueError("请检查每程最长时长或中转次数。")
    return dict(**({'trip_type': 'oneway'} if trip_type == 'oneway' else {}), origin=origin["code"], destinations=[d["code"] for d in destinations], mode=mode,
                origin_location=origin, origin_locations=origins, destination_locations=destinations,
                origin_selections=origin_selections, destination_selections=destination_selections,
                max_duration_hours=max_duration, max_stops=max_stops,
                start=start.isoformat(), end=end.isoformat(), adults=adults,
                weeks=weeks, budget=budget, currency=currency, cabin="M", **validate_settings(data))


def jobs(watch):
    start = date.fromisoformat(watch["start"])
    if watch["mode"] == "weekend":
        first = start + timedelta(days=(5 - start.weekday()) % 7)
        dates = [(first + timedelta(weeks=i), first + timedelta(weeks=i, days=2))
                 for i in range(watch["weeks"])]
    else:
        dates = [(start, date.fromisoformat(watch["end"]))]
    return [dict(destination=d["code"], location_id=d["id"], origin_id=o["id"], departure=s.isoformat(), arrival=e.isoformat())
            for s, e in dates for o in location_scopes.origins(watch) for d in locations.destinations(watch)
            if not (o["kind"] == d["kind"] == "airport" and o["id"] == d["id"])]


def matches(offer, watch, job):
    if watch.get('trip_type') == 'oneway':
        from .oneway import accepts
        config = {**watch, 'start': job['departure'], 'end': job['departure'], 'date_mode': 'fixed', 'weekdays': [], 'budget': 0}
        return accepts(offer, config, locations.resolve(job.get('location_id') or job['destination']),
                       locations.resolve(job['origin_id']) if job.get('origin_id') else locations.origin(watch))
    outbound, inbound = offer.get("outbound") or {}, offer.get("inbound") or {}
    try:
        price = offer["price"]
        if isinstance(price, bool) or not isinstance(price, (int, float)) or not math.isfinite(price) or price <= 0:
            return False
        departure_scope = locations.resolve(job["origin_id"]) if job.get("origin_id") else locations.origin(watch)
        arrival_scope = locations.resolve(job.get("location_id") or job["destination"])
        if not locations.contains(departure_scope, outbound.get("from")) or not locations.contains(arrival_scope, outbound.get("to")):
            return False
        if not locations.contains(arrival_scope, inbound.get("from")) or not locations.contains(departure_scope, inbound.get("to")):
            return False
        if outbound.get("from") == outbound.get("to"):
            return False
        dep = datetime.fromisoformat(outbound["departureTime"])
        ret = datetime.fromisoformat(inbound["departureTime"])
        arr = datetime.fromisoformat(inbound["arrivalTime"])
        if dep.date().isoformat() != job["departure"]:
            return False
        if watch["mode"] == "fixed" and ret.date().isoformat() != job["arrival"]:
            return False
        if watch["mode"] == "weekend" and (dep.hour >= 6 or arr.hour >= 6 or arr.date().isoformat() != job["arrival"]):
            return False
        stop_limit, hours = watch.get("max_stops", 1), watch.get("max_duration_hours", 8)
        return all(leg["stops"] >= 0 and (stop_limit < 0 or leg["stops"] <= stop_limit)
                   and leg["durationSeconds"] > 0 and (not hours or leg["durationSeconds"] <= hours * 3600)
                   for leg in (outbound, inbound))
    except (KeyError, TypeError, ValueError):
        return False
