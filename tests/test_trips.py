import copy
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from app import trips, store
from app.trip_snapshot import snapshot, identity

FIXTURE = Path(__file__).with_name('fixtures') / 'trip-snapshot.json'


class TripTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.db_patch = patch.object(store, 'DB', Path(self.directory.name) / 'trips.db')
        self.db_patch.start()
        store.initialize()
        self.data = json.loads(FIXTURE.read_text())

    def tearDown(self):
        self.db_patch.stop()
        self.directory.cleanup()

    def test_saved_trips_persist_deduplicate_and_isolate_accounts_without_querying(self):
        first = trips.save(1, self.data)['trips'][0]
        changed = copy.deepcopy(self.data)
        changed['offer']['price'] = 900
        rows = trips.save(1, changed)['trips']
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['snapshot']['offer']['price'], 900)
        self.assertEqual(first['key'], rows[0]['key'])
        self.assertEqual(trips.listed(2)['trips'], [])
        trips.remove(2, first['key'])
        store.initialize()
        self.assertEqual(len(trips.listed(1)['trips']), 1)
        trips.remove(1, first['key'])
        self.assertEqual(trips.listed(1)['trips'], [])
        with store.connect() as db:
            for table in ('watches', 'observations', 'alerts', 'email_outbox'):
                self.assertEqual(db.execute(f'SELECT COUNT(*) FROM {table}').fetchone()[0], 0)

    def test_shares_are_immutable_public_snapshots_without_account_preferences(self):
        token = trips.share(1, self.data)['id']
        self.assertEqual(trips.share(1, self.data)['id'], token)
        trips.save(1, self.data)
        trips.remove(1, identity(snapshot(self.data)))
        public = trips.shared(token)
        self.assertNotIn('email', json.dumps(public))
        self.assertNotIn('budget', json.dumps(public))
        self.assertNotIn('user_id', public)
        self.data['offer']['price'] = 500
        new = trips.share(1, self.data)['id']
        self.assertNotEqual(new, token)
        self.assertEqual(trips.shared(token)['snapshot']['offer']['price'], 1234)
        self.assertIsNone(trips.shared('invalid'))

    def test_validation_rejects_unsafe_links_invalid_people_and_non_finite_prices(self):
        for key, value in [('adults', True), ('adults', 0), ('currency', 'XXX'), ('cabin', 'J')]:
            with self.assertRaises(ValueError): snapshot({**self.data, key: value})
        for value in ('javascript:alert(1)', 'https://user:pass@example.test', 'https:bad'):
            with self.assertRaises(ValueError): snapshot({**self.data, 'offer': {**self.data['offer'], 'bookingUrl': value}})
        with self.assertRaises(ValueError): snapshot({**self.data, 'offer': {**self.data['offer'], 'price': float('nan')}})
