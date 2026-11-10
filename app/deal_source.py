"""One discovery request; transport and returned flight filtering stay at this boundary."""
import math
import json
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from . import locations, time_windows

# Shared across local discovery runs, rather than a new pool for each account.
POOL = ThreadPoolExecutor(max_workers=4, thread_name_prefix='fare-deal-source')


def query(config, origin, scope, kiwi_factory, accepts):
    fmt = lambda value: date.fromisoformat(value).strftime('%d/%m/%Y')
    args = dict(flyFrom=origin['code'], flyTo=scope['code'] if scope else 'anywhere',
                departureDate=fmt(config['start']), departureDateTo=fmt(config['end']),
                nights_in_dst_from=config['min_nights'], nights_in_dst_to=config['max_nights'],
                adults=config['adults'], currency=config['currency'], locale=config.get('locale', 'zh-CN'), cabinClass='M', sort='price',
                one_for_city=not config.get('nights') or len(config['nights']) == config['max_nights']-config['min_nights']+1, allow_self_transfer=False)
    if config.get('date_mode') == 'range' and config.get('trip_type') != 'oneway' and not config.get('nights'):
        args.pop('nights_in_dst_from', None)
        args.pop('nights_in_dst_to', None)
    if config.get('date_mode') == 'fixed':
        for key in ('departureDateTo', 'nights_in_dst_from', 'nights_in_dst_to'):
            args.pop(key)
        args['returnDate'] = fmt(config['end'])
        args['one_for_city'] = True
    if config.get('trip_type') == 'oneway':
        for key in ('returnDate', 'returnDateTo', 'nights_in_dst_from', 'nights_in_dst_to'):
            args.pop(key, None)
        args['one_for_city'] = True
    if config['max_stops'] >= 0:
        args['max_sector_stopovers'] = config['max_stops']
    if config['budget']:
        args['price_to'] = math.floor(config['budget'])
    if config['weekdays']:
        args['fly_days'] = ','.join(str((day+1) % 7) for day in config['weekdays'])
    if config.get('time_windows'):
        for key in ('nights_in_dst_from', 'nights_in_dst_to', 'fly_days'):
            args.pop(key, None)
        args.update(time_windows.arguments(config, fmt))
    if config.get('comparison'):
        args['one_for_city'] = False
    kiwi = kiwi_factory()
    kiwi.call(1, 'initialize', {'protocolVersion':'2025-06-18', 'capabilities':{},
                              'clientInfo':{'name':'fare-scout', 'version':'0.1'}})
    results = {}
    for offer in kiwi.query(args):
        if not accepts(offer, config, scope, origin):
            continue
        airport = locations.resolve('airport:' + offer['outbound']['to'])
        offer = dict(offer, currency=config['currency'], destination_name=locations.label(airport['code']),
                     destination_country=airport['country_name'])
        key = json.dumps([offer['outbound'], offer.get('inbound')], sort_keys=True) if config.get('comparison') else airport['city_code'] or airport['code']
        if key not in results or offer['price'] < results[key]['price']:
            results[key] = offer
    return results
