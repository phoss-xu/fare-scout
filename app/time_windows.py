"""Airport-local civil time windows for discovery and saved searches."""
from datetime import datetime, date, timedelta
import re


def validate(raw, one_way):
    def window(value):
        if not isinstance(value, dict):
            raise ValueError('请设置完整的时间范围。')
        for edge in ('start', 'end'):
            text = value.get(edge)
            if not isinstance(text, str) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}', text):
                raise ValueError('请选择完整的日期和时刻。')
            datetime.fromisoformat(text)
        if value['end'] < value['start']:
            raise ValueError('最晚时间不能早于最早时间，跨午夜请调整结束日期。')
        return {edge: value[edge] for edge in ('start', 'end')}
    if not isinstance(raw, dict):
        raise ValueError('请设置去程和返程时间范围。')
    result = {'outbound': window(raw.get('outbound'))}
    if not one_way:
        result['inbound'] = window(raw.get('inbound'))
        basis = raw['inbound'].get('basis')
        if basis not in ('departure', 'arrival'):
            raise ValueError('请选择返程起飞或抵达时间。')
        result['inbound']['basis'] = basis
    return result


def accepts(offer, config):
    for leg, window in config.get('time_windows', {}).items():
        if not isinstance(offer, dict) or not isinstance(offer.get(leg), dict):
            return False
        key = 'arrivalTime' if window.get('basis') == 'arrival' else 'departureTime'
        value = offer[leg].get(key)
        if not isinstance(value, str) or not window['start'] <= value[:16] <= window['end']:
            return False
    return True


def arguments(config, fmt):
    out = config['time_windows']['outbound']
    result = dict(departureDate=fmt(out['start'][:10]), departureDateTo=fmt(out['end'][:10]), one_for_city=False)
    back = config['time_windows'].get('inbound')
    if back:
        start, end = back['start'][:10], back['end'][:10]
        if back['basis'] == 'arrival':
            shift = lambda text, days: (date.fromisoformat(text) + timedelta(days=days)).isoformat()
            earliest = shift(out['start'][:10], -2)
            hours = config['max_duration_hours']
            import math
            start = max(earliest, shift(start, -math.ceil(hours / 24) - 2)) if hours else earliest
            end = shift(end, 2)
        result.update(returnDate=fmt(start), returnDateTo=fmt(end))
    return result
