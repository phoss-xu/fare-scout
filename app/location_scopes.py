"""Expand user-selected ranges into canonical, deduplicated query scopes."""
from . import locations


def group_record(identity):
    from . import location_groups
    key = identity[len('group:'):]
    data = location_groups.group(key)
    countries = [r for s in data['sections'] for r in s['locations'] if r['kind'] == 'country']
    if not countries:
        raise ValueError('此分类仅供浏览，请选择其中的具体地点。')
    return dict(id=identity, kind='group', code=f'{len(countries)} 国/地区', name='免签精选' if key == 'visa-free' else data['label'],
                english_name=data['label'], members=[r['id'] for r in countries],
                country_name='', city_name='', airport_count=sum(r['airport_count'] for r in countries))


def selections(raw, limit=100):
    if not isinstance(raw, list) or not 1 <= len(raw) <= limit:
        raise ValueError(f'请至少选择一个地点范围，最多 {limit} 个。')
    return list({r['id']:r for r in map(locations.resolve, raw)}.values())


def expand(rows):
    members = {r['id']:r for row in rows for r in
               ([locations.resolve(i) for i in row['members']] if row['kind'] == 'group' else [row])}
    result = list(members.values())
    if len(result) > 100:
        raise ValueError('展开后超过 100 个地点范围，请缩小选择。')
    return result


def origins(config):
    return config.get('origin_locations') or [locations.origin(config)]
