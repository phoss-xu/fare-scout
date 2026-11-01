import unittest
from copy import deepcopy
from unittest.mock import patch

from app import deals, deal_jobs
from app.domain import jobs
from test_app import config, offer


def search_config(**values):
    base = config()
    return deals.validate(dict(base, destinations=[], min_nights=2, max_nights=5, weekdays=[]) | values)


class DealTests(unittest.TestCase):
    def test_validate_ranges_and_unlimited_destination(self):
        self.assertEqual(search_config()['destination_locations'], [])
        for values in ({'min_nights':6,'max_nights':2}, {'weekdays':[7]}, {'weekdays':['0']},
                       {'end':'2030-01-01'}, {'adults':10}, {'budget':'NaN'}):
            with self.subTest(values=values), self.assertRaises(ValueError):
                search_config(**values)

    def test_filters_actual_dates_nights_budget_and_exact_airports(self):
        watch=search_config(origin='airport:HKG',destinations=['airport:SIN'],budget=2000)
        flight=offer(watch,dict(departure=watch['start'],arrival=watch['end']))
        target=watch['destination_locations'][0]
        self.assertTrue(deals.accepts(flight,watch,target))
        for path,key,value in [('outbound','to','BKK'),('inbound','to','SZX'),('inbound','departureTime',watch['start']+'T00:10:00')]:
            bad=deepcopy(flight);bad[path][key]=value
            self.assertFalse(deals.accepts(bad,watch,target))
        bad=deepcopy(flight);bad['price']=2001
        self.assertFalse(deals.accepts(bad,watch,target))
        watch['weekdays']=[( __import__('datetime').date.fromisoformat(watch['start']).weekday()+1)%7]
        self.assertFalse(deals.accepts(flight,watch,target))

    def test_search_uses_native_ranges_and_keeps_cheapest_per_city(self):
        watch=search_config(weekdays=[0,6])
        watch['weekdays']=[]
        flight=offer(watch,dict(departure=watch['start'],arrival=watch['end']))
        expensive=deepcopy(flight);expensive['price']=2500
        with patch.object(deals.Kiwi,'call'), patch.object(deals.Kiwi,'query',return_value=[expensive,flight]) as query:
            result=deals.search(watch)
        self.assertEqual(len(result['offers']),1)
        self.assertEqual(result['offers'][0]['price'],1900)
        args=query.call_args.args[0]
        self.assertEqual(args['flyTo'],'anywhere')
        self.assertEqual(args['nights_in_dst_from'],2)
        self.assertIn('departureDateTo',args)
        self.assertTrue(args['one_for_city'])

    def test_weekday_conversion_and_failures_are_not_empty_success(self):
        watch=search_config(weekdays=[0,6])
        with patch.object(deals.Kiwi,'call'), patch.object(deals.Kiwi,'query',return_value=[]) as query:
            self.assertEqual(deals.search(watch)['failures'],0)
        self.assertEqual(query.call_args.args[0]['fly_days'],'1,0')
        with patch.object(deals.Kiwi,'call',side_effect=TimeoutError('test')), self.assertLogs():
            self.assertEqual(deals.search(watch)['failures'],1)

    def test_tasks_are_account_isolated_and_reject_duplicate_running_search(self):
        with patch.object(deal_jobs,'TASKS',{}), patch.object(deal_jobs.POOL,'submit'):
            identity=deal_jobs.start(1,search_config())
            self.assertIsNone(deal_jobs.get(identity,2))
            self.assertEqual(deal_jobs.get(identity,1)['status'],'running')
            with self.assertRaises(ValueError): deal_jobs.start(1,search_config())
            with patch.object(deals,'search',return_value={'offers':[],'failures':1,'total':1}):
                deal_jobs.run(identity,search_config())
            self.assertEqual(deal_jobs.get(identity,1)['status'],'error')


if __name__=='__main__': unittest.main()
