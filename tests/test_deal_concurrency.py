import threading
import unittest
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import patch
from app import deals, deal_jobs
from test_app import offer
from test_deals import search_config


class DealConcurrencyTests(unittest.TestCase):
    def test_distinct_regions_overlap_and_publish_before_slowest_finishes(self):
        codes=['SIN','BKK','KUL','MNL','SGN','DPS']
        watch=search_config(destinations=['airport:'+code for code in codes])
        gates={code:threading.Event() for code in codes}
        lock=threading.Lock();started=threading.Event();partial_ready=threading.Event()
        active=peak=0
        snapshots=[]
        def query(args):
            nonlocal active,peak
            code=args['flyTo']
            with lock:
                active+=1;peak=max(peak,active)
                if active==4: started.set()
            try:
                if not gates[code].wait(5): raise TimeoutError('test gate timed out')
                flight=offer(watch,dict(departure=watch['start'],arrival=watch['end']))
                flight['outbound']['to']=flight['inbound']['from']=code
                return [flight]
            finally:
                with lock: active-=1
        def partial(result):
            snapshots.append(result)
            if result['completed']==1: partial_ready.set()
        with patch.object(deals.Kiwi,'call'),patch.object(deals.Kiwi,'query',side_effect=query),ThreadPoolExecutor(max_workers=1) as runner:
            future=runner.submit(deals.search,watch,lambda *_:None,partial)
            try:
                self.assertTrue(started.wait(3),'Four regions should start before any is released')
                gates['SIN'].set()
                self.assertTrue(partial_ready.wait(3))
                self.assertFalse(future.done())
                self.assertEqual(snapshots[0]['completed'],1)
                self.assertEqual(len(snapshots[0]['offers']),1)
            finally:
                for gate in gates.values(): gate.set()
            result=future.result(timeout=5)
        self.assertEqual(peak,4)
        self.assertEqual((result['completed'],result['failures'],len(result['offers'])),(6,0,6))

    def test_running_task_exposes_partial_results_with_account_isolation(self):
        watch=search_config()
        partial=dict(completed=1,total=2,offers=[{'price':1200}],failures=0)
        def source(config,progress,publish):
            publish(partial)
            current=deal_jobs.get('test',1)
            self.assertEqual(current['status'],'running')
            self.assertEqual(current['offers'],partial['offers'])
            self.assertIsNone(deal_jobs.get('test',2))
            return dict(partial,completed=2)
        with patch.object(deal_jobs,'TASKS',{'test':dict(owner=1,status='running')}),patch.object(deals,'search',side_effect=source):
            deal_jobs.run('test',watch)
            self.assertEqual(deal_jobs.get('test',1)['status'],'done')
