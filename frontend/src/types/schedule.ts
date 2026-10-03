import type { ApiLogDetails } from "./dailyLog";
import type { LocationValue } from "./location";
import type { DutyStatus } from "./trip";
export interface ScheduleEvent {
  type:
    | "trip_start"
    | "driving"
    | "pickup"
    | "break"
    | "daily_rest"
    | "fuel"
    | "dropoff"
    | "trip_complete"
    | "cycle_restart";
  status: DutyStatus;
  start: string;
  end: string;
  duration_seconds: number;
  duration_hours: number;
  location: LocationValue | null;
  description: string;
  distance_miles: number;
  cycle_used_at_end: number;
  route_mile: number;
  route_mile_at_end: number;
}
export interface ScheduleSummary {
  distance_miles: number;
  driving_hours: number;
  trip_duration_hours: number;
  driving_days: number;
  cycle_used_at_start: number;
  cycle_used_at_end: number;
  cycle_remaining: number;
  fuel_stops: number;
  required_breaks: number;
  required_30m_breaks: number;
  daily_rests: number;
  cycle_restarts: number;
  start_time: string;
  end_time: string;
}
export interface Compliance {
  compliant: boolean;
  checks: {
    rule: string;
    status: "compliant" | "violation";
    max_hours: number;
    limit_hours: number;
  }[];
  warnings: string[];
  fuel?: {
    compliant: boolean;
    max_interval_miles: number;
    limit_miles: number;
  };
}
export interface ScheduleLog extends ApiLogDetails {
  day: number;
  date: string;
  distance_miles: number;
  cycle_used: number;
  segments: {
    start_seconds: number;
    end_seconds: number;
    status: DutyStatus;
  }[];
  totals_seconds: Record<DutyStatus, number>;
  total_seconds: number;
  remarks: string[];
}
// Preserve the backend's schedule date and clock, regardless of the browser's timezone.
export function scheduleDate(iso: string) {
  return iso.slice(0, 10);
}
export function dateLabel(iso: string, full = false) {
  return new Date(`${scheduleDate(iso)}T12:00:00Z`).toLocaleDateString(
    "en-US",
    {
      timeZone: "UTC",
      month: "short",
      day: "numeric",
      ...(full ? { year: "numeric" as const } : {}),
    },
  );
}
export function clockLabel(iso: string) {
  return iso.slice(11, 19);
}
export function durationLabel(seconds: number) {
  const hours = Math.floor(seconds / 3600),
    minutes = Math.floor((seconds % 3600) / 60),
    rest = seconds % 60;
  return (
    [
      hours ? `${hours}h` : "",
      minutes ? `${minutes}m` : "",
      rest ? `${rest}s` : "",
    ]
      .filter(Boolean)
      .join(" ") || "0m"
  );
}

export const stopLabels = {
  trip_start: "Start",
  pickup: "Pickup",
  break: "Required Break",
  fuel: "Fuel",
  daily_rest: "10-Hour Rest",
  cycle_restart: "34-Hour Restart",
  dropoff: "Dropoff",
};
export type StopType = keyof typeof stopLabels;
export function routeStops(events: ScheduleEvent[]) {
  return events.filter(
    (
      event,
    ): event is ScheduleEvent & { type: StopType; location: LocationValue } =>
      event.type in stopLabels && event.location !== null,
  );
}
