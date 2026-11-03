import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from app import search_presets as presets, store
from test_app import config


class SearchPresetTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.db_patch = patch.object(store, 'DB', Path(self.directory.name) / 'presets.db')
        self.db_patch.start()
        store.initialize()

    def tearDown(self):
        self.db_patch.stop()
        self.directory.cleanup()

    def test_complete_snapshot_is_persistent_deduplicated_and_owner_scoped(self):
        value = config() | dict(date_mode='fixed', budget=1200, adults=2, max_stops=0, max_duration_hours=8)
        rows = presets.save(1, dict(name='常去新加坡', config=value))['presets']
        self.assertEqual(len(rows), 1)
        c = rows[0]['config']
        self.assertEqual((c['adults'], c['budget'], c['date_mode']), (2, 1200, 'fixed'))
        self.assertEqual(c['origins'], ['airport:HKG'])
        self.assertEqual(c['destinations'], ['airport:SIN'])
        self.assertNotIn('alerts_enabled', c)
        self.assertEqual(presets.listed(2)['presets'], [])
        renamed = presets.save(1, dict(name='重新命名', config=value))['presets']
        self.assertEqual(renamed[0]['id'], rows[0]['id'])
        presets.save(1,dict(config=value))
        store.initialize()
        self.assertEqual(presets.listed(1)['presets'][0]['name'], '重新命名')
        with self.assertRaises(ValueError): presets.remove(2, rows[0]['id'])
        self.assertEqual(presets.remove(1, rows[0]['id'])['presets'], [])
        self.assertEqual(len(presets.save(1, dict(config=value))['presets']), 1)

    def test_flexible_filters_and_weekend_pairs_round_trip_without_expansion(self):
        from datetime import date, timedelta
        value = config() | dict(destinations=[], nights=[2,4], weekdays=[0,5])
        c = presets.save(1, dict(config=value))['presets'][0]['config']
        self.assertEqual((c['nights'],c['weekdays'],c['destinations']), ([2,4],[0,5],[]))
        first = date.fromisoformat(value['start'])
        first += timedelta(days=(5-first.weekday())%7)
        pairs = [dict(start=(first+timedelta(days=n)).isoformat(),end=(first+timedelta(days=n+1)).isoformat()) for n in (0,14)]
        weekend = value | dict(date_mode='fixed',date_pairs=pairs,start=pairs[0]['start'],end=pairs[-1]['end'])
        c = presets.save(2, dict(config=weekend))['presets'][0]['config']
        self.assertEqual(c['date_pairs'],pairs)
        self.assertEqual(presets.snapshot(c),c)

    def test_invalid_data_and_limit_do_not_replace_saved_queries(self):
        for data in (dict(config=None),dict(config=config(),name='x'*61),dict(config=config() | {'start':'2000-01-01'})):
            with self.assertRaises(ValueError): presets.save(1,data)
        for adults in range(1,6):
            for budget in (1000,2000,3000,4000): presets.save(1,dict(config=config() | dict(adults=adults,budget=budget)))
        self.assertEqual(len(presets.listed(1)['presets']),20)
        with self.assertRaises(ValueError): presets.save(1,dict(config=config() | dict(budget=9999)))
        self.assertEqual(len(presets.save(1,dict(config=config() | dict(adults=1,budget=1000)))['presets']),20)
