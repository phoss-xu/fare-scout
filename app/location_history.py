"""Account-owned recent choices; saved watches supply pre-feature history."""
import json
import logging
from . import locations, store

LIMIT = 8
ROLES = ('origin', 'destination')


def recent(user_id):
    result = {role: [] for role in ROLES}
    with store.connect() as db:
        rows = db.execute("""SELECT role,location_id FROM location_history WHERE user_id=?
                             ORDER BY selected_at DESC,location_id""", (user_id,)).fetchall()
        watches = db.execute("SELECT config FROM watches WHERE owner_id=? ORDER BY id DESC",
                             (user_id,)).fetchall()
    def append(role, identity):
        if len(result[role]) < LIMIT:
            try:
                location = locations.resolve(identity)
                if location['id'] not in {r['id'] for r in result[role]}:
                    result[role].append(location)
            except ValueError:
                logging.warning('Recent location no longer exists in catalogue: %s', identity)
    for row in rows:
        append(row['role'], row['location_id'])
    for row in watches:
        config = json.loads(row['config'])
        append('origin', config.get('origin_location') or config['origin'])
        for value in config.get('destination_locations', config['destinations']):
            append('destination', value)
    return result


def remember(user_id, role, identity):
    if role not in ROLES:
        raise ValueError('请选择出发地或目的地。')
    row = locations.resolve(identity)
    with store.connect() as db:
        db.execute("""INSERT INTO location_history VALUES(?,?,?,?)
                      ON CONFLICT(user_id,role,location_id) DO UPDATE SET selected_at=excluded.selected_at""",
                   (user_id, role, row['id'], store.now()))
        db.execute("""DELETE FROM location_history WHERE user_id=? AND role=? AND location_id NOT IN
                      (SELECT location_id FROM location_history WHERE user_id=? AND role=?
                       ORDER BY selected_at DESC,location_id LIMIT ?)""", (user_id, role, user_id, role, LIMIT))
    return recent(user_id)
