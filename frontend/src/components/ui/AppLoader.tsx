import { Truck, MapPin } from "lucide-react";

export function AppLoader({
  label = "Loading RouteLog HOS…",
  detail,
  compact = false,
  iconOnly = false,
}: {
  label?: string;
  detail?: string;
  compact?: boolean;
  iconOnly?: boolean;
}) {
  return (
    <span
      className={`app-loader${compact ? " app-loader-compact" : ""}${iconOnly ? " app-loader-icon-only" : ""}`}
      role={iconOnly ? undefined : "status"}
      aria-live={iconOnly ? undefined : "polite"}
      aria-hidden={iconOnly || undefined}
    >
      <span className="journey-loader" aria-hidden="true">
        <span className="journey-road" />
        <span className="journey-waypoint journey-origin" />
        <span className="journey-waypoint journey-midpoint" />
        <span className="journey-destination">
          <MapPin size={18} />
        </span>
        <span className="journey-truck">
          <Truck size={26} strokeWidth={1.7} />
        </span>
      </span>
      {!iconOnly && (
        <span className="app-loader-copy">
          <strong>{label}</strong>
          {detail && <span>{detail}</span>}
        </span>
      )}
    </span>
  );
}
