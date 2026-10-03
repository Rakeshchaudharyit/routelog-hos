"""Small Nominatim proxy for explicit user searches, not public-service autocomplete."""
import hashlib
import json
import logging
import math
import re
import threading
import time
from typing import TypedDict
from urllib.error import HTTPError, URLError
from urllib.parse import quote, quote_plus, urlencode, urlsplit
from urllib.request import Request, urlopen

from django.conf import settings
from django.core.cache import cache


logger = logging.getLogger(__name__)


def _diagnostic_text(value, query):
    """Keep upstream diagnostics bounded and omit sensitive echoed content."""
    text = str(value)
    if re.search(r'cookie|authorization|password|credential|secret|token|session', text, re.IGNORECASE):
        return '[omitted: potentially sensitive upstream content]'
    for variant in (query, quote(query, safe=''), quote_plus(query)):
        text = re.sub(re.escape(variant), '[search redacted]', text, flags=re.IGNORECASE)
    # Upstream error pages can echo request URLs, including queries or userinfo.
    text = re.sub(r'https?://[^\s<>"\']+', '[URL redacted]', text, flags=re.IGNORECASE)
    text = re.sub(r'[\x00-\x1f\x7f]', ' ', text)
    return text[:500]


class Location(TypedDict):
    address: str
    lat: float
    lng: float


class GeocodingError(Exception):
    pass


class GeocodingBusy(GeocodingError):
    pass


_lock = threading.Lock()
_last_request = 0.0


def search_locations(query):
    global _last_request
    query = query.strip()
    if len(query) < 3 or len(query) > 200:
        raise ValueError('Search must contain between 3 and 200 characters.')
    key = 'locations:' + hashlib.sha256((settings.NOMINATIM_URL + ':' + query.casefold()).encode()).hexdigest()
    cached = cache.get(key)
    if cached is not None:
        return cached
    # One assessment server process: serialize misses and space all upstream calls.
    # Multi-worker deployment needs a shared rate limiter or a self-hosted provider.
    if not _lock.acquire(timeout=0.1):
        raise GeocodingBusy('Address search is busy. Please try again shortly.')
    try:
        cached = cache.get(key)
        if cached is not None:
            return cached
        delay = 1.1 - (time.monotonic() - _last_request)
        if delay > 0:
            time.sleep(delay)
        request = Request(settings.NOMINATIM_URL + '?' + urlencode({
            'q': query, 'format': 'jsonv2', 'limit': 5, 'addressdetails': 0,
        }), headers={
            'User-Agent': settings.NOMINATIM_USER_AGENT,
            'Accept': 'application/json', 'Accept-Language': 'en',
        })
        _last_request = time.monotonic()
        try:
            with urlopen(request, timeout=5) as response:
                raw = json.loads(response.read(1024 * 1024))
            if not isinstance(raw, list):
                raise ValueError('Unexpected upstream response.')
            results = []
            seen = set()
            for item in raw:
                if not isinstance(item, dict):
                    continue
                try:
                    address = item['display_name'].strip()
                    lat, lng = float(item['lat']), float(item['lon'])
                    importance = float(item.get('importance', 0))
                    if not address or not math.isfinite(lat) or not math.isfinite(lng) or not (-90 <= lat <= 90 and -180 <= lng <= 180):
                        continue
                    identity = (address, lat, lng)
                    if identity in seen:
                        continue
                    seen.add(identity)
                    results.append({'address': address, 'lat': lat, 'lng': lng,
                                    'type': str(item.get('addresstype') or item.get('type') or ''),
                                    'importance': importance if math.isfinite(importance) else 0})
                    if len(results) == 5:
                        break
                except (KeyError, TypeError, ValueError, AttributeError):
                    continue
        except HTTPError as error:
            body = '[unavailable]'
            try:
                # Bound the read as well as the logged text; never inspect headers.
                body = _diagnostic_text(error.read(2048).decode('utf-8', errors='replace'), query)
            except Exception:
                # Diagnostic reads must not replace the original upstream failure.
                pass
            logger.warning(
                'Nominatim HTTP failure: host=%s status=%s reason=%s body=%s',
                urlsplit(settings.NOMINATIM_URL).hostname, error.code,
                _diagnostic_text(error.reason, query), body,
            )
            raise GeocodingError('Address search is temporarily unavailable. Please try again.') from error
        except URLError as error:
            logger.warning(
                'Nominatim URL failure: host=%s reason=%s',
                urlsplit(settings.NOMINATIM_URL).hostname, _diagnostic_text(error.reason, query),
            )
            raise GeocodingError('Address search is temporarily unavailable. Please try again.') from error
        except TimeoutError as error:
            logger.warning(
                'Nominatim timeout: host=%s reason=%s',
                urlsplit(settings.NOMINATIM_URL).hostname, _diagnostic_text(error, query),
            )
            raise GeocodingError('Address search is temporarily unavailable. Please try again.') from error
        except OSError as error:
            logger.warning(
                'Nominatim OS failure: host=%s reason=%s',
                urlsplit(settings.NOMINATIM_URL).hostname, _diagnostic_text(error, query),
            )
            raise GeocodingError('Address search is temporarily unavailable. Please try again.') from error
        except ValueError as error:
            raise GeocodingError('Address search is temporarily unavailable. Please try again.') from error
        cache.set(key, results, timeout=300)
        return results
    finally:
        _lock.release()
