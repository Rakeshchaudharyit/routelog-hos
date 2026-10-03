import json
import os
import subprocess
import sys
from pathlib import Path
from django.test import SimpleTestCase


class ProductionConfigurationTests(SimpleTestCase):
    def load(self, **changes):
        env = {**os.environ, 'DJANGO_DEBUG':'false', 'DJANGO_SECRET_KEY':'test-only-key-'*6,
               'DJANGO_ALLOWED_HOSTS':'api.example.test', 'FRONTEND_URL':'https://app.example.test',
               'CORS_ALLOWED_ORIGINS':'https://app.example.test','CSRF_TRUSTED_ORIGINS':'https://app.example.test',
               'DATABASE_URL':'postgresql://test:test@database.example.test/test', **changes}
        return subprocess.run([sys.executable,'-c',"from config import settings as s; import json; print(json.dumps({'engine':s.DATABASES['default']['ENGINE'],'debug':s.DEBUG,'secure':s.SESSION_COOKIE_SECURE,'csrf_secure':s.CSRF_COOKIE_SECURE,'ssl_redirect':s.SECURE_SSL_REDIRECT,'same_site':s.SESSION_COOKIE_SAMESITE,'cors':s.CORS_ALLOWED_ORIGINS,'csrf':s.CSRF_TRUSTED_ORIGINS,'static':s.STORAGES['staticfiles']['BACKEND']}))"],cwd=Path(__file__).resolve().parent.parent,env=env,capture_output=True,text=True)

    def test_production_configuration(self):
        result=self.load();self.assertEqual(result.returncode,0,result.stderr)
        data=json.loads(result.stdout);self.assertEqual(data['engine'],'django.db.backends.postgresql')
        self.assertFalse(data['debug']);self.assertTrue(data['secure']);self.assertTrue(data['csrf_secure']);self.assertTrue(data['ssl_redirect'])
        self.assertEqual(data['same_site'],'Lax');self.assertIn('whitenoise',data['static'])

    def test_requires_production_database(self): self.assertNotEqual(self.load(DATABASE_URL='').returncode,0)
    def test_rejects_production_sqlite(self): self.assertNotEqual(self.load(DATABASE_URL='sqlite:///temp.sqlite3').returncode,0)
    def test_rejects_wildcard_hosts(self): self.assertNotEqual(self.load(DJANGO_ALLOWED_HOSTS='*').returncode,0)
    def test_rejects_insecure_origins(self): self.assertNotEqual(self.load(CORS_ALLOWED_ORIGINS='http://app.example.test').returncode,0)
    def test_requires_strong_secret(self): self.assertNotEqual(self.load(DJANGO_SECRET_KEY='short').returncode,0)
