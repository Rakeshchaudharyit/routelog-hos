import type { LocationValue } from "./location";
export interface RouteGeometry {
  type: "LineString";
  coordinates: [number, number][];
}
export interface RouteLeg {
  from: LocationValue;
  to: LocationValue;
  distanceMiles: number;
  durationHours: number;
}
export interface RouteResult {
  distanceMiles: number;
  durationHours: number;
  geometry: RouteGeometry;
  legs: RouteLeg[];
}
export interface ApiRoute {
  distance_miles: number;
  duration_hours: number;
  geometry: RouteGeometry;
  legs: {
    from: LocationValue;
    to: LocationValue;
    distance_miles: number;
    duration_hours: number;
  }[];
}
export function leafletCoordinates(
  geometry: RouteGeometry,
): [number, number][] {
  return geometry.coordinates.map(([lng, lat]) => [lat, lng]);
}
export function shortAddress(address: string) {
  return address.split(",")[0].trim();
}
export function drivingTime(hours: number) {
  const minutes = Math.round(hours * 60);
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
}
