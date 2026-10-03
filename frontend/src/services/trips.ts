import { validateDailyLog } from "../types/dailyLog";
import type { TripInput } from "../types/trip";
import type {
  ApiLocation,
  TripPlanRequest,
  TripPlanResponse,
  TripPlanApiResponse,
} from "../types/api";
import { isValidLocation, type LocationValue } from "../types/location";
import { apiRequest } from "./api";
function locationPayload(location: LocationValue | null): ApiLocation {
  if (!isValidLocation(location))
    throw new Error("Please select an address from the suggestions.");
  return {
    address: location.address,
    lat: location.lat,
    lng: location.lng,
  };
}
export function toTripRequest(input: TripInput): TripPlanRequest {
  return {
    current_location: locationPayload(input.currentLocation),
    pickup_location: locationPayload(input.pickupLocation),
    dropoff_location: locationPayload(input.dropoffLocation),
    current_cycle_used: input.currentCycleUsed,
    ...(input.logMetadata ? { log_metadata: input.logMetadata } : {}),
    ...(input.startTime ? { start_time: input.startTime } : {}),
  };
}
export async function planTrip(
  input: TripInput,
  signal?: AbortSignal,
): Promise<TripPlanResponse> {
  const result = await apiRequest<TripPlanApiResponse>("/trips/plan/", {
    method: "POST",
    body: JSON.stringify(toTripRequest(input)),
    signal,
  });
  if (
    result.status !== "ok" ||
    result.hos_status !== "calculated" ||
    !result.summary ||
    !Number.isFinite(result.summary.trip_duration_hours) ||
    !Number.isFinite(result.summary.cycle_remaining) ||
    !result.compliance ||
    typeof result.compliance.compliant !== "boolean" ||
    !Array.isArray(result.compliance.checks) ||
    !Array.isArray(result.events) ||
    !result.daily_logs?.length ||
    !result.route?.geometry ||
    result.route.geometry.type !== "LineString" ||
    !Array.isArray(result.route.geometry.coordinates) ||
    result.route.geometry.coordinates.length < 2 ||
    !Number.isFinite(result.route.distance_miles) ||
    !Number.isFinite(result.route.duration_hours) ||
    result.route.distance_miles < 0 ||
    result.route.duration_hours < 0 ||
    !Array.isArray(result.route.legs) ||
    result.route.legs.length !== 2 ||
    result.route.legs.some(
      (leg) =>
        !leg ||
        !isValidLocation(leg.from) ||
        !isValidLocation(leg.to) ||
        !Number.isFinite(leg.distance_miles) ||
        leg.distance_miles < 0 ||
        !Number.isFinite(leg.duration_hours) ||
        leg.duration_hours < 0,
    ) ||
    !result.requested_locations?.current_location ||
    !result.requested_locations?.pickup_location ||
    !result.requested_locations?.dropoff_location ||
    !Number.isFinite(result.current_cycle_used)
  )
    throw new Error(
      "The trip service returned an incomplete result. Please try again.",
    );
  if (
    result.route.geometry.coordinates.some(
      (point) =>
        !Array.isArray(point) ||
        point.length !== 2 ||
        !Number.isFinite(point[0]) ||
        !Number.isFinite(point[1]) ||
        Math.abs(point[0]) > 180 ||
        Math.abs(point[1]) > 90,
    )
  )
    throw new Error(
      "The route service returned invalid geometry. Please try again.",
    );
  result.daily_logs.forEach(validateDailyLog);
  return {
    ...result,
    schedule: result.summary,
    summary: {
      distance: result.summary.distance_miles,
      drivingHours: result.summary.driving_hours,
      durationHours: result.summary.trip_duration_hours,
      cycleRemaining: result.summary.cycle_remaining,
      drivingDays: result.summary.driving_days,
    },
    daily_logs: result.daily_logs.map((log) => ({
      driver: log.driver,
      carrier: log.carrier,
      vehicleNumber: log.vehicle_number,
      shippingDocumentNumber: log.shipping_document_number,
      certification: log.certification,
      totals: log.totals,
      remarkDetails: log.remark_details,
      totalHours: log.total_seconds / 3600,
      day: log.day,
      date: log.date,
      miles: log.distance_miles,
      cycleUsed: log.cycle_used,
      segments: log.segments.map((segment) => ({
        start: segment.start_seconds / 3600,
        end: segment.end_seconds / 3600,
        status: segment.status,
      })),
      remarks: log.remarks,
    })),
    route: {
      distanceMiles: result.route.distance_miles,
      durationHours: result.route.duration_hours,
      geometry: result.route.geometry,
      legs: result.route.legs.map((leg) => ({
        from: leg.from,
        to: leg.to,
        distanceMiles: leg.distance_miles,
        durationHours: leg.duration_hours,
      })),
    },
  };
}
