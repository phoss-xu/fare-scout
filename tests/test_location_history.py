import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from app import location_history as history, store
from test_app import config


class RecentLocationsTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.db_patch = patch.object(store, 'DB', Path(self.directory.name) / 'recent.db')
        self.db_patch.start()
        store.initialize()

    def tearDown(self):
        self.db_patch.stop()
        self.directory.cleanup()

    def test_saved_watch_fallback_is_scoped_and_canonical(self):
        store.create(config(), 1)
        self.assertEqual(history.recent(1)['origin'][0]['id'], 'airport:HKG')
        self.assertEqual(history.recent(1)['destination'][0]['id'], 'airport:SIN')
        self.assertEqual(history.recent(2), {'origin': [], 'destination': []})

    def test_reuse_moves_to_front_without_duplicates_and_survives_restart(self):
        for identity in ('city:TYO', 'country:JP', 'airport:HND', 'city:TYO'):
            history.remember(1, 'destination', identity)
        store.initialize()
        self.assertEqual([r['id'] for r in history.recent(1)['destination']],
                         ['city:TYO', 'airport:HND', 'country:JP'])
        self.assertEqual(history.recent(1)['origin'], [])
        self.assertEqual(history.recent(2)['destination'], [])

    def test_limit_and_validation_do_not_change_other_roles_or_users(self):
        history.remember(2, 'destination', 'city:TYO')
        history.remember(1, 'origin', 'airport:HKG')
        for code in ('JP', 'FR', 'GB', 'US', 'CA', 'SG', 'TH', 'MY', 'DE', 'IT'):
            history.remember(1, 'destination', 'country:' + code)
        self.assertEqual(len(history.recent(1)['destination']), 8)
        self.assertEqual(history.recent(1)['destination'][0]['id'], 'country:IT')
        with store.connect() as db:
            self.assertEqual(db.execute('SELECT COUNT(*) FROM location_history').fetchone()[0], 10)
        for role, identity in (('anything', 'city:TYO'), ('origin', 'bad-location')):
            with self.assertRaises(ValueError):
                history.remember(1, role, identity)
        self.assertEqual(history.recent(2)['destination'][0]['id'], 'city:TYO')
        self.assertEqual(history.recent(1)['origin'][0]['id'], 'airport:HKG')
