import type { DutyStatus } from "./trip";
import type { ScheduleLog } from "./schedule";
export interface LogMetadata {
  driver_name?: string;
  co_driver_name?: string | null;
  carrier_name?: string;
  main_office_address?: string;
  vehicle_number?: string;
  shipping_document_number?: string;
}
export interface LogRemark {
  time: string;
  location: string;
  description: string;
  type: string;
  status: DutyStatus;
}
export interface ApiLogDetails {
  driver: { name: string; co_driver_name: string | null };
  carrier: { name: string; main_office_address: string };
  vehicle_number: string;
  shipping_document_number: string;
  total_miles: number;
  totals: Record<DutyStatus, number>;
  remark_details: LogRemark[];
  certification: {
    driver_name: string;
    certified: false;
    status: "planning_record";
  };
}
export interface LogDetails {
  driver: ApiLogDetails["driver"];
  carrier: ApiLogDetails["carrier"];
  vehicleNumber: string;
  shippingDocumentNumber: string;
  totals: Record<DutyStatus, number>;
  remarkDetails: LogRemark[];
  certification: ApiLogDetails["certification"];
  totalHours: number;
}
export function validateDailyLog(log: ScheduleLog): void {
  const fail = () => {
    throw new Error(
      "The trip service returned invalid daily log data. Please try again.",
    );
  };
  if (
    !log ||
    !/^\d{4}-\d{2}-\d{2}$/.test(log.date) ||
    !Number.isFinite(Date.parse(`${log.date}T00:00:00Z`)) ||
    new Date(`${log.date}T00:00:00Z`).toISOString().slice(0, 10) !== log.date ||
    !Number.isFinite(log.total_miles) ||
    log.total_miles < 0 ||
    log.total_miles !== log.distance_miles ||
    !Array.isArray(log.segments) ||
    !log.segments.length ||
    log.total_seconds !== 86400
  )
    fail();
  const statuses: DutyStatus[] = ["off_duty", "sleeper", "driving", "on_duty"];
  let cursor = 0;
  const seconds: Record<DutyStatus, number> = {
    off_duty: 0,
    sleeper: 0,
    driving: 0,
    on_duty: 0,
  };
  for (const segment of log.segments) {
    if (
      !segment ||
      !statuses.includes(segment.status) ||
      !Number.isInteger(segment.start_seconds) ||
      !Number.isInteger(segment.end_seconds) ||
      segment.start_seconds !== cursor ||
      segment.end_seconds <= cursor ||
      segment.end_seconds > 86400
    )
      fail();
    seconds[segment.status] += segment.end_seconds - segment.start_seconds;
    cursor = segment.end_seconds;
  }
  if (
    cursor !== 86400 ||
    !log.totals ||
    !log.totals_seconds ||
    statuses.some(
      (status) =>
        seconds[status] !== log.totals_seconds[status] ||
        !Number.isFinite(log.totals[status]) ||
        Math.abs(log.totals[status] - seconds[status] / 3600) > 1e-9,
    )
  )
    fail();
  if (
    [
      log.driver?.name,
      log.carrier?.name,
      log.carrier?.main_office_address,
      log.vehicle_number,
      log.shipping_document_number,
    ].some((value) => typeof value !== "string" || !value.trim()) ||
    log.certification?.certified !== false ||
    log.certification.status !== "planning_record" ||
    log.certification.driver_name !== log.driver.name ||
    !Array.isArray(log.remark_details) ||
    log.remark_details.some(
      (remark) =>
        !remark ||
        typeof remark.time !== "string" ||
        remark.time.slice(0, 10) !== log.date ||
        !Number.isFinite(Date.parse(remark.time)) ||
        !statuses.includes(remark.status) ||
        typeof remark.location !== "string" ||
        typeof remark.description !== "string",
    )
  )
    fail();
}
