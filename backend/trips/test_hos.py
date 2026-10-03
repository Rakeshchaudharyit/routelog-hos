from datetime import datetime
from copy import deepcopy
from django.test import SimpleTestCase
from .services.hos import HOSPlanner, build_daily_logs, assess_compliance


def route(first=2, second=3):
    locations = [{'address': name, 'lat': 0, 'lng': index} for index, name in enumerate(('Start', 'Pickup', 'Dropoff'))]
    return {'distance_miles': (first+second)*50, 'duration_hours': first+second,
            'legs': [{'from': locations[n], 'to': locations[n+1], 'distance_miles': h*50, 'duration_hours': h}
                     for n, h in enumerate((first, second))]}


class HOSPlannerTests(SimpleTestCase):
    def plan(self, first=2, second=3, cycle=18, start=datetime(2026,10,5,6)):
        result = HOSPlanner(cycle, start).schedule(route(first, second))
        self.assert_legal(result, cycle)
        return result

    def types(self, result, kind):
        return [e for e in result['events'] if e['type'] == kind]

    def assert_legal(self, result, cycle):
        daily = break_driving = 0
        used = round(cycle*3600)
        window = previous = None
        for event in result['events']:
            start, end = datetime.fromisoformat(event['start']), datetime.fromisoformat(event['end'])
            seconds = int((end-start).total_seconds())
            if previous is not None: self.assertEqual(start, previous)
            self.assertGreaterEqual(seconds, 0)
            self.assertEqual(seconds, event['duration_seconds'])
            previous = end
            if event['status'] in ('driving','on_duty') and seconds:
                window = window or start
                used += seconds
                self.assertLessEqual(used, 70*3600)
            if event['status'] == 'driving':
                daily += seconds; break_driving += seconds
                self.assertLessEqual(daily, 11*3600)
                self.assertLessEqual(break_driving, 8*3600)
                self.assertLessEqual((end-window).total_seconds(), 14*3600)
            elif seconds >= 1800: break_driving = 0
            if event['status'] == 'off_duty' and seconds >= 36000:
                daily = break_driving = 0; window = None
            if event['type'] == 'cycle_restart':
                self.assertEqual(seconds, 34*3600); used = 0
        self.assertAlmostEqual(result['summary']['cycle_used_at_end'], used/3600)
        self.assertTrue(result['compliance']['compliant'])
        for log in result['daily_logs']:
            self.assertEqual(log['segments'][0]['start_seconds'], 0)
            self.assertEqual(log['segments'][-1]['end_seconds'], 86400)
            self.assertEqual(sum(s['end_seconds']-s['start_seconds'] for s in log['segments']), 86400)
            self.assertEqual(sum(log['totals_seconds'].values()), 86400)
            for a,b in zip(log['segments'], log['segments'][1:]): self.assertEqual(a['end_seconds'],b['start_seconds'])

    def test_short_trip(self):
        result=self.plan()
        self.assertFalse(self.types(result,'break'))
        self.assertFalse(self.types(result,'daily_rest'))
        self.assertEqual(result['summary']['trip_duration_hours'],7)

    def test_more_than_eight_less_than_eleven(self):
        result=self.plan(0,9)
        self.assertEqual(len(self.types(result,'break')),1)
        self.assertEqual(self.types(result,'break')[0]['duration_seconds'],1800)
        self.assertFalse(self.types(result,'daily_rest'))

    def test_more_than_eleven(self):
        result=self.plan(4,12)
        self.assertEqual(len(self.types(result,'daily_rest')),1)
        self.assertEqual(self.types(result,'daily_rest')[0]['duration_seconds'],36000)
        self.assertEqual(result['summary']['driving_days'],2)

    def test_pickup_and_dropoff_exactly_one_hour(self):
        result=self.plan()
        for kind in ('pickup','dropoff'):
            events=self.types(result,kind)
            self.assertEqual(len(events),1)
            self.assertEqual(events[0]['duration_seconds'],3600)
            self.assertEqual(events[0]['status'],'on_duty')

    def test_pickup_satisfies_break_at_boundary(self):
        result=self.plan(8,2)
        self.assertFalse(self.types(result,'break'))
        self.assertEqual(result['summary']['trip_duration_hours'],12)

    def test_pickup_resets_cumulative_break_clock(self):
        self.assertFalse(self.types(self.plan(5,5),'break'))

    def test_fourteen_hour_window_including_pickup(self):
        planner=HOSPlanner(0)
        planner.on_duty('inspection',4*3600,None,'Inspection')
        result=planner.schedule(route(5,5))
        self.assert_legal(result,0)
        self.assertEqual(self.types(result,'daily_rest')[0]['start'],'2026-10-05T20:00:00')
        self.assertEqual([e['duration_hours'] for e in self.types(result,'driving')],[5,4,1])

    def test_short_break_does_not_extend_window(self):
        planner=HOSPlanner(0)
        planner.on_duty('inspection',4*3600,None,'Inspection')
        result=planner.schedule(route(0,11))
        self.assert_legal(result,0)
        self.assertEqual(self.types(result,'daily_rest')[0]['start'],'2026-10-05T20:00:00')

    def test_cycle_zero(self):
        result=self.plan(cycle=0)
        self.assertEqual(result['summary']['cycle_used_at_end'],7)
        self.assertEqual(result['summary']['cycle_remaining'],63)

    def test_cycle_sixty(self):
        result=self.plan(2,12,cycle=60)
        self.assertEqual(len(self.types(result,'cycle_restart')),1)
        restart=self.types(result,'cycle_restart')[0]
        self.assertEqual(restart['cycle_used_at_end'],0)
        self.assertEqual(sum(e['duration_hours'] for e in result['events'][:result['events'].index(restart)] if e['status'] in ('on_duty','driving')),10)

    def test_near_seventy_and_seventy(self):
        for cycle in (69,69.75,70):
            with self.subTest(cycle=cycle): self.assertEqual(len(self.types(self.plan(cycle=cycle),'cycle_restart')),1)

    def test_service_restarts_before_it_exceeds_cycle(self):
        result=self.plan(1,1,cycle=68.5)
        self.assertEqual(self.types(result,'cycle_restart')[0]['end'],self.types(result,'pickup')[0]['start'])

    def test_exact_cycle_finish_no_unneeded_restart(self):
        result=self.plan(cycle=63)
        self.assertFalse(self.types(result,'cycle_restart'))
        self.assertEqual(result['summary']['cycle_remaining'],0)

    def test_midnight_split(self):
        result=self.plan(2,0,cycle=0,start=datetime(2026,10,5,23))
        logs=result['daily_logs']
        self.assertEqual(len(logs),2)
        self.assertEqual(logs[0]['totals_seconds']['driving'],3600)
        self.assertEqual(logs[1]['totals_seconds']['driving'],3600)
        self.assertEqual(logs[0]['segments'][0]['status'],'off_duty')

    def test_multiple_days_and_restart_logs(self):
        result=self.plan(30,45,cycle=60)
        self.assertGreater(len(result['daily_logs']),5)
        self.assertEqual(sum(log['totals_seconds']['driving'] for log in result['daily_logs']),75*3600)
        self.assertAlmostEqual(sum(log['distance_miles'] for log in result['daily_logs']),3750)
        self.assertAlmostEqual(result['daily_logs'][-1]['cycle_used'],result['summary']['cycle_used_at_end'])

    def test_long_rests_reset_daily_but_not_cycle(self):
        result=self.plan(4,12,cycle=18)
        self.assertEqual(result['summary']['cycle_used_at_end'],36)
        self.assertEqual(result['summary']['cycle_restarts'],0)

    def test_fractional_seconds_and_determinism(self):
        r=route(1.0001,2.0002)
        a=HOSPlanner(18).schedule(r);b=HOSPlanner(18).schedule(r)
        self.assertEqual(a,b)
        self.assertEqual(sum(e['duration_seconds'] for e in a['events'] if e['status']=='driving'),sum(round(l['duration_hours']*3600) for l in r['legs']))

    def test_compliance_detects_illegal_events(self):
        event=deepcopy(self.types(self.plan(),'driving')[0])
        event['end']='2026-10-05T21:00:00'
        checks=assess_compliance([event],69*3600)
        self.assertFalse(checks['compliant'])
        self.assertTrue(all(c['status']=='violation' for c in checks['checks']))

    def test_invalid_cycle_and_empty_logs(self):
        for value in (-1,71,float('nan')):
            with self.assertRaises(ValueError): HOSPlanner(value)
        self.assertEqual(build_daily_logs([]),[])

    def test_varied_routes_obey_all_limits(self):
        for first,second,cycle in ((7.9,8.1,0),(11,11,60),(0,24,69),(0,0,70),(20,50,18),(8,3,59),(3.75,5.2,67.2)):
            with self.subTest(first=first,second=second,cycle=cycle): self.plan(first,second,cycle)

    def test_atlanta_baseline(self):
        result=self.plan(16821/3600,42073.7/3600,18)
        self.assertEqual(result['summary']['end_time'],'2026-10-06T10:21:35')
        self.assertEqual(result['summary']['daily_rests'],1)
        self.assertEqual(result['summary']['required_30m_breaks'],0)
        self.assertEqual(result['summary']['driving_days'],2)
        self.assertEqual(len(result['daily_logs']),2)
        self.assertEqual(result['daily_logs'][0]['totals_seconds']['driving'],39600)
        self.assertEqual(result['daily_logs'][1]['totals_seconds']['driving'],19295)
        self.assertAlmostEqual(result['summary']['cycle_remaining'],33.6402777778)

    def test_fuel_extension_qualifies_as_break(self):
        planner=HOSPlanner(0)
        legs=route(8,1)['legs']
        planner.drive_leg(legs[0])
        planner.on_duty('fuel',1800,None,'Fuel')
        planner.drive_leg(legs[1])
        self.assertEqual(planner.break_driving,3600)
        self.assertEqual(planner.cycle_used,34200)
        self.assertFalse(any(event['type']=='break' for event in planner.events))

    def test_long_route_now_schedules_required_fuel(self):
        result=self.plan(10,12)
        self.assertFalse(result['compliance']['warnings'])
        self.assertEqual(len(self.types(result,'fuel')),1)
        self.assertTrue(result['compliance']['fuel']['compliant'])

    def test_gaps_fill_off_duty(self):
        result=self.plan(1,1)
        events=deepcopy(result['events'])
        # A legal unscheduled hour between driving and pickup remains off duty.
        for event in events[2:]:
            from datetime import timedelta
            for field in ('start','end'):
                event[field]=(datetime.fromisoformat(event[field])+timedelta(hours=1)).isoformat()
        logs=build_daily_logs(events,18*3600)
        self.assertEqual(logs[0]['totals_seconds']['off_duty'],20*3600)
        self.assertIn({'start_seconds':7*3600,'end_seconds':8*3600,'status':'off_duty'},logs[0]['segments'])
