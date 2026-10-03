from copy import deepcopy
from unittest.mock import patch
from trips.services.routing import RoutingError, RoutingTimeout, NoRouteError
from rest_framework.test import APITestCase


class TripPlanTests(APITestCase):
    def setUp(self):
        from django.contrib.auth import get_user_model
        self.client.force_authenticate(get_user_model().objects.create_user(username="route-tester"))
        self.payload = {
            'current_location': {'address': 'Atlanta, GA, USA', 'lat': 33.749, 'lng': -84.388},
            'pickup_location': {'address': 'Nashville, TN, USA', 'lat': 36.1627, 'lng': -86.7816},
            'dropoff_location': {'address': 'Dallas, TX, USA', 'lat': 32.7767, 'lng': -96.797},
            'current_cycle_used': 18,
        }

        self.route = {'distance_miles': 912, 'duration_hours': 15.75, 'geometry': {'type': 'LineString', 'coordinates': [[-84.388, 33.749], [-86.7816, 36.1627], [-96.797, 32.7767]]}, 'legs': [{'from': self.payload['current_location'], 'to': self.payload['pickup_location'], 'distance_miles': 250, 'duration_hours': 4}, {'from': self.payload['pickup_location'], 'to': self.payload['dropoff_location'], 'distance_miles': 662, 'duration_hours': 11.75}]}
        patcher = patch('trips.services.planning.calculate_route', return_value=self.route)
        self.routing = patcher.start()
        self.addCleanup(patcher.stop)

    def post(self, payload):
        return self.client.post('/api/trips/plan/', payload, format='json')

    def test_valid_request_returns_calculated_schedule(self):
        response = self.post(self.payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data['trip_id'].startswith('RL-'))
        self.assertEqual(data['status'], 'ok')
        self.assertEqual(data['summary']['distance_miles'], 912)
        self.assertEqual(data['summary']['cycle_remaining'], 34.25)
        self.assertEqual(len(data['daily_logs']), 2)
        self.assertEqual(len(data['route']['legs']), 2)
        self.assertNotIn('route_stops', data)
        self.assertEqual(data['hos_status'], 'calculated')
        self.assertTrue(data['events'])
        self.assertEqual(data['requested_locations']['current_location'], self.payload['current_location'])
        for log in data['daily_logs']:
            self.assertEqual(sum(segment['end_seconds']-segment['start_seconds'] for segment in log['segments']), 86400)

    def test_each_location_required(self):
        for key in ('current_location', 'pickup_location', 'dropoff_location'):
            with self.subTest(key=key):
                payload = deepcopy(self.payload)
                del payload[key]
                response = self.post(payload)
                self.assertEqual(response.status_code, 400)
                self.assertIn(key, response.json())

    def test_location_fields_required_and_nonblank(self):
        for field in ('address', 'lat', 'lng'):
            for value in ('missing', None, ''):
                with self.subTest(field=field, value=value):
                    payload = deepcopy(self.payload)
                    if value == 'missing':
                        del payload['current_location'][field]
                    else:
                        payload['current_location'][field] = value
                    self.assertEqual(self.post(payload).status_code, 400)

    def test_null_location(self):
        payload = deepcopy(self.payload)
        payload['current_location'] = None
        self.assertEqual(self.post(payload).status_code, 400)

    def test_cycle_bounds(self):
        for value in (-1, 70.01, 'NaN', 'Infinity', 'not a number', None):
            with self.subTest(value=value):
                self.assertEqual(self.post({**self.payload, 'current_cycle_used': value}).status_code, 400)
        for value in (0, 18, 69.75, 70):
            with self.subTest(value=value):
                response = self.post({**self.payload, 'current_cycle_used': value})
                self.assertEqual(response.status_code, 200)
                self.assertGreaterEqual(response.json()['summary']['cycle_remaining'],0)
                self.assertTrue(response.json()['compliance']['compliant'])

    def test_missing_cycle(self):
        del self.payload['current_cycle_used']
        self.assertEqual(self.post(self.payload).status_code, 400)

    def test_coordinate_validation(self):
        for field, invalid, valid in (
            ('lat', [-90.01, 90.01, 'NaN', 'Infinity'], [-90, 0, 90]),
            ('lng', [-180.01, 180.01, 'NaN', 'Infinity'], [-180, 0, 180]),
        ):
            for value in invalid + valid:
                with self.subTest(field=field, value=value):
                    payload = deepcopy(self.payload)
                    payload['pickup_location'][field] = value
                    self.assertEqual(self.post(payload).status_code, 400 if value in invalid else 200)

    def test_selected_coordinates_are_forwarded_to_routing(self):
        payload = deepcopy(self.payload)
        payload['current_location'] = {'address': 'Different selected location', 'lat': 0, 'lng': 0}
        data = self.post(payload).json()
        self.assertEqual(data['summary']['distance_miles'], 912)
        self.assertEqual(data['requested_locations']['current_location']['lat'], 0)
        self.assertEqual(self.routing.call_args.args[0][0], payload['current_location'])

    def test_requests_do_not_share_scheduler_state(self):
        self.post({**self.payload, 'current_cycle_used': 30})
        data = self.post(self.payload).json()
        self.assertEqual(data['summary']['cycle_used_at_start'],18)
        self.assertEqual(data['summary']['start_time'],'2026-10-05T06:00:00')

    def test_invalid_method_and_json(self):
        self.assertEqual(self.client.get('/api/trips/plan/').status_code, 405)
        response = self.client.post('/api/trips/plan/', '{invalid', content_type='application/json')
        self.assertEqual(response.status_code, 400)

    def test_routing_errors_are_actionable(self):
        for error in (RoutingError('Unavailable'), RoutingTimeout('Timed out'), NoRouteError('No route')):
            with self.subTest(error=type(error).__name__):
                self.routing.side_effect = error
                response = self.post(self.payload)
                self.assertEqual(response.status_code, error.status_code)
                self.assertEqual(response.json(), {'detail': str(error)})

    def test_start_time_validation_and_custom_schedule(self):
        for value in ('bad', '2026-10-05', None, True, '2026-10-05T06:00:00.5'):
            self.assertEqual(self.post({**self.payload, 'start_time': value}).status_code,400)
        data=self.post({**self.payload,'start_time':'2026-10-07T23:00:00-05:00'}).json()
        self.assertEqual(data['summary']['start_time'],'2026-10-07T23:00:00-05:00')
        self.assertEqual(data['daily_logs'][0]['date'],'2026-10-07')
        self.assertTrue(data['compliance']['compliant'])

    def test_log_metadata_defaults_and_override(self):
        data=self.post(self.payload).json()
        self.assertEqual(data['daily_logs'][0]['carrier']['name'],'RouteLog Demo Transport')
        data=self.post({**self.payload,'log_metadata':{'driver_name':'Pat','co_driver_name':'Sam','vehicle_number':'TRK-7'}}).json()
        self.assertEqual(data['daily_logs'][0]['driver'],{'name':'Pat','co_driver_name':'Sam'})
        self.assertEqual(data['daily_logs'][0]['vehicle_number'],'TRK-7')
        self.assertFalse(data['daily_logs'][0]['certification']['certified'])
        self.assertEqual(self.post({**self.payload,'log_metadata':{'driver_name':''}}).status_code,400)
