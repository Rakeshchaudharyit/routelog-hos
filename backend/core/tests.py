from rest_framework.test import APITestCase


class HealthTests(APITestCase):
    def test_health(self):
        response = self.client.get('/api/health/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'status': 'ok', 'service': 'RouteLog HOS API'})

    def test_cors_allowed_and_denied(self):
        response = self.client.get('/api/health/', HTTP_ORIGIN='http://localhost:5173')
        self.assertEqual(response['Access-Control-Allow-Origin'], 'http://localhost:5173')
        response = self.client.get('/api/health/', HTTP_ORIGIN='https://untrusted.example')
        self.assertNotIn('Access-Control-Allow-Origin', response)

    def test_api_not_cached(self):
        response=self.client.get('/api/auth/me/')
        self.assertIn('no-store',response['Cache-Control'])
        self.assertIn('private',response['Cache-Control'])
