"""OSRM routing only; no HOS scheduling or stop optimization."""
import json
import math
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from django.conf import settings


class RoutingError(Exception):
    status_code = 502


class NoRouteError(RoutingError):
    status_code = 422


class RoutingTimeout(RoutingError):
    status_code = 504


def meters_to_miles(meters):
    return meters / 1609.344


def seconds_to_hours(seconds):
    return seconds / 3600


def positive_number(value):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value < 0:
        raise ValueError('Invalid route metric.')
    return value


def calculate_route(locations):
    if len(locations) != 3:
        raise ValueError('Exactly three locations are required.')
    for location in locations:
        lat, lng = location['lat'], location['lng']
        if not math.isfinite(lat) or not math.isfinite(lng) or not (-90 <= lat <= 90 and -180 <= lng <= 180):
            raise ValueError('Invalid location coordinates.')
    coordinates = ';'.join(f"{location['lng']},{location['lat']}" for location in locations)
    url = settings.OSRM_BASE_URL.rstrip('/') + '/route/v1/driving/' + coordinates + '?' + urlencode({
        'overview': 'full', 'geometries': 'geojson', 'steps': 'true', 'alternatives': 'false',
    })
    request = Request(url, headers={'User-Agent': 'RouteLog-HOS-Assessment/2.0', 'Accept': 'application/json'})
    try:
        try:
            with urlopen(request, timeout=10) as response:
                data = json.loads(response.read(8 * 1024 * 1024))
        except HTTPError as error:
            # OSRM reports NoRoute/NoSegment using both HTTP 200 and HTTP 400.
            if error.code == 400:
                try:
                    upstream = json.loads(error.read(65536))
                except (ValueError, OSError):
                    upstream = {}
                if upstream.get('code') in ('NoRoute', 'NoSegment'):
                    raise NoRouteError('No driving route was found between the selected locations.') from error
            raise
        if not isinstance(data, dict):
            raise ValueError('Invalid response.')
        if data.get('code') in ('NoRoute', 'NoSegment'):
            raise NoRouteError('No driving route was found between the selected locations.')
        if data.get('code') != 'Ok':
            raise ValueError('Invalid upstream status.')
        route = data['routes'][0]
        geometry = route['geometry']
        if geometry.get('type') != 'LineString' or not isinstance(geometry.get('coordinates'), list) or len(geometry['coordinates']) < 2:
            raise ValueError('Invalid geometry.')
        normalized_coordinates = []
        for point in geometry['coordinates']:
            if not isinstance(point, list) or len(point) != 2:
                raise ValueError('Invalid geometry coordinate.')
            lng, lat = point
            if isinstance(lat, bool) or isinstance(lng, bool) or not math.isfinite(lat) or not math.isfinite(lng) or not (-90 <= lat <= 90 and -180 <= lng <= 180):
                raise ValueError('Invalid geometry coordinate.')
            normalized_coordinates.append([lng, lat])
        if len(route['legs']) != 2:
            raise ValueError('Invalid route legs.')
        legs = [{
            'from': locations[index], 'to': locations[index+1],
            'distance_miles': meters_to_miles(positive_number(leg['distance'])),
            'duration_hours': seconds_to_hours(positive_number(leg['duration'])),
            'duration_seconds': positive_number(leg['duration']),
        } for index, leg in enumerate(route['legs'])]
        return {
            'distance_miles': meters_to_miles(positive_number(route['distance'])),
            'duration_hours': seconds_to_hours(positive_number(route['duration'])),
            'duration_seconds': positive_number(route['duration']),
            'geometry': {'type': 'LineString', 'coordinates': normalized_coordinates},
            'legs': legs,
        }
    except NoRouteError:
        raise
    except (TimeoutError,) as error:
        raise RoutingTimeout('Route calculation timed out. Please try again.') from error
    except URLError as error:
        if isinstance(error.reason, TimeoutError):
            raise RoutingTimeout('Route calculation timed out. Please try again.') from error
        raise RoutingError('Unable to calculate a route at this time. Please try again.') from error
    except (OSError, ValueError, KeyError, IndexError, TypeError, AttributeError) as error:
        raise RoutingError('Unable to calculate a route at this time. Please try again.') from error
