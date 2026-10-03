import os
from pathlib import Path

from django.core.exceptions import ImproperlyConfigured
from dotenv import load_dotenv
import dj_database_url

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / '.env')

DEBUG = os.getenv('DJANGO_DEBUG', 'false').lower() == 'true'
SECRET_KEY = os.getenv('DJANGO_SECRET_KEY', '')
if not SECRET_KEY:
    raise ImproperlyConfigured('Set DJANGO_SECRET_KEY in backend/.env or the environment.')


def csv_env(name, default=''):
    return [value.strip() for value in os.getenv(name, default).split(',') if value.strip()]


ALLOWED_HOSTS = csv_env('DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1')
FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:5173,http://127.0.0.1:5173' if DEBUG else '')
CORS_ALLOWED_ORIGINS = csv_env('CORS_ALLOWED_ORIGINS', FRONTEND_URL)
CSRF_TRUSTED_ORIGINS = csv_env('CSRF_TRUSTED_ORIGINS', FRONTEND_URL)
CORS_ALLOW_ALL_ORIGINS = False
CORS_ALLOW_CREDENTIALS = True
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SAMESITE = "Lax"
MEDIA_URL = "/media/"
MEDIA_ROOT = Path(os.getenv("DJANGO_MEDIA_ROOT") or str(BASE_DIR / "media"))
SERVE_DEMO_MEDIA = os.getenv("DJANGO_SERVE_DEMO_MEDIA", "false").lower() == "true"
INSTALLED_APPS = [
    'django.contrib.admin', 'django.contrib.auth', 'django.contrib.contenttypes',
    'django.contrib.sessions', 'django.contrib.messages', 'django.contrib.staticfiles',
    'corsheaders', 'rest_framework', 'core', 'accounts', 'trips',
]
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'core.middleware.ApiNoCacheMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]
ROOT_URLCONF = 'config.urls'
TEMPLATES = [{
    'BACKEND': 'django.template.backends.django.DjangoTemplates',
    'DIRS': [], 'APP_DIRS': True,
    'OPTIONS': {'context_processors': [
        'django.template.context_processors.request',
        'django.contrib.auth.context_processors.auth',
        'django.contrib.messages.context_processors.messages',
    ]},
}]
WSGI_APPLICATION = 'config.wsgi.application'
ASGI_APPLICATION = 'config.asgi.application'
DATABASE_URL = os.getenv('DATABASE_URL', '')
if not DEBUG and not DATABASE_URL:
    raise ImproperlyConfigured('Production requires a PostgreSQL DATABASE_URL.')
DATABASES = {'default': dj_database_url.parse(DATABASE_URL, conn_max_age=60, ssl_require=not DEBUG) if DATABASE_URL else {'ENGINE': 'django.db.backends.sqlite3', 'NAME': BASE_DIR / 'db.sqlite3'}}
if not DEBUG and DATABASES['default']['ENGINE'] != 'django.db.backends.postgresql':
    raise ImproperlyConfigured('Use PostgreSQL for production persistence.')
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STORAGES = {
    'default': {'BACKEND': 'django.core.files.storage.FileSystemStorage'},
    'staticfiles': {'BACKEND': 'whitenoise.storage.CompressedManifestStaticFilesStorage'},
}
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
REST_FRAMEWORK = {
    'DEFAULT_RENDERER_CLASSES': ['rest_framework.renderers.JSONRenderer'],
    'DEFAULT_PARSER_CLASSES': ['rest_framework.parsers.JSONParser'],
    'DEFAULT_AUTHENTICATION_CLASSES': ['rest_framework.authentication.SessionAuthentication'],
    'DEFAULT_PERMISSION_CLASSES': ['rest_framework.permissions.AllowAny'],
}
# Explicit searches only on the public instance. Change the URL to switch providers.
NOMINATIM_URL = os.getenv('NOMINATIM_URL', 'https://nominatim.openstreetmap.org/search')
NOMINATIM_USER_AGENT = os.getenv('NOMINATIM_USER_AGENT', 'RouteLog-HOS-Assessment/1.0')
CACHES = {'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache', 'LOCATION': 'routelog-geocoding'}}
if not DEBUG:
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    SECURE_SSL_REDIRECT = True
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    SECURE_HSTS_SECONDS = int(os.getenv('DJANGO_HSTS_SECONDS', '31536000'))
    SECURE_HSTS_INCLUDE_SUBDOMAINS = False
    SECURE_HSTS_PRELOAD = False
    if not os.getenv('DJANGO_ALLOWED_HOSTS') or '*' in ALLOWED_HOSTS:
        raise ImproperlyConfigured('Configure explicit production ALLOWED_HOSTS.')
    if any(not origin.startswith('https://') or '*' in origin for origin in CORS_ALLOWED_ORIGINS + CSRF_TRUSTED_ORIGINS):
        raise ImproperlyConfigured('Production origins must be explicit HTTPS URLs.')
    if not CORS_ALLOWED_ORIGINS or not CSRF_TRUSTED_ORIGINS:
        raise ImproperlyConfigured('Configure exact production CORS and CSRF origins.')
    if len(SECRET_KEY) < 50:
        raise ImproperlyConfigured('Production SECRET_KEY must be at least 50 characters.')
OSRM_BASE_URL = os.getenv('OSRM_BASE_URL', 'https://router.project-osrm.org')
