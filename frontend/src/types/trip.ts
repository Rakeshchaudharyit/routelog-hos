import type { LogMetadata, LogDetails } from "./dailyLog";
import type { LocationValue } from "./location";
export type { LocationValue } from "./location";
export interface TripInput {
  currentLocation: LocationValue | null;
  pickupLocation: LocationValue | null;
  dropoffLocation: LocationValue | null;
  currentCycleUsed: number;
  startTime?: string;
  logMetadata?: LogMetadata;
}
export interface TripSummary {
  distance: number;
  drivingHours: number;
  durationHours: number;
  cycleRemaining: number;
  drivingDays: number;
}
export type DutyStatus = "off_duty" | "sleeper" | "driving" | "on_duty";
export interface DutySegment {
  start: number;
  end: number;
  status: DutyStatus;
}
export interface DailyLog extends LogDetails {
  day: number;
  date: string;
  miles: number;
  cycleUsed: number;
  segments: DutySegment[];
  remarks: string[];
}
