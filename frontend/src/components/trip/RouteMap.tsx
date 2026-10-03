import { HelpTooltip } from "../ui/HelpTooltip";
import { helpCopy } from "../ui/helpCopy";
import { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Polyline,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";
import { divIcon, latLngBounds } from "leaflet";
import { Maximize2, Navigation } from "lucide-react";
import type { RouteResult } from "../../types/route";
import {
  drivingTime,
  leafletCoordinates,
  shortAddress,
} from "../../types/route";
import type { LocationValue } from "../../types/location";
import type { ScheduleEvent, StopType } from "../../types/schedule";
import {
  routeStops,
  stopLabels,
  dateLabel,
  clockLabel,
  durationLabel,
} from "../../types/schedule";
import "leaflet/dist/leaflet.css";
const symbols: Record<StopType, string> = {
  trip_start: "A",
  pickup: "P",
  break: "B",
  fuel: "F",
  daily_rest: "☾",
  cycle_restart: "R",
  dropoff: "D",
};
const icons = Object.fromEntries(
  Object.entries(symbols).map(([kind, symbol]) => [
    kind,
    divIcon({
      className: "route-marker-wrapper",
      html: `<span class="route-marker ${kind}"><span>${symbol}</span></span>`,
      iconSize: [32, 40],
      iconAnchor: [16, 36],
      popupAnchor: [0, -36],
    }),
  ]),
) as Record<StopType, ReturnType<typeof divIcon>>;
function MapBounds({
  route,
  locations,
  reset,
}: {
  route: RouteResult;
  locations: LocationValue[];
  reset: number;
}) {
  const map = useMap();
  useEffect(() => {
    const points = leafletCoordinates(route.geometry);
    const bounds = latLngBounds([
      ...points,
      ...locations.map(
        (location) => [location.lat, location.lng] as [number, number],
      ),
    ]);
    map.invalidateSize();
    map.fitBounds(bounds, { padding: [34, 34], maxZoom: 13, animate: false });
    const observer = new ResizeObserver(() => {
      map.invalidateSize();
      map.fitBounds(bounds, { padding: [34, 34], maxZoom: 13, animate: false });
    });
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map, route, locations, reset]);
  return null;
}
export function RouteMap({
  route,
  locations,
  events,
}: {
  route: RouteResult;
  locations: LocationValue[];
  events: ScheduleEvent[];
}) {
  const [reset, setReset] = useState(0);
  const [tileError, setTileError] = useState(false);
  const positions = leafletCoordinates(route.geometry);
  const stops = routeStops(events);
  const categories = Array.from(new Set(stops.map((stop) => stop.type)));
  return (
    <section className="card route-card live-route-card">
      <div className="section-heading">
        <div>
          <div className="help-label">
            <h2>Route overview</h2>
            <HelpTooltip label="Map events">{helpCopy.map}</HelpTooltip>
          </div>
          <p>
            {locations
              .map((location) => shortAddress(location.address))
              .join(" → ")}
          </p>
        </div>
        <span className="small-badge">OSRM ROUTE</span>
      </div>
      <div className="live-map-wrapper">
        <MapContainer
          center={positions[0]}
          zoom={6}
          className="live-route-map"
          scrollWheelZoom={false}
          aria-label="Interactive driving route map"
        >
          <TileLayer
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
            eventHandlers={{ tileerror: () => setTileError(true) }}
          />
          <Polyline
            positions={positions}
            pathOptions={{
              color: "#ffffff",
              weight: 8,
              opacity: 0.85,
              lineCap: "round",
              lineJoin: "round",
            }}
          />
          <Polyline
            positions={positions}
            pathOptions={{
              color: "#347cc9",
              weight: 4,
              opacity: 0.95,
              lineCap: "round",
              lineJoin: "round",
            }}
          />
          {stops.map((stop, index) => (
            <Marker
              key={`${stop.start}-${stop.type}`}
              position={[stop.location.lat, stop.location.lng]}
              icon={icons[stop.type]}
              title={`${index + 1}. ${stopLabels[stop.type]}`}
              zIndexOffset={index * 10}
            >
              <Popup>
                <strong>
                  {index + 1}. {stopLabels[stop.type]}
                </strong>
                <p>{stop.location.address}</p>
                <p>
                  Mile {stop.route_mile.toFixed(1)}
                  <br />
                  {dateLabel(stop.start)} · {clockLabel(stop.start)}
                  {stop.duration_seconds > 0 && (
                    <>
                      <br />
                      {durationLabel(stop.duration_seconds)}
                    </>
                  )}
                </p>
              </Popup>
            </Marker>
          ))}
          <MapBounds route={route} locations={locations} reset={reset} />
        </MapContainer>
        <button
          type="button"
          className="map-fit-button"
          aria-label="Fit route to map"
          onClick={() => setReset((value) => value + 1)}
        >
          <Maximize2 size={16} />
        </button>
        {tileError && (
          <div className="tile-error" role="status">
            Map tiles are unavailable. Your calculated route is still shown.
          </div>
        )}
      </div>
      <div
        className="route-stop-legend"
        aria-label="Calculated stop categories"
      >
        {categories.map((kind) => (
          <span key={kind}>
            <i className={kind} />
            {stopLabels[kind]}
          </span>
        ))}
      </div>
      <div className="route-leg-list">
        {route.legs.map((leg, index) => (
          <div key={index}>
            <Navigation size={14} />
            <div>
              <strong>
                Leg {index + 1} · {shortAddress(leg.from.address)} →{" "}
                {shortAddress(leg.to.address)}
              </strong>
              <span>
                {leg.distanceMiles.toFixed(1)} mi <i>·</i>{" "}
                {drivingTime(leg.durationHours)}
              </span>
            </div>
          </div>
        ))}
      </div>
      <p className="routing-note">
        OSRM driving estimate · Vehicle restrictions and traffic are not
        included.
      </p>
    </section>
  );
}
