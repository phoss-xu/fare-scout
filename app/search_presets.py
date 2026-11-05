"""Explicitly saved discovery forms, isolated by account; saving never queries fares."""
import json
import uuid
from . import deals, store

LIMIT = 20


def snapshot(data):
    if not isinstance(data, dict):
        raise ValueError('请检查要保存的查询组合。')
    config = deals.validate(data)
    result = {key: config[key] for key in ('start', 'end', 'date_mode', 'adults', 'budget',
              'max_stops', 'max_duration_hours', 'nights', 'weekdays')}
    if config['trip_type'] == 'oneway':
        result['trip_type'] = 'oneway'
    if config['currency'] != 'HKD':
        result['currency'] = config['currency']
    result['origins'] = sorted(row['id'] for row in config['origin_selections'])
    result['destinations'] = sorted(row['id'] for row in config['destination_selections'])
    if 'time_windows' in config:
        result['time_windows'] = config['time_windows']
    if 'date_pairs' in config:
        result['date_pairs'] = config['date_pairs']
    return result


def listed(user_id):
    with store.connect() as db:
        rows = db.execute('''SELECT id,name,config,updated_at FROM search_presets
            WHERE user_id=? AND deleted_at IS NULL ORDER BY updated_at DESC,id''', (user_id,)).fetchall()
    return {'presets': [dict(id=row['id'], name=row['name'], config=json.loads(row['config']),
                             updated_at=row['updated_at']) for row in rows]}


def save(user_id, data):
    name = data.get('name', '')
    if not isinstance(name, str) or len(name.strip()) > 60:
        raise ValueError('组合名称请控制在 60 个字符以内。')
    config = json.dumps(snapshot(data.get('config', {})), sort_keys=True, separators=(',', ':'), ensure_ascii=False)
    timestamp = store.now()
    with store.connect() as db:
        changed = db.execute('''INSERT INTO search_presets(id,user_id,name,config,updated_at)
            SELECT ?,?,?,?,? WHERE (SELECT COUNT(*) FROM search_presets WHERE user_id=? AND deleted_at IS NULL)<?
              OR EXISTS(SELECT 1 FROM search_presets WHERE user_id=? AND config=? AND deleted_at IS NULL)
            ON CONFLICT(user_id,config) DO UPDATE SET name=CASE WHEN excluded.name='' THEN search_presets.name ELSE excluded.name END,updated_at=excluded.updated_at,deleted_at=NULL''',
            (uuid.uuid4().hex, user_id, name.strip(), config, timestamp, user_id, LIMIT, user_id, config)).rowcount
        if not changed:
            raise ValueError('最多保存 20 个查询组合，请先移除不用的组合。')
    return listed(user_id)


def remove(user_id, identity):
    if not isinstance(identity, str) or len(identity) > 40:
        raise ValueError('这条查询组合不存在。')
    with store.connect() as db:
        changed = db.execute('UPDATE search_presets SET deleted_at=? WHERE id=? AND user_id=? AND deleted_at IS NULL',
                             (store.now(), identity, user_id)).rowcount
        if not changed:
            raise ValueError('这条查询组合不存在。')
    return listed(user_id)
