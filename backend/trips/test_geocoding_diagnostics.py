import io
from unittest.mock import patch
from urllib.error import HTTPError, URLError

from django.core.cache import cache
from django.test import SimpleTestCase, override_settings

from .services import geocoding


@override_settings(NOMINATIM_URL='https://nominatim.openstreetmap.org/search')
class GeocodingDiagnosticTests(SimpleTestCase):
    def setUp(self):
        cache.clear()
        geocoding._last_request = 0

    def assert_failure_logged(self, error, expected):
        with patch.object(geocoding, 'urlopen', side_effect=error), self.assertLogs(geocoding.logger, level='WARNING') as logs:
            with self.assertRaisesMessage(geocoding.GeocodingError, 'Address search is temporarily unavailable. Please try again.'):
                geocoding.search_locations('Chicago, IL')
        message = logs.records[0].getMessage()
        self.assertIn(expected, message)
        self.assertIn('host=nominatim.openstreetmap.org', message)
        self.assertNotIn('Chicago', message)
        return message

    def test_http_status_reason_and_bounded_redacted_body(self):
        error = HTTPError('https://nominatim.openstreetmap.org/search?q=Chicago%2C+IL', 403, 'Forbidden', {},
                          io.BytesIO(('Denied Chicago, IL https://example.org/?q=Chicago%2C+IL ' + 'x' * 1000).encode()))
        message = self.assert_failure_logged(error, 'HTTP failure')
        self.assertIn('status=403 reason=Forbidden', message)
        self.assertIn('[search redacted]', message)
        self.assertNotIn('https://', message)
        self.assertEqual(len(message.split('body=', 1)[1]), 500)

    def test_http_unreadable_body_preserves_failure(self):
        error = HTTPError('https://example.org', 503, 'Unavailable', {}, None)
        with patch.object(error, 'read', side_effect=OSError('read failed')):
            self.assertIn('body=[unavailable]', self.assert_failure_logged(error, 'status=503'))

    def test_sensitive_body_omitted(self):
        for body in ('Set-Cookie: private-value', 'Authorization: private-value', 'session=private-value'):
            with self.subTest(body=body):
                geocoding._last_request = 0
                error = HTTPError('https://example.org', 403, 'Forbidden', {}, io.BytesIO(body.encode()))
                message = self.assert_failure_logged(error, 'potentially sensitive upstream content')
                self.assertNotIn('private-value', message)

    def test_network_failure_categories(self):
        for error, expected in ((URLError('DNS lookup failed'), 'URL failure'),
                                (TimeoutError('timed out'), 'timeout'),
                                (OSError('connection reset'), 'OS failure')):
            with self.subTest(error=error):
                geocoding._last_request = 0
                message = self.assert_failure_logged(error, expected)
                self.assertIn(str(error.reason if isinstance(error, URLError) else error), message)
