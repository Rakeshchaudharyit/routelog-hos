import type { LogMetadata } from "./dailyLog";
import type { RouteResult, ApiRoute } from "./route";
import type { DailyLog, TripSummary } from "./trip";
import type {
  ScheduleEvent,
  ScheduleSummary,
  ScheduleLog,
  Compliance,
} from "./schedule";
export interface ApiLocation {
  address: string;
  lat: number;
  lng: number;
}
export interface TripPlanRequest {
  current_location: ApiLocation;
  pickup_location: ApiLocation;
  dropoff_location: ApiLocation;
  current_cycle_used: number;
  start_time?: string;
  log_metadata?: LogMetadata;
}
export interface TripPlanResponse {
  trip_id: string;
  status: "ok";
  hos_status: "calculated";
  route: RouteResult;
  summary: TripSummary;
  schedule: ScheduleSummary;
  compliance: Compliance;
  events: ScheduleEvent[];
  daily_logs: DailyLog[];
  requested_locations: Omit<
    TripPlanRequest,
    "current_cycle_used" | "start_time" | "log_metadata"
  >;
  current_cycle_used: number;
}

export type TripPlanApiResponse = Omit<
  TripPlanResponse,
  "route" | "summary" | "schedule" | "daily_logs"
> & {
  route: ApiRoute;
  summary: ScheduleSummary;
  daily_logs: ScheduleLog[];
};
