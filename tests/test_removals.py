import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from app import store, removals, scheduler, worker
from app.domain import jobs
from test_app import config, offer


class RemovalTests(unittest.TestCase):
    def setUp(self):
        self.directory=tempfile.TemporaryDirectory()
        self.patch=patch.object(store,'DB',Path(self.directory.name)/'test.db')
        self.patch.start()
        store.initialize()
        self.watch=store.create(config(),1)
        self.job=jobs(store.watch(self.watch))[0]
        store.observe_batch(self.watch,self.job,'ok',[offer(store.watch(self.watch),self.job)])

    def tearDown(self):
        self.patch.stop()
        self.directory.cleanup()

    def test_watch_removal_stops_work_and_restores_paused_with_history(self):
        self.assertFalse(removals.change('watches',self.watch,2))
        self.assertTrue(removals.change('watches',self.watch,1))
        self.assertEqual(store.snapshot(1)['watches'],[])
        self.assertEqual(store.snapshot(1)['observations'],[])
        self.assertEqual(len(store.snapshot(1)['deleted_watches']),1)
        self.assertIsNone(store.watch(self.watch,1))
        self.assertFalse(store.claim(self.watch))
        with patch.object(worker,'submit') as submit:
            scheduler.tick()
            submit.assert_not_called()
        store.observe_batch(self.watch,self.job,'error',[])
        self.assertTrue(removals.change('watches',self.watch,1,restore=True))
        self.assertFalse(store.watch(self.watch,1)['auto_enabled'])
        self.assertEqual(len(store.snapshot(1)['observations']),1)
        self.assertEqual(store.snapshot(1)['deleted_watches'],[])

    def test_offer_removal_retains_history_and_survives_reload(self):
        identity=store.snapshot(1)['observations'][0]['id']
        self.assertFalse(removals.change('offers',identity,2))
        self.assertTrue(removals.change('offers',identity,1))
        store.initialize()
        self.assertTrue(store.snapshot(1)['observations'][0]['dismissed_at'])
        self.assertTrue(removals.change('offers',identity,1,restore=True))
        self.assertIsNone(store.snapshot(1)['observations'][0]['dismissed_at'])
