import { dateLabel } from "../../types/schedule";
import { drivingTime } from "../../types/route";
import { useEffect, useState } from "react";
import { animate, useReducedMotion } from "framer-motion";
import { Route, Clock3, CalendarDays, Battery, Sunrise } from "lucide-react";
import type { ScheduleSummary } from "../../types/schedule";
import type { TripSummary as Summary } from "../../types/trip";
function Count({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const [n, setN] = useState(0);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) {
      setN(value);
      return;
    }
    const c = animate(0, value, { duration: 0.85, onUpdate: setN });
    return () => c.stop();
  }, [value, reduced]);
  return <>{n.toFixed(decimals)}</>;
}
export function TripSummary({
  summary,
  schedule,
}: {
  summary: Summary;
  schedule: ScheduleSummary;
}) {
  return (
    <div className="metrics">
      {[
        {
          label: "Total distance",
          value: summary.distance,
          unit: "mi",
          icon: Route,
          note: "OSRM route distance",
          decimals: 1,
        },
        {
          label: "Driving time",
          value: summary.drivingHours,
          unit: "hrs",
          icon: Clock3,
          note: drivingTime(summary.drivingHours),
          decimals: 2,
        },
        {
          label: "Trip duration",
          value: summary.durationHours,
          unit: "hrs",
          icon: CalendarDays,
          note: "Including services & qualifying rest",
          decimals: 2,
        },
        {
          label: "Cycle remaining",
          value: summary.cycleRemaining,
          unit: "hrs",
          icon: Battery,
          note: "Of your 70-hour cycle",
          decimals: 2,
        },
        {
          label: "Driving days",
          value: summary.drivingDays,
          unit: "days",
          icon: Sunrise,
          note: `${dateLabel(schedule.start_time)} – ${dateLabel(schedule.end_time)}`,
        },
      ].map(({ label, value, unit, icon: Icon, note, decimals }) => (
        <section className="card metric" key={label}>
          <div>
            <span>{label}</span>
            <Icon size={17} />
          </div>
          <strong>
            <Count value={value} decimals={decimals} />
            <small>{unit}</small>
          </strong>
          <p>{note}</p>
        </section>
      ))}
    </div>
  );
}
