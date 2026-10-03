from bisect import bisect_right
import math

EARTH_RADIUS_MILES = 3958.7613


def haversine_miles(a, b):
    lng1, lat1 = map(math.radians, a)
    lng2, lat2 = map(math.radians, b)
    value = math.sin((lat2-lat1)/2)**2 + math.cos(lat1)*math.cos(lat2)*math.sin((lng2-lng1)/2)**2
    return 2 * EARTH_RADIUS_MILES * math.asin(min(1, math.sqrt(value)))


class RouteProgress:
    def __init__(self, geometry, route_distance_miles=None):
        coordinates = geometry.get('coordinates', [])
        if geometry.get('type') != 'LineString' or len(coordinates) < 2:
            raise ValueError('A route LineString is required.')
        for point in coordinates:
            if len(point) != 2 or not all(isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v) for v in point) or not (-180 <= point[0] <= 180 and -90 <= point[1] <= 90):
                raise ValueError('Invalid route coordinate.')
        self.coordinates = coordinates
        self.cumulative = [0.0]
        for a, b in zip(coordinates, coordinates[1:]):
            self.cumulative.append(self.cumulative[-1] + haversine_miles(a, b))
        self.geometry_miles = self.cumulative[-1]
        self.route_miles = self.geometry_miles if route_distance_miles is None else route_distance_miles
        if not math.isfinite(self.route_miles) or self.route_miles < 0:
            raise ValueError('Invalid route distance.')

    def point_at_distance(self, distance_miles):
        if not math.isfinite(distance_miles):
            raise ValueError('Invalid route progress.')
        fraction = min(1, max(0, distance_miles / self.route_miles)) if self.route_miles else 0
        target = self.geometry_miles * fraction
        if fraction >= 1:
            lng, lat = self.coordinates[-1]
        elif self.geometry_miles == 0 or target == 0:
            lng, lat = self.coordinates[0]
        else:
            index = min(bisect_right(self.cumulative, target)-1, len(self.coordinates)-2)
            segment = self.cumulative[index+1] - self.cumulative[index]
            ratio = (target-self.cumulative[index]) / segment if segment else 0
            a, b = self.coordinates[index], self.coordinates[index+1]
            # Interpolate along the selected geometry segment, including dateline wrap.
            delta_lng = (b[0]-a[0]+180) % 360 - 180
            lng = (a[0] + delta_lng * ratio + 180) % 360 - 180
            lat = a[1] + (b[1]-a[1]) * ratio
        return {'lat': lat, 'lng': lng}


def point_at_distance(route_geometry, distance_miles, route_distance_miles=None):
    return RouteProgress(route_geometry, route_distance_miles).point_at_distance(distance_miles)
