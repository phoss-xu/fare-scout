"""One-way discovery filtering; return watches retain their existing contract."""
import math
from datetime import datetime
from . import locations


def accepts(offer, config, scope, origin=None):
    try:
        out = offer['outbound']
        if offer.get('inbound'):
            return False
        dep = datetime.fromisoformat(out['departureTime']).date()
        datetime.fromisoformat(out['arrivalTime'])
        if not config['start'] <= dep.isoformat() <= config['end']:
            return False
        if config['date_mode'] == 'fixed' and dep.isoformat() != config['start']:
            return False
        if config['weekdays'] and dep.weekday() not in config['weekdays']:
            return False
        price = offer['price']
        if isinstance(price, bool) or not isinstance(price, (int, float)) or not math.isfinite(price) or price <= 0 or (config['budget'] and price > config['budget']):
            return False
        target = scope or locations.resolve('airport:' + out['to'])
        if not locations.contains(origin or config['origin_location'], out['from']) or not locations.contains(target, out['to']) or out['from'] == out['to']:
            return False
        return (type(out['stops']) is int and out['stops'] >= 0 and
                (config['max_stops'] < 0 or out['stops'] <= config['max_stops']) and
                type(out['durationSeconds']) in (int, float) and math.isfinite(out['durationSeconds']) and out['durationSeconds'] > 0 and
                (not config['max_duration_hours'] or out['durationSeconds'] <= config['max_duration_hours'] * 3600))
    except (KeyError, TypeError, ValueError):
        return False
