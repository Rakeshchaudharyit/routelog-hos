from copy import deepcopy
from datetime import datetime
from django.test import SimpleTestCase
from .services.daily_logs import DEFAULT_LOG_METADATA, prepare_daily_logs, validate_daily_log, DailyLogError
from .services.hos import HOSPlanner
from .test_hos import route


class DailyLogDetailsTests(SimpleTestCase):
    def logs(self, first=4, second=12, start=datetime(2026,10,5,6), metadata=None):
        schedule=HOSPlanner(18,start).schedule(route(first,second))
        return prepare_daily_logs(schedule['daily_logs'],schedule['events'],metadata),schedule

    def test_valid_date(self):
        logs,_=self.logs();self.assertEqual([log['date'] for log in logs],['2026-10-05','2026-10-06'])

    def test_carrier_and_office(self):
        for log in self.logs()[0]:
            self.assertEqual(log['carrier'],{'name':'RouteLog Demo Transport','main_office_address':'Atlanta, GA'})

    def test_driver_and_codriver(self):
        for log in self.logs()[0]:self.assertEqual(log['driver'],{'name':'Alex Morgan','co_driver_name':None})

    def test_vehicle(self):
        self.assertEqual(self.logs()[0][0]['vehicle_number'],'TRK-102')

    def test_shipping(self):
        self.assertEqual(self.logs()[0][0]['shipping_document_number'],'RL-2026-1042')

    def test_actual_miles_and_distinct_days(self):
        logs,schedule=self.logs()
        self.assertEqual(logs[0]['total_miles'],550)
        self.assertEqual(logs[1]['total_miles'],250)
        self.assertAlmostEqual(sum(log['total_miles'] for log in logs),schedule['summary']['distance_miles'])

    def test_midnight_miles_split(self):
        logs,_=self.logs(2,0,datetime(2026,10,5,23))
        self.assertEqual([log['total_miles'] for log in logs],[50,50])

    def test_totals_and_coverage(self):
        for log in self.logs()[0]:
            self.assertEqual(sum(log['totals'].values()),24)
            self.assertEqual(log['total_seconds'],86400)
            self.assertEqual(log['segments'][0]['start_seconds'],0)
            self.assertEqual(log['segments'][-1]['end_seconds'],86400)
            for a,b in zip(log['segments'],log['segments'][1:]):self.assertEqual(a['end_seconds'],b['start_seconds'])

    def test_remarks_only_event_start_date(self):
        logs,_=self.logs()
        for log in logs:
            self.assertTrue(all(item['time'][:10]==log['date'] for item in log['remark_details']))
        self.assertFalse(any('Pickup' in remark for remark in logs[1]['remarks']))

    def test_pickup_correct_date_and_time(self):
        logs,_=self.logs();pickup=next(item for item in logs[0]['remark_details'] if item['type']=='pickup')
        self.assertEqual(pickup['time'],'2026-10-05T10:00:00')

    def test_dropoff_correct_date(self):
        logs,_=self.logs();self.assertTrue(any(item['type']=='dropoff' for item in logs[1]['remark_details']))

    def test_rest_not_duplicated_at_midnight(self):
        logs,_=self.logs()
        self.assertEqual(sum(item['type']=='daily_rest' for log in logs for item in log['remark_details']),1)
        self.assertTrue(any(item['type']=='daily_rest' for item in logs[0]['remark_details']))

    def test_uncertified(self):
        for log in self.logs()[0]:self.assertEqual(log['certification'],{'driver_name':'Alex Morgan','certified':False,'status':'planning_record'})

    def test_dynamic_long_trip(self):
        logs,_=self.logs(20,40);self.assertGreater(len(logs),3)
        self.assertAlmostEqual(sum(log['total_miles'] for log in logs),3000)
        self.assertTrue(any(item['type']=='fuel' for log in logs for item in log['remark_details']))

    def test_custom_metadata_and_defaults_not_mutated(self):
        original=deepcopy(DEFAULT_LOG_METADATA)
        logs,_=self.logs(metadata={'driver_name':'Pat Driver','co_driver_name':'Sam','carrier_name':'Example Carrier'})
        self.assertEqual(logs[0]['driver']['name'],'Pat Driver')
        self.assertEqual(logs[0]['certification']['driver_name'],'Pat Driver')
        self.assertEqual(logs[0]['vehicle_number'],'TRK-102')
        self.assertEqual(DEFAULT_LOG_METADATA,original)

    def test_preparation_does_not_change_scheduler(self):
        schedule=HOSPlanner(18).schedule(route(4,12));original=deepcopy(schedule)
        prepare_daily_logs(schedule['daily_logs'],schedule['events'])
        self.assertEqual(schedule,original)

    def test_invalid_log_not_normalized(self):
        good=self.logs()[0][0]
        for mutate in (lambda log:log.update(date='2026-02-30'),lambda log:log.update(distance_miles=-1),lambda log:log['totals_seconds'].update(driving=0),lambda log:log['segments'][0].update(start_seconds=1),lambda log:log['segments'][1].update(start_seconds=0),lambda log:log['driver'].update(name=''),lambda log:log['certification'].update(certified=True)):
            with self.subTest(mutate=mutate):
                invalid=deepcopy(good);mutate(invalid)
                with self.assertRaises(DailyLogError):validate_daily_log(invalid)
