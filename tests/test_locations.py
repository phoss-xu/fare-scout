import tempfile
import unittest
from copy import deepcopy
from pathlib import Path
from unittest.mock import patch

from app import locations, store, worker
from app.domain import jobs, matches, validate
from app.provider import Kiwi
from test_app import config, offer


def scoped(origin="country:GB", destinations=None, **values):
    base = config()
    return validate(base | {"origin": origin, "destinations": destinations or ["country:JP"]} | values)


def route(watch, job, origin="LHR", destination="NRT", price=3000):
    result = offer(watch, job)
    result["price"] = price
    result["outbound"].update({"from":origin, "to":destination})
    result["inbound"].update({"from":destination, "to":origin})
    return result


class LocationTests(unittest.TestCase):
    def test_global_entities_and_chinese_search(self):
        for identity in ("country:JP", "city:TYO", "airport:LAX", "airport:LHR"):
            self.assertEqual(locations.resolve(identity)["id"], identity)
        self.assertIn("city:TYO", [r["id"] for r in locations.search("东京", "city")])
        self.assertTrue(locations.contains(locations.resolve("city:LON"), "LHR"))
        self.assertTrue(locations.contains(locations.resolve("city:LON"), "LGW"))
        self.assertFalse(locations.contains(locations.resolve("city:LON"), "MAN"))
        self.assertEqual(locations.resolve({"id":"country:JP", "code":"FR"})["code"], "JP")
        with self.assertRaises(ValueError):
            locations.resolve("country:ZZ")

    def test_country_city_and_airport_membership_are_distinct(self):
        watch = scoped()
        job = jobs(watch)[0]
        flight = route(watch, job)
        self.assertTrue(matches(flight, watch, job))
        flight["outbound"]["to"] = "ICN"
        self.assertFalse(matches(flight, watch, job))
        watch = scoped("city:LON", ["city:TYO"])
        job = jobs(watch)[0]
        self.assertTrue(matches(route(watch, job, "LGW", "HND"), watch, job))
        self.assertFalse(matches(route(watch, job, "MAN", "HND"), watch, job))
        watch = scoped("airport:HKG", ["airport:BKK"])
        job = jobs(watch)[0]
        self.assertFalse(matches(route(watch, job, "HKG", "DMK"), watch, job))

    def test_global_weekends_and_long_haul_defaults(self):
        watch = scoped(mode="weekend", destinations=["country:JP","country:FR","country:US","airport:LAX"])
        self.assertEqual(len(watch["destination_locations"]), 4)
        watch = scoped("airport:LHR", ["airport:NRT"])
        job = jobs(watch)[0]
        flight = route(watch, job)
        flight["outbound"]["durationSeconds"] = 13 * 3600
        self.assertTrue(matches(flight, watch, job))
        legacy = {key:value for key,value in watch.items() if key not in ("origin_location","destination_locations","max_stops","max_duration_hours")}
        self.assertFalse(matches(flight, legacy, job))

    def test_provider_keeps_separate_airports_and_filters_country(self):
        watch = scoped("airport:HKG")
        job = jobs(watch)[0]
        expensive = route(watch, job, "HKG", "NRT", 3500)
        cheapest = route(watch, job, "HKG", "NRT", 3000)
        haneda = route(watch, job, "HKG", "HND", 3200)
        unrelated = route(watch, job, "HKG", "ICN", 1000)
        result = {"structuredContent": {"itineraries":[expensive,cheapest,haneda,unrelated]}}
        with patch.object(Kiwi, "call", side_effect=[{}, result]) as call:
            actual = Kiwi().search(watch, job)
        self.assertEqual([o["price"] for o in actual], [3000,3200])
        self.assertEqual(call.call_args.args[2]["arguments"]["flyTo"], "JP")
        self.assertNotIn("max_sector_stopovers", call.call_args.args[2]["arguments"])


class ScopePersistenceTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.patch = patch.object(store, "DB", Path(self.directory.name) / "scope.db")
        self.patch.start()
        store.initialize()

    def tearDown(self):
        self.patch.stop()
        self.directory.cleanup()

    def test_different_origin_airports_do_not_trigger_false_drop(self):
        watch = scoped()
        watch_id = store.create(watch)
        job = jobs(watch)[0]
        store.observe_batch(watch_id, job, "ok", [route(watch, job, "LHR", price=3000)])
        store.observe_batch(watch_id, job, "ok", [route(watch, job, "LGW", price=1000)])
        self.assertEqual(store.snapshot()["alerts"], [])
        store.observe_batch(watch_id, job, "ok", [route(watch, job, "LGW", price=800)])
        self.assertEqual(len(store.snapshot()["alerts"]), 1)
        self.assertEqual(store.snapshot()["alerts"][0]["previous_price"], 1000)

    def test_one_query_batch_preserves_multiple_actual_routes(self):
        watch = scoped()
        watch_id = store.create(watch)
        job = jobs(watch)[0]
        store.observe_batch(watch_id, job, "ok", [route(watch, job), route(watch, job, destination="HND")])
        rows = store.snapshot()["observations"]
        self.assertEqual({r["destination"] for r in rows}, {"NRT","HND"})
        self.assertEqual(len({r["batch_id"] for r in rows}), 1)
        self.assertEqual({r["search_id"] for r in rows}, {"country:JP"})

    def test_many_scopes_rotate_without_unbounded_queries(self):
        watch = scoped(destinations=["country:JP","country:FR","country:US","airport:LAX"], mode="weekend", weeks=4)
        watch_id = store.create(watch)
        with patch.object(Kiwi, "search", return_value=[]), patch.object(worker.time, "sleep"):
            worker.run(watch_id)
            self.assertEqual(store.watch(watch_id)["query_cursor"], 12)
            worker.run(watch_id)
        self.assertEqual(len(store.snapshot()["observations"]), 24)
        self.assertEqual(store.watch(watch_id)["query_cursor"], 8)
        self.assertEqual(store.watch(watch_id)["last_batch_count"], 12)


if __name__ == "__main__":
    unittest.main()
