import json
import sqlite3
import tempfile
import unittest
from contextlib import closing
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

from app import scheduler, store, worker
from app.domain import jobs
from app.policy import validate_settings
from test_app import config


class AutomationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.db_patch = patch.object(store, "DB", Path(self.temp.name) / "test.db")
        self.db_patch.start()
        store.initialize()
        self.watch_id = store.create(config())
        self.job = jobs(store.watch(self.watch_id))[0]

    def tearDown(self):
        self.db_patch.stop()
        self.temp.cleanup()

    def observe(self, price, job=None):
        store.observe(self.watch_id, job or self.job, "ok", {"price": price, "bookingUrl": "https://kiwi.com/test"})

    def test_due_job_claimed_once_and_paused_watch_not_submitted(self):
        with patch.object(worker.POOL, "submit") as dispatch:
            scheduler.tick()
            scheduler.tick()
        self.assertEqual(dispatch.call_count, 1)
        store.finish(self.watch_id)
        store.update_settings(self.watch_id, {"auto_enabled": False})
        with store.connect() as db:
            db.execute("UPDATE schedules SET next_check='2000-01-01' WHERE watch_id=?", (self.watch_id,))
        with patch.object(worker.POOL, "submit") as dispatch:
            scheduler.tick()
        dispatch.assert_not_called()

    def test_failure_backoff_success_and_restart_preserve_due_time(self):
        store.finish(self.watch_id, "error")
        watch = store.watch(self.watch_id)
        delay = datetime.fromisoformat(watch["next_check"]) - datetime.now(timezone.utc)
        self.assertTrue(timedelta(minutes=14) < delay <= timedelta(minutes=15))
        self.assertEqual(watch["failure_count"], 1)
        store.initialize()
        self.assertEqual(store.watch(self.watch_id)["next_check"], watch["next_check"])
        store.finish(self.watch_id)
        self.assertEqual(store.watch(self.watch_id)["failure_count"], 0)

    def test_expired_watch_stops_without_calling_provider(self):
        with patch.object(scheduler, "jobs", return_value=[{"departure": "2000-01-01"}]), patch.object(worker, "submit") as submit:
            scheduler.tick()
        submit.assert_not_called()
        self.assertIsNone(store.watch(self.watch_id)["next_check"])
        self.assertEqual(store.watch(self.watch_id)["last_status"], "expired")

    def test_threshold_errors_and_rebounds_do_not_duplicate_alerts(self):
        self.observe(3000)
        self.observe(2950)
        self.assertEqual(store.snapshot()["alerts"], [])
        store.observe(self.watch_id, self.job, "error")
        self.observe(2700)
        self.observe(2700)
        self.observe(3000)
        self.observe(2700)
        alerts = store.snapshot()["alerts"]
        self.assertEqual(len(alerts), 1)
        self.assertEqual(alerts[0]["previous_price"], 2950)
        self.assertEqual(alerts[0]["email_status"], "pending")

    def test_different_dates_and_destinations_are_not_compared(self):
        self.observe(3000)
        self.observe(1500, self.job | {"arrival": "2099-01-01"})
        self.observe(1500, self.job | {"destination": "BKK"})
        self.assertEqual(store.snapshot()["alerts"], [])

    def test_first_budget_match_and_read_state_are_persistent(self):
        with store.connect() as db:
            data = config() | {"budget": 2000}
            db.execute("UPDATE watches SET config=? WHERE id=?", (json.dumps(data), self.watch_id))
        self.observe(1900)
        alert = store.snapshot()["alerts"][0]
        self.assertEqual(alert["reason"], "budget")
        self.assertIsNone(alert["previous_price"])
        store.mark_read(alert["id"])
        store.initialize()
        self.assertIsNotNone(store.snapshot()["alerts"][0]["read_at"])
        self.observe(1950)
        self.observe(1900)
        self.assertEqual(len(store.snapshot()["alerts"]), 1)

    def test_disabled_alerts_and_invalid_settings(self):
        store.update_settings(self.watch_id, {"alerts_enabled": False})
        self.observe(3000)
        self.observe(1000)
        self.assertFalse(store.snapshot()["alerts"])
        for invalid in ({"interval_hours": 0.01}, {"min_drop": "NaN"}, {"auto_enabled": "false"}):
            with self.subTest(invalid=invalid), self.assertRaises(ValueError):
                validate_settings(invalid)

    def test_old_database_migration_keeps_existing_samples(self):
        old = Path(self.temp.name) / "old.db"
        with closing(sqlite3.connect(old)) as db, db:
            db.executescript("""CREATE TABLE watches(id INTEGER PRIMARY KEY,config TEXT,created_at TEXT,running INTEGER DEFAULT 0);
              CREATE TABLE observations(id INTEGER PRIMARY KEY,watch_id INTEGER,destination TEXT,departure TEXT,
              arrival TEXT,checked_at TEXT,status TEXT,offer TEXT);""")
            db.execute("INSERT INTO watches(id,config,created_at) VALUES(1,?,?)", (json.dumps(config()), store.now()))
            db.execute("INSERT INTO observations VALUES(1,1,'SIN','2099-01-01','2099-01-02',?,'ok',?)",
                       (store.now(), json.dumps({"price": 3000})))
        with patch.object(store, "DB", old):
            store.initialize()
            state = store.snapshot()
        self.assertEqual(state["observations"][0]["offer"]["price"], 3000)
        self.assertTrue(state["watches"][0]["auto_enabled"])
        self.assertEqual(state["alerts"], [])

    def test_network_retry_has_a_limit(self):
        with patch.object(worker.Kiwi, "search", side_effect=TimeoutError), patch.object(worker.time, "sleep") as sleep, self.assertLogs(worker.LOG):
            with self.assertRaises(TimeoutError):
                worker.search_with_retry(store.watch(self.watch_id), self.job)
        self.assertEqual(sleep.call_count, 2)


if __name__ == "__main__":
    unittest.main()
