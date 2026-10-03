from django.test import SimpleTestCase
from .test_hos import route
from .services.hos import HOSPlanner
from .services.route_progress import RouteProgress


def geographic_route(miles, first_hours=4, second_hours=20, first_miles=200):
    result=route(first_hours,second_hours)
    result['distance_miles']=miles
    result['legs'][0]['distance_miles']=min(first_miles,miles)
    result['legs'][1]['distance_miles']=miles-result['legs'][0]['distance_miles']
    result['geometry']={'type':'LineString','coordinates':[[0,0],[1,0],[1,1]]}
    for leg,points in zip(result['legs'],((0,1),(1,2))):
        for key,index in zip(('from','to'),points):
            lng,lat=result['geometry']['coordinates'][index]
            leg[key]={'address':('Start','Pickup','Dropoff')[index],'lat':lat,'lng':lng}
    return result


class FuelStopTests(SimpleTestCase):
    def plan(self,miles,cycle=18,**kwargs):
        r=geographic_route(miles,**kwargs)
        result=HOSPlanner(cycle).schedule(r)
        self.assertTrue(result['compliance']['compliant'])
        self.assertTrue(result['compliance']['fuel']['compliant'])
        stops=[e for e in result['events'] if e['type']=='fuel']
        previous=0
        for stop in stops:
            self.assertLessEqual(stop['route_mile']-previous,1000+1e-7)
            previous=stop['route_mile']
            self.assertEqual(stop['duration_seconds'],1800)
            self.assertEqual(stop['status'],'on_duty')
        self.assertLessEqual(miles-previous,1000+1e-7)
        self.assertAlmostEqual(sum(e['distance_miles'] for e in result['events']),miles)
        for log in result['daily_logs']:
            self.assertEqual(sum(log['totals_seconds'].values()),86400)
        return result

    def test_under_threshold(self):
        self.assertEqual(self.plan(912)['summary']['fuel_stops'],0)

    def test_exact_destination_threshold(self):
        self.assertEqual(self.plan(1000)['summary']['fuel_stops'],0)

    def test_one_mile_beyond(self):
        self.assertEqual(self.plan(1001)['summary']['fuel_stops'],1)

    def test_two_intervals(self):
        self.assertEqual(self.plan(2100)['summary']['fuel_stops'],2)

    def test_exact_two_thousand_destination(self):
        result=self.plan(2000,first_hours=4,second_hours=16)
        self.assertEqual(result['summary']['fuel_stops'],1)

    def test_fuel_qualifies_break_no_duplicate(self):
        result=self.plan(1100,first_hours=0,second_hours=8.8,first_miles=0)
        events=result['events'];fuel=next(e for e in events if e['type']=='fuel')
        self.assertAlmostEqual(fuel['route_mile'],1000)
        self.assertFalse(any(e['type']=='break' for e in events))
        self.assertAlmostEqual(result['summary']['cycle_used_at_end'],18+8.8+2+.5)
        self.assertAlmostEqual(result['summary']['trip_duration_hours'],8.8+2+.5)

    def test_fuel_affects_fourteen_hour_clock(self):
        r=geographic_route(1100,0,10.5,0)
        planner=HOSPlanner(0)
        planner.on_duty('inspection',3*3600,None,'Inspection')
        result=planner.schedule(r)
        self.assertTrue(result['compliance']['compliant'])
        rest=next(e for e in result['events'] if e['type']=='daily_rest')
        self.assertEqual(rest['start'],'2026-10-05T20:00:00')
        self.assertEqual(result['summary']['fuel_stops'],1)

    def test_fuel_cycle_capacity_requires_restart(self):
        result=self.plan(1100,cycle=60.75,first_hours=0,second_hours=8.8,first_miles=0)
        fuel=next(e for e in result['events'] if e['type']=='fuel')
        restart=next(e for e in result['events'] if e['type']=='cycle_restart')
        self.assertEqual(restart['end'],fuel['start'])
        self.assertEqual(restart['route_mile'],fuel['route_mile'])

    def test_stops_have_coordinates(self):
        for cycle in (18,69):
            result=self.plan(2100,cycle)
            for event in result['events']:
                self.assertIsNotNone(event['location'])
                self.assertTrue(-90<=event['location']['lat']<=90)
                self.assertTrue(-180<=event['location']['lng']<=180)

    def test_exact_selected_locations(self):
        r=geographic_route(912)
        events=HOSPlanner(18).schedule(r)['events']
        for kind,location in (('trip_start',r['legs'][0]['from']),('pickup',r['legs'][0]['to']),('dropoff',r['legs'][1]['to'])):
            self.assertEqual(next(e for e in events if e['type']==kind)['location'],location)

    def test_no_progress_during_stops(self):
        events=self.plan(2100,69)['events']
        for index,event in enumerate(events[:-1]):
            if event['status']!='driving':
                self.assertEqual(event['route_mile'],event['route_mile_at_end'])
                self.assertAlmostEqual(event['route_mile_at_end'],events[index+1]['route_mile'])
                if event['type'] in ('daily_rest','cycle_restart'):
                    self.assertEqual(event['location'],events[index+1]['location'])

    def test_locations_match_normalized_polyline(self):
        r=geographic_route(2100)
        result=HOSPlanner(18).schedule(r)
        progress=RouteProgress(r['geometry'],2100)
        for event in result['events']:
            if event['type'] in ('fuel','break','daily_rest','cycle_restart'):
                expected=progress.point_at_distance(event['route_mile'])
                self.assertEqual(event['location']['lat'],expected['lat'])
                self.assertEqual(event['location']['lng'],expected['lng'])
                self.assertIn('Mile',event['location']['address'])

    def test_atlanta_duration_unchanged(self):
        result=self.plan(911.8648965044142,first_hours=16821/3600,second_hours=42073.7/3600,first_miles=246.89345472440945)
        self.assertEqual(result['summary']['end_time'],'2026-10-06T10:21:35')
        self.assertEqual(result['summary']['fuel_stops'],0)
        self.assertEqual(result['summary']['daily_rests'],1)

    def test_fuel_threshold_carries_across_pickup(self):
        result=self.plan(1100,first_hours=8,second_hours=.8,first_miles=1000)
        events=result['events'];pickup=next(e for e in events if e['type']=='pickup');fuel=next(e for e in events if e['type']=='fuel')
        self.assertEqual(pickup['end'],fuel['start'])
        self.assertAlmostEqual(fuel['route_mile'],1000)
        self.assertFalse(any(e['type']=='break' for e in events))
