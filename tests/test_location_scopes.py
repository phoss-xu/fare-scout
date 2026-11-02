import unittest
import tempfile
from pathlib import Path
from unittest.mock import patch
from app import deals, locations, store
from app.domain import validate, jobs, matches
from test_app import config, offer


class MultiScopeTests(unittest.TestCase):
    def test_group_expands_and_deduplicates_explicit_member(self):
        watch = validate(config() | dict(origins=['airport:HKG','city:SHA'],
                                        destinations=['group:visa-free','country:SG']))
        self.assertEqual(len(watch['origin_locations']), 2)
        self.assertEqual(len(watch['destination_locations']), 16)
        self.assertEqual(len(jobs(watch)), 32)
        self.assertEqual(watch['destination_selections'][0]['id'], 'group:visa-free')
        self.assertNotIn('group', {r['kind'] for r in watch['destination_locations']})

    def test_round_trip_must_return_to_same_selected_origin_scope(self):
        watch = validate(config() | dict(origins=['airport:HKG','airport:SZX']))
        job = jobs(watch)[1]
        flight = offer(watch,job)
        flight['outbound']['from'] = flight['inbound']['to'] = 'SZX'
        self.assertTrue(matches(flight,watch,job))
        flight['inbound']['to'] = 'HKG'
        self.assertFalse(matches(flight,watch,job))

    def test_search_expands_both_sides_with_bounded_queries(self):
        data = config() | dict(origins=['airport:HKG','airport:SZX'],
                               destinations=['group:visa-free'], min_nights=2,max_nights=5)
        cfg = deals.validate(data)
        with patch.object(deals.Kiwi,'call'), patch.object(deals.Kiwi,'query',return_value=[]) as query:
            result = deals.search(cfg)
        self.assertEqual(result['total'],32)
        self.assertEqual(query.call_count,32)
        self.assertEqual({c.args[0]['flyFrom'] for c in query.call_args_list}, {'HKG','SZX'})
        self.assertIn('SG', {c.args[0]['flyTo'] for c in query.call_args_list})
        with self.assertRaises(ValueError):
            deals.validate(data | dict(origins=['group:europe']))

    def test_invalid_and_empty_selections_rejected(self):
        for values in (dict(origins=[]),dict(origins='airport:HKG'),dict(destinations=['group:unknown'])):
            with self.subTest(values=values), self.assertRaises(ValueError):
                validate(config() | values)
        self.assertEqual(locations.resolve('group:visa-free')['kind'],'group')

    def test_persisted_multi_origin_batches_remain_separate(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(store,'DB',Path(directory)/'test.db'):
            store.initialize()
            watch=validate(config() | dict(origins=['airport:HKG','airport:SZX'],destinations=['airport:SIN']))
            identity=store.create(watch)
            restored=store.watch(identity)
            self.assertEqual([r['id'] for r in restored['origin_locations']],['airport:HKG','airport:SZX'])
            first, second=jobs(restored)
            store.observe_batch(identity, first, 'empty', [])
            store.observe_batch(identity, second, 'error', [])
            rows=store.snapshot()['observations']
            self.assertEqual(len({row['search_id'] for row in rows}),2)
            self.assertEqual({row['status'] for row in rows},{'empty','error'})
