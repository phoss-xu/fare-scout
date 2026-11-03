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

    def test_fixed_dates_use_exact_return_and_ignore_flexible_filters(self):
        watch=search_config(date_mode='fixed', nights=[], weekdays=[0])
        flight=offer(watch,dict(departure=watch['start'],arrival=watch['end']))
        with patch.object(deals.Kiwi,'call'), patch.object(deals.Kiwi,'query',return_value=[flight]) as query:
            self.assertEqual(len(deals.search(watch)['offers']),1)
        args=query.call_args.args[0]
        self.assertIn('returnDate',args)
        for key in ('departureDateTo','nights_in_dst_from','fly_days'):
            self.assertNotIn(key,args)
        bad=deepcopy(flight);bad['inbound']['departureTime']=watch['start']+'T12:00:00'
        self.assertFalse(deals.accepts(bad,watch,None))

    def test_sparse_nights_reject_gaps_and_invalid_selections(self):
        watch=search_config(nights=[2,4,10,2])
        self.assertEqual(watch['nights'],[2,4,10])
        flight=offer(watch,dict(departure=watch['start'],arrival=watch['end']))
        flight['inbound']['departureTime']=watch['start']+'T12:00:00'
        from datetime import date, timedelta
        for nights in (2,3,4):
            flight['inbound']['departureTime']=(date.fromisoformat(flight['outbound']['arrivalTime'][:10])+timedelta(days=nights)).isoformat()+'T12:00:00'
            self.assertEqual(deals.accepts(flight,watch,None),nights in (2,4))
        for nights in (None,[],[0],[11],['2'],[True],[2.5]):
            with self.subTest(nights=nights),self.assertRaises(ValueError):
                search_config(nights=nights)

    def test_disjoint_weekends_query_each_pair_and_keep_same_city(self):
        from datetime import date, timedelta
        start=date.fromisoformat(search_config()['start'])
        first=start+timedelta(days=(5-start.weekday())%7)
        pairs=[dict(start=(first+timedelta(days=n)).isoformat(),end=(first+timedelta(days=n+1)).isoformat()) for n in (0,14)]
        watch=search_config(start=pairs[0]['start'],end=pairs[-1]['end'],date_mode='fixed',date_pairs=pairs)
        flights=[offer(watch,dict(departure=p['start'],arrival=p['end'])) for p in pairs]
        with patch.object(deals.Kiwi,'call'),patch.object(deals.Kiwi,'query',side_effect=[[flights[0]],[flights[1]]]) as query:
            result=deals.search(watch)
        self.assertEqual(result['total'],2)
        self.assertEqual(len(result['offers']),2)
        self.assertEqual(query.call_count,2)
        self.assertTrue(all('returnDate' in call.args[0] and 'departureDateTo' not in call.args[0] for call in query.call_args_list))
        self.assertTrue(all(deals.accepts(f,watch,None) for f in flights))
        bad=deepcopy(flights[0]);bad['inbound']['departureTime']=pairs[-1]['end']+'T12:00:00'
        self.assertFalse(deals.accepts(bad,watch,None))
        for invalid in ([],None,[{}],pairs*3,[dict(start=pairs[0]['start'],end=pairs[-1]['end'])]):
            with self.subTest(invalid=invalid),self.assertRaises(ValueError):
                search_config(start=pairs[0]['start'],end=pairs[-1]['end'],date_mode='fixed',date_pairs=invalid)

    def test_native_currency_query_and_budget_are_preserved(self):
        watch = search_config(currency='CNY', date_mode='fixed', budget=2000)
        flight = offer(watch, dict(departure=watch['start'], arrival=watch['end']))
        with patch.object(deals.Kiwi, 'call'), patch.object(deals.Kiwi, 'query', return_value=[flight]) as query:
            result = deals.search(watch)
        self.assertEqual(query.call_args.args[0]['currency'], 'CNY')
        self.assertEqual(query.call_args.args[0]['price_to'], 2000)
        self.assertEqual(result['offers'][0]['currency'], 'CNY')
        with self.assertRaises(ValueError):
            search_config(currency='XXX')

    def test_oneway_search_omits_return_and_filters_outbound(self):
        for mode in ('fixed', 'range'):
            watch = search_config(trip_type='oneway', date_mode=mode, nights=[], max_stops=0)
            flight = offer(watch, dict(departure=watch['start'], arrival=watch['end']))
            flight.pop('inbound')
            self.assertTrue(deals.accepts(flight, watch, None))
            if mode == 'range':
                from datetime import date
                other_day = (date.fromisoformat(watch['start']).weekday()+1)%7
                filtered = search_config(trip_type='oneway', weekdays=[other_day], nights=[])
                self.assertFalse(deals.accepts(flight, filtered, None))
            for path, value in [('price', 0), ('price', 999999)]:
                self.assertFalse(deals.accepts(dict(flight, **{path:value}), dict(watch, budget=2000), None))
            bad = deepcopy(flight); bad['outbound']['stops'] = 1
            self.assertFalse(deals.accepts(bad, watch, None))
            bad = deepcopy(flight); bad['outbound']['to'] = 'HKG'
            self.assertFalse(deals.accepts(bad, watch, None))
            with patch.object(deals.Kiwi, 'call'), patch.object(deals.Kiwi, 'query', return_value=[flight]) as query:
                self.assertEqual(len(deals.search(watch)['offers']), 1)
            args = query.call_args.args[0]
            for key in ('returnDate', 'returnDateTo', 'nights_in_dst_from', 'nights_in_dst_to'):
                self.assertNotIn(key, args)
            self.assertEqual('departureDateTo' in args, mode == 'range')
            self.assertEqual(watch['nights'], [])

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
