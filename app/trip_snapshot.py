"""Whitelist public quote data; never persist account preferences in a share."""
import json
import math
import re
from datetime import datetime
from urllib.parse import urlsplit


def check(ok):
    if not ok:
        raise ValueError('行程信息不完整，请重新查询后再试。')


def text(value, maximum=160):
    check(isinstance(value, str) and len(value) <= maximum)
    return value


def clock(value):
    text(value, 40)
    check(re.match(r'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}', value))
    datetime.fromisoformat(value.replace('Z', '+00:00'))
    return value


def leg(value, segment=False):
    check(isinstance(value, dict))
    result = {}
    for key in ('from', 'to'):
        check(isinstance(value.get(key), str) and re.fullmatch('[A-Z]{3}', value[key]))
        result[key] = value[key]
    check(result['from'] != result['to'])
    for key in ('departureTime', 'arrivalTime'):
        result[key] = clock(value.get(key))
    if value.get('durationSeconds') is not None:
        n = value['durationSeconds']
        check(type(n) in (int, float) and math.isfinite(n) and n > 0)
        result['durationSeconds'] = n
    for key in ('fromCity', 'toCity', 'fromName', 'toName', 'fromCountry', 'toCountry', 'carrier', 'carrierName', 'flightNumber', 'cabinClass'):
        if value.get(key) is not None:
            result[key] = text(value[key])
    if not segment:
        n = value.get('stops')
        check(type(n) is int and 0 <= n <= 10)
        result['stops'] = n
        check(isinstance(value.get('segments'), list) and len(value['segments']) <= 12)
        result['segments'] = [leg(s, True) for s in value['segments']]
    return result


def snapshot(data):
    check(isinstance(data, dict) and isinstance(data.get('offer'), dict))
    o = data['offer']
    n = o.get('price')
    check(type(n) in (int, float) and math.isfinite(n) and 0 < n <= 10000000)
    check(type(data.get('adults')) is int and 1 <= data['adults'] <= 9)
    check(data.get('currency', 'HKD') in ('HKD','CNY','USD','EUR','JPY','GBP','SGD','AUD','CAD') and data.get('cabin', 'M') == 'M')
    offer = dict(price=n, outbound=leg(o.get('outbound')))
    if data.get('currency', 'HKD') != 'HKD':
        offer['currency'] = data['currency']
    if o.get('inbound'):
        offer['inbound'] = leg(o['inbound'])
    if o.get('bookingUrl'):
        link = text(o['bookingUrl'], 2048)
        url = urlsplit(link)
        check(url.scheme == 'https' and url.hostname and not url.username and not url.password)
        offer['bookingUrl'] = link
    for key in ('destination_name', 'destination_country'):
        if o.get(key) is not None:
            offer[key] = text(o[key])
    offer['baggage'] = {}
    for key in ('personalItem', 'cabinBag', 'checkedBag'):
        n = (o.get('baggage') or {}).get(key)
        if n is not None:
            check(type(n) is int and 0 <= n <= 20)
            offer['baggage'][key] = n
    checked = data.get('checked_at')
    if checked is not None:
        text(checked, 40)
        datetime.fromisoformat(checked.replace('Z', '+00:00'))
    f = data.get('filters') or {}
    check(isinstance(f, dict))
    stops, hours = f.get('max_stops', -1), f.get('max_duration_hours', 0)
    check(type(stops) is int and stops in (-1, 0, 1, 2, 3) and type(hours) in (int, float) and math.isfinite(hours) and 0 <= hours <= 72)
    return dict(offer=offer, adults=data['adults'], currency=data.get('currency', 'HKD'), cabin='M', checked_at=checked,
                filters=dict(max_stops=stops, max_duration_hours=hours))


def identity(s):
    legs = [[l['from'], l['to'], l['departureTime'], l['arrivalTime'], l.get('cabinClass', ''),
             [[v['from'], v['to'], v['departureTime'], v['arrivalTime'], v.get('carrier', ''), v.get('flightNumber', ''), v.get('cabinClass', '')] for v in l['segments']]]
            for l in (s['offer']['outbound'], s['offer'].get('inbound')) if l]
    return json.dumps([s['adults'], s['cabin'], s['currency'], *legs], separators=(',', ':'), ensure_ascii=False)
