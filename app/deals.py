"""Flexible round-trip discovery; never records observations or sends alerts."""
import math
from datetime import date, datetime, timedelta

from . import locations, location_scopes
from .domain import matches, today, validate as validate_watch
from .provider import Kiwi


def validate(data):
    date_mode = data.get('date_mode', 'range')
    if date_mode not in ('range', 'fixed'):
        raise ValueError('请选择固定往返或灵活日期。')
    raw = data.get('destinations', [])
    if not isinstance(raw, list) or len(raw) > 100:
        raise ValueError('每次最多选择 100 个目的地范围，也可以选择不限目的地。')
    origin_rows = location_scopes.selections(data.get('origins', [data.get('origin', 'airport:HKG')]))
    origins = location_scopes.expand(origin_rows)
    origin = origins[0]
    destination_rows = location_scopes.selections(raw) if raw else []
    scopes = location_scopes.expand(destination_rows)
    if len(origins) * max(1, len(scopes)) > 120:
        raise ValueError('这次选择超过 120 组出发地与目的地组合，请缩小范围。')
    try:
        start, end = date.fromisoformat(data['start']), date.fromisoformat(data['end'])
        low, high = int(data.get('min_nights', 2)), int(data.get('max_nights', 5))
        weekdays = data.get('weekdays', [])
        if not isinstance(weekdays, list) or any(type(d) is not int or d not in range(7) for d in weekdays):
            raise ValueError()
        base = validate_watch(dict(data, origins=[r['id'] for r in origin_rows], origin=origin['id'], destinations=[r['id'] for r in scopes] or ['country:JP'],
                                   mode='fixed', weeks=1))
    except (KeyError, TypeError, ValueError):
        raise ValueError('请检查地点、出发日期范围、人数、预算和筛选条件。') from None
    if start < today() or end < start or (end-start).days > 180 or end > today()+timedelta(days=365):
        raise ValueError('请选择未来一年内的出发时间，单次日期跨度不超过 180 天。')
    nights = data.get('nights', list(range(low, high + 1)) if 1 <= low <= high <= 10 else []) if date_mode == 'range' else []
    if date_mode == 'range' and (not isinstance(nights, list) or not nights or
                                any(type(n) is not int or not 1 <= n <= 10 for n in nights)):
        raise ValueError('请勾选 1–10 晚中的至少一项。')
    nights = sorted(set(nights))
    low, high = (min(nights), max(nights)) if nights else (0, 0)
    return dict(base, origin_locations=origins, origin_selections=origin_rows, destination_selections=destination_rows, destination_locations=scopes, destinations=[r['code'] for r in scopes],
                min_nights=low, max_nights=high, nights=nights, date_mode=date_mode,
                weekdays=sorted(set(weekdays)) if date_mode == 'range' else [])


def accepts(offer, config, scope, origin=None):
    try:
        out, back = offer['outbound'], offer['inbound']
        dep = datetime.fromisoformat(out['departureTime']).date()
        arrival = datetime.fromisoformat(out['arrivalTime']).date()
        ret = datetime.fromisoformat(back['departureTime']).date()
        fixed = config.get('date_mode') == 'fixed'
        if fixed and (dep.isoformat() != config['start'] or ret.isoformat() != config['end']):
            return False
        if not config['start'] <= dep.isoformat() <= config['end']:
            return False
        if config['weekdays'] and dep.weekday() not in config['weekdays']:
            return False
        if not fixed and (not config['min_nights'] <= (ret-arrival).days <= config['max_nights'] or
                          ('nights' in config and (ret-arrival).days not in config['nights'])):
            return False
        if not math.isfinite(offer['price']) or (config['budget'] and offer['price'] > config['budget']):
            return False
        target = scope or locations.resolve('airport:' + out['to'])
        job = dict(origin_id=(origin or config['origin_location'])['id'], location_id=target['id'], destination=target['code'], departure=dep.isoformat(), arrival=ret.isoformat())
        return matches(offer, config, job)
    except (KeyError, ValueError, TypeError):
        return False


def search(config, progress=lambda *_: None):
    scopes = config['destination_locations'] or [None]
    results, errors = {}, 0
    fmt = lambda value: date.fromisoformat(value).strftime('%d/%m/%Y')
    pairs = [(origin, scope) for origin in location_scopes.origins(config) for scope in scopes]
    for index, (origin, scope) in enumerate(pairs):
        args = dict(flyFrom=origin['code'], flyTo=scope['code'] if scope else 'anywhere',
                    departureDate=fmt(config['start']), departureDateTo=fmt(config['end']),
                    nights_in_dst_from=config['min_nights'], nights_in_dst_to=config['max_nights'],
                    adults=config['adults'], currency='HKD', cabinClass='M', sort='price',
                    one_for_city=len(config.get('nights', [])) == config['max_nights']-config['min_nights']+1, allow_self_transfer=False)
        if config.get('date_mode') == 'fixed':
            for key in ('departureDateTo', 'nights_in_dst_from', 'nights_in_dst_to'):
                args.pop(key)
            args['returnDate'] = fmt(config['end'])
            args['one_for_city'] = True
        if config['max_stops'] >= 0:
            args['max_sector_stopovers'] = config['max_stops']
        if config['budget']:
            args['price_to'] = math.floor(config['budget'])
        if config['weekdays']:
            args['fly_days'] = ','.join(str((day+1) % 7) for day in config['weekdays'])
        try:
            kiwi = Kiwi()
            kiwi.call(1, 'initialize', {'protocolVersion':'2025-06-18', 'capabilities':{},
                                      'clientInfo':{'name':'fare-scout', 'version':'0.1'}})
            offers = kiwi.query(args)
            for offer in offers:
                if not accepts(offer, config, scope, origin):
                    continue
                airport = locations.resolve('airport:' + offer['outbound']['to'])
                offer = dict(offer, destination_name=locations.label(airport['code']),
                             destination_country=airport['country_name'])
                key = airport['city_code'] or airport['code']
                if key not in results or offer['price'] < results[key]['price']:
                    results[key] = offer
        except Exception:
            import logging
            logging.exception('Deal source query failed for scope %s', scope['id'] if scope else 'anywhere')
            errors += 1
        progress(index+1, len(pairs))
    return dict(offers=sorted(results.values(), key=lambda o:o['price']), failures=errors,
                completed=len(pairs), total=len(pairs), source='Kiwi',
                checked_at=datetime.now().astimezone().isoformat())
