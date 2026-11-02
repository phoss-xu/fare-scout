"""Account-scoped, recoverable removals; preserve price evidence."""
from . import store


def change(kind, identity, user_id, restore=False):
    with store.connect() as db:
        if kind == 'watches':
            row = db.execute('SELECT id FROM watches WHERE id=? AND owner_id=?', (identity,user_id)).fetchone()
            if not row:
                return False
            db.execute('UPDATE watches SET deleted_at=? WHERE id=?', (None if restore else store.now(),identity))
            if not restore:
                db.execute('UPDATE schedules SET auto_enabled=0,alerts_enabled=0 WHERE watch_id=?', (identity,))
                db.execute("""UPDATE email_outbox SET status='cancelled' WHERE alert_id IN
                           (SELECT id FROM alerts WHERE watch_id=?) AND status IN ('pending','retry','waiting_config')""", (identity,))
        else:
            row=db.execute('''SELECT o.id FROM observations o JOIN watches w ON w.id=o.watch_id
                              WHERE o.id=? AND w.owner_id=? AND w.deleted_at IS NULL AND o.status='ok' ''',
                           (identity,user_id)).fetchone()
            if not row:
                return False
            db.execute('UPDATE observations SET dismissed_at=? WHERE id=?', (None if restore else store.now(),identity))
    return True
