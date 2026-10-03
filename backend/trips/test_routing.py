import json
from copy import deepcopy
from io import BytesIO
from unittest.mock import MagicMock, patch
from urllib.error import HTTPError, URLError
from django.test import SimpleTestCase
from trips.services.routing import calculate_route, RoutingError, RoutingTimeout, NoRouteError

class RoutingTests(SimpleTestCase):
    def setUp(self):
        self.locations = [{'address': 'Atlanta', 'lat': 33.749, 'lng': -84.388}, {'address': 'Nashville', 'lat': 36.1627, 'lng': -86.7816}, {'address': 'Dallas', 'lat': 32.7767, 'lng': -96.797}]
        self.data = {'code': 'Ok', 'routes': [{'distance': 160934.4, 'duration': 7200, 'geometry': {'type': 'LineString', 'coordinates': [[-84.388,33.749],[-86.7816,36.1627],[-96.797,32.7767]]}, 'legs': [{'distance': 80467.2, 'duration': 3600}, {'distance': 80467.2, 'duration': 3600}]}]}
    def response(self, data):
        response = MagicMock()
        response.__enter__.return_value.read.return_value = json.dumps(data).encode()
        return response
    @patch('trips.services.routing.urlopen')
    def test_order_units_geometry_and_legs(self, upstream):
        upstream.return_value = self.response(self.data)
        route = calculate_route(self.locations)
        url = upstream.call_args.args[0].full_url
        self.assertIn('/driving/-84.388,33.749;-86.7816,36.1627;-96.797,32.7767?', url)
        for query in ('overview=full', 'geometries=geojson', 'steps=true'):
            self.assertIn(query, url)
        self.assertEqual(upstream.call_args.kwargs['timeout'], 10)
        self.assertAlmostEqual(route['distance_miles'], 100)
        self.assertEqual(route['duration_hours'], 2)
        self.assertEqual(route['geometry'], self.data['routes'][0]['geometry'])
        self.assertEqual(route['legs'][0]['from'], self.locations[0])
        self.assertEqual(route['legs'][0]['to'], self.locations[1])
        self.assertEqual(route['legs'][1]['to'], self.locations[2])
        self.assertAlmostEqual(route['legs'][0]['distance_miles'], 50)
    @patch('trips.services.routing.urlopen')
    def test_no_route(self, upstream):
        for code in ('NoRoute', 'NoSegment'):
            upstream.return_value = self.response({'code': code})
            with self.assertRaises(NoRouteError): calculate_route(self.locations)
        upstream.side_effect = HTTPError('url',400,'bad',{},BytesIO(b'{"code":"NoRoute"}'))
        with self.assertRaises(NoRouteError): calculate_route(self.locations)
    @patch('trips.services.routing.urlopen')
    def test_network_failures(self, upstream):
        for error in (TimeoutError(), URLError(TimeoutError())):
            upstream.side_effect = error
            with self.assertRaises(RoutingTimeout): calculate_route(self.locations)
        upstream.side_effect = URLError('offline')
        with self.assertRaises(RoutingError): calculate_route(self.locations)
    @patch('trips.services.routing.urlopen')
    def test_malformed_upstream(self, upstream):
        samples = [None, {}, {'code': 'Ok', 'routes': []}]
        for path, value in [('distance', -1), ('duration', True), ('geometry', {'type':'Point','coordinates':[0,0]}), ('geometry', {'type':'LineString','coordinates':[[0,0],[181,0]]}), ('legs', [])]:
            data = deepcopy(self.data); data['routes'][0][path] = value; samples.append(data)
        for data in samples:
            upstream.return_value = self.response(data)
            with self.subTest(data=data), self.assertRaises(RoutingError): calculate_route(self.locations)
    @patch('trips.services.routing.urlopen')
    def test_invalid_coordinates_never_request_upstream(self, upstream):
        for lat, lng in ((91,0),(0,181),(float('nan'),0)):
            locations = deepcopy(self.locations); locations[0].update(lat=lat,lng=lng)
            with self.assertRaises(ValueError): calculate_route(locations)
        upstream.assert_not_called()
