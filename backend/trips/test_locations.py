import json
from unittest.mock import MagicMock, patch
from urllib.error import URLError
from django.core.cache import cache
from rest_framework.test import APITestCase
from .services import geocoding


class LocationSearchTests(APITestCase):
    def setUp(self):
        from django.contrib.auth import get_user_model
        self.client.force_authenticate(get_user_model().objects.create_user(username="route-tester"))
        cache.clear()
        geocoding._last_request = 0
        self.raw = [{'display_name': 'Dallas, Texas, United States', 'lat': '32.7767', 'lon': '-96.797', 'type': 'city', 'importance': 0.8, 'private_extra': 'not exposed'}]

    def upstream(self, data):
        response = MagicMock()
        response.__enter__.return_value.read.return_value = json.dumps(data).encode()
        return response

    def test_query_validation(self):
        for query in (None, '', 'ab', '   ab   ', 'x'*201):
            with self.subTest(query=query), patch.object(geocoding, 'urlopen') as upstream:
                params = {} if query is None else {'q': query}
                self.assertEqual(self.client.get('/api/locations/search/', params).status_code, 400)
                upstream.assert_not_called()

    def test_normalization_headers_timeout_and_cache(self):
        with patch.object(geocoding, 'urlopen', return_value=self.upstream(self.raw)) as upstream:
            response = self.client.get('/api/locations/search/', {'q': '  Dallas  '})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json(), {'results': [{'address':'Dallas, Texas, United States','lat':32.7767,'lng':-96.797,'type':'city','importance':0.8}]})
            request = upstream.call_args.args[0]
            self.assertIn('q=Dallas', request.full_url)
            self.assertEqual(request.get_header('User-agent'), 'RouteLog-HOS-Assessment/1.0')
            self.assertEqual(upstream.call_args.kwargs['timeout'], 5)
            self.assertEqual(self.client.get('/api/locations/search/', {'q':'dallas'}).status_code, 200)
            self.assertEqual(upstream.call_count, 1)

    def test_limit_and_invalid_results(self):
        raw = [{'display_name':'Bad','lat':'NaN','lon':0}] + [{**self.raw[0], 'display_name':f'Dallas {i}'} for i in range(10)]
        with patch.object(geocoding,'urlopen',return_value=self.upstream(raw)):
            response = self.client.get('/api/locations/search/', {'q':'Dallas'})
            self.assertEqual(len(response.json()['results']),5)

    def test_empty_results_cached(self):
        with patch.object(geocoding,'urlopen',return_value=self.upstream([])) as upstream:
            self.assertEqual(self.client.get('/api/locations/search/', {'q':'Nothing'}).json(),{'results':[]})
            self.client.get('/api/locations/search/', {'q':'Nothing'})
            self.assertEqual(upstream.call_count,1)

    def test_upstream_failure(self):
        with patch.object(geocoding,'urlopen',side_effect=URLError('private upstream detail')):
            response=self.client.get('/api/locations/search/',{'q':'Dallas'})
            self.assertEqual(response.status_code,502)
            self.assertNotIn('private',response.json()['detail'])

    def test_malformed_upstream(self):
        with patch.object(geocoding,'urlopen',return_value=self.upstream({'invalid':'shape'})):
            self.assertEqual(self.client.get('/api/locations/search/',{'q':'Dallas'}).status_code,502)

    def test_spacing_between_uncached_queries(self):
        with patch.object(geocoding,'urlopen',return_value=self.upstream([])), patch.object(geocoding.time,'sleep') as sleep:
            self.client.get('/api/locations/search/', {'q':'Dallas'})
            self.client.get('/api/locations/search/', {'q':'Atlanta'})
            sleep.assert_called_once()
            self.assertGreater(sleep.call_args.args[0],0)
