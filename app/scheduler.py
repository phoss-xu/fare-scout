"""One local scheduler thread, persisted due times, no missed-run backfill."""
import logging
import threading

from . import store, worker
from .domain import jobs, today

LOG = logging.getLogger(__name__)


def tick():
    timestamp = store.now()
    with store.connect() as db:
        ids = [r[0] for r in db.execute("""SELECT s.watch_id FROM schedules s JOIN watches w ON w.id=s.watch_id
            LEFT JOIN users u ON u.id=w.owner_id
            WHERE w.deleted_at IS NULL AND s.auto_enabled=1 AND w.running=0 AND s.next_check<=?
            AND (w.owner_id IS NULL OR u.password_hash IS NOT NULL) ORDER BY s.next_check LIMIT 10""",
                                      (timestamp,))]
    for watch_id in ids:
        watch = store.watch(watch_id)
        if not any(j["departure"] >= today().isoformat() for j in jobs(watch)):
            store.finish(watch_id, "expired")
        else:
            worker.submit(watch_id, automatic=True)


class Scheduler:
    def __init__(self, callback=tick, name="fare-scheduler"):
        self.stopped = threading.Event()
        self.callback = callback
        self.thread = threading.Thread(target=self.loop, name=name, daemon=True)

    def loop(self):
        while not self.stopped.is_set():
            try:
                self.callback()
            except Exception:
                LOG.exception("Scheduler tick failed; retrying next tick")
            self.stopped.wait(10)

    def start(self):
        self.thread.start()

    def stop(self):
        self.stopped.set()
        self.thread.join(timeout=5)
