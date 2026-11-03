"""Account-scoped saved trips and immutable public share snapshots."""
import json
import uuid
from . import store
from .trip_snapshot import snapshot, identity


def listed(user_id):
    with store.connect() as db:
        rows = db.execute('SELECT trip_key,snapshot,saved_at FROM saved_trips WHERE user_id=? ORDER BY saved_at DESC,trip_key', (user_id,)).fetchall()
    return {'trips': [dict(key=r['trip_key'], snapshot=json.loads(r['snapshot']), saved_at=r['saved_at']) for r in rows]}


def save(user_id, data):
    s = snapshot(data)
    key = identity(s)
    with store.connect() as db:
        changed = db.execute('''INSERT INTO saved_trips(user_id,trip_key,snapshot,saved_at)
            SELECT ?,?,?,? WHERE (SELECT COUNT(*) FROM saved_trips WHERE user_id=?)<200
              OR EXISTS(SELECT 1 FROM saved_trips WHERE user_id=? AND trip_key=?)
            ON CONFLICT(user_id,trip_key) DO UPDATE SET snapshot=excluded.snapshot,saved_at=excluded.saved_at''',
            (user_id, key, json.dumps(s, ensure_ascii=False), store.now(), user_id, user_id, key)).rowcount
        if not changed:
            raise ValueError('最多收藏 200 个行程，请先移除不用的行程。')
    return listed(user_id)


def remove(user_id, key):
    if not isinstance(key, str) or len(key) > 12000:
        raise ValueError('请选择有效的行程。')
    with store.connect() as db:
        db.execute('DELETE FROM saved_trips WHERE user_id=? AND trip_key=?', (user_id, key))
    return listed(user_id)


def share(user_id, data):
    s = snapshot(data)
    encoded, key = json.dumps(s, ensure_ascii=False), identity(s)
    with store.connect() as db:
        row = db.execute('SELECT id FROM shared_trips WHERE user_id=? AND trip_key=? AND snapshot=?', (user_id, key, encoded)).fetchone()
        if row:
            return dict(id=row['id'])
        if db.execute('SELECT COUNT(*) FROM shared_trips WHERE user_id=?', (user_id,)).fetchone()[0] >= 1000:
            raise ValueError('分享数量已达上限，请联系维护者。')
        token = str(uuid.uuid4())
        db.execute('INSERT INTO shared_trips VALUES(?,?,?,?,?)', (token, user_id, key, encoded, store.now()))
    return dict(id=token)


def shared(token):
    if not isinstance(token, str) or len(token) != 36:
        return None
    with store.connect() as db:
        row = db.execute('SELECT snapshot,created_at FROM shared_trips WHERE id=?', (token,)).fetchone()
    return dict(snapshot=json.loads(row['snapshot']), created_at=row['created_at']) if row else None
