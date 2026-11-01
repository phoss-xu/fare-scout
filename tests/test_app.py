import json
import tempfile
import unittest
from datetime import timedelta
from pathlib import Path
from unittest.mock import patch

from app import store, worker
from app.domain import jobs, matches, today, validate
from app.provider import Kiwi


def config(**kwargs):
    start = today() + timedelta(days=7)
    return validate(dict(origin="HKG", destinations=["SIN"], mode="fixed",
                         start=start.isoformat(), end=(start + timedelta(days=2)).isoformat(), **kwargs))


def offer(watch, job):
    return dict(price=1900, outbound=dict(from_="HKG"), inbound={}) | {
        "outbound": {"from": "HKG", "to": "SIN", "departureTime": job["departure"] + "T01:40:00",
                     "arrivalTime": job["departure"] + "T05:40:00", "stops": 0, "durationSeconds": 14400},
        "inbound": {"from": "SIN", "to": "HKG", "departureTime": job["arrival"] + "T00:10:00",
                    "arrivalTime": job["arrival"] + "T04:10:00", "stops": 0, "durationSeconds": 14400}}


class DomainTests(unittest.TestCase):
    def test_bounded_weekend_jobs(self):
        data = config()
        data.update(mode="weekend", weeks=4, destinations=["SIN", "BKK", "KUL"])
        expanded = jobs(validate(data))
        self.assertEqual(len(expanded), 12)
        from datetime import date
        self.assertTrue(all(date.fromisoformat(j["departure"]).weekday() == 5 for j in expanded))

    def test_reject_invalid_conditions(self):
        for update in ({"destinations": []}, {"budget": "NaN"}, {"origin": "<b>"},
                       {"adults": 10}, {"weeks": 5}, {"mode": "holiday"},
                       {"start": "2000-01-01"}):
            with self.subTest(update=update), self.assertRaises(ValueError):
                validate(config() | update)

    def test_weekend_is_based_on_hong_kong_arrival(self):
        watch = config() | {"mode": "weekend"}
        job = jobs(watch)[0]
        flight = offer(watch, job)
        flight["inbound"]["departureTime"] = (today() + timedelta(days=1)).isoformat() + "T20:20:00"
        self.assertTrue(matches(flight, watch, job))
        flight["inbound"]["arrivalTime"] = job["arrival"] + "T06:00:00"
        self.assertFalse(matches(flight, watch, job))

    def test_wrong_route_date_and_duration_are_excluded(self):
        watch = config()
        watch.update(max_duration_hours=8, max_stops=1)
        job = jobs(watch)[0]
        for leg, key, value in [("outbound", "to", "BKK"), ("inbound", "from", "BKK"),
                                ("inbound", "departureTime", "2000-01-01T01:00:00"),
                                ("outbound", "durationSeconds", 40000)]:
            flight = offer(watch, job)
            flight[leg][key] = value
            self.assertFalse(matches(flight, watch, job))


class ProviderTests(unittest.TestCase):
    def test_empty_is_distinct_from_unrecognized_response(self):
        watch = config()
        with patch.object(Kiwi, "call", side_effect=[{}, {"structuredContent": {"itineraries": []}}]):
            self.assertEqual(Kiwi().search(watch, jobs(watch)[0]), [])
        with patch.object(Kiwi, "call", side_effect=[{}, {"content": []}]), self.assertRaises(RuntimeError):
            Kiwi().search(watch, jobs(watch)[0])

    def test_filter_and_cheapest_offer(self):
        watch = config()
        job = jobs(watch)[0]
        good = offer(watch, job)
        bad = offer(watch, job)
        bad["price"] = 100
        bad["outbound"]["to"] = "BKK"
        result = {"content": [{"type": "text", "text": json.dumps({"itineraries": [bad, good]})}]}
        with patch.object(Kiwi, "call", side_effect=[{}, result]):
            self.assertEqual(Kiwi().search(watch, job)[0]["price"], 1900)


class StoreWorkerTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.db_patch = patch.object(store, "DB", Path(self.directory.name) / "test.db")
        self.db_patch.start()
        store.initialize()

    def tearDown(self):
        self.db_patch.stop()
        self.directory.cleanup()

    def test_duplicate_run_guard_and_persistence(self):
        watch_id = store.create(config())
        self.assertTrue(store.claim(watch_id))
        self.assertFalse(store.claim(watch_id))
        with patch.object(Kiwi, "search", return_value=[]), patch.object(worker.time, "sleep"):
            worker.run(watch_id)
        state = store.snapshot()
        self.assertFalse(state["watches"][0]["running"])
        self.assertEqual(state["observations"][0]["status"], "empty")

    def test_provider_failure_is_recorded_and_releases_guard(self):
        watch_id = store.create(config())
        store.claim(watch_id)
        with patch.object(Kiwi, "search", side_effect=TimeoutError("test")), patch.object(worker.time, "sleep"), self.assertLogs(worker.LOG):
            worker.run(watch_id)
        self.assertEqual(store.snapshot()["observations"][0]["status"], "error")
        self.assertTrue(store.claim(watch_id))


if __name__ == "__main__":
    unittest.main()
