import { motion, useReducedMotion } from "framer-motion";
import type { DailyLog, DutyStatus } from "../../types/trip";
const statuses: DutyStatus[] = ["off_duty", "sleeper", "driving", "on_duty"];
const labels: Record<DutyStatus, string> = {
  off_duty: "Off Duty",
  sleeper: "Sleeper Berth",
  driving: "Driving",
  on_duty: "On Duty (Not Driving)",
};
export function dutyTotals(log: DailyLog) {
  return statuses.map((status) => ({
    status,
    label: labels[status],
    hours: log.totals[status],
  }));
}
export function EldLogGrid({ log }: { log: DailyLog }) {
  const reduced = useReducedMotion();
  const x = (hour: number) => 184 + hour * 24;
  const y = (status: DutyStatus) => 54 + statuses.indexOf(status) * 38;
  const path = log.segments
    .map(
      (segment, index) =>
        `${index === 0 ? "M" : "L"}${x(segment.start)} ${y(segment.status)} H${x(segment.end)}`,
    )
    .join(" ");
  return (
    <div className="eld-scroll">
      <svg
        className="eld-grid"
        viewBox="0 0 850 224"
        role="img"
        aria-label={`Daily duty graph for ${log.date}. ${dutyTotals(log)
          .map((total) => `${total.label}: ${total.hours.toFixed(2)} hours`)
          .join(", ")}. Total ${log.totalHours.toFixed(2)} hours.`}
      >
        <rect x="184" y="35" width="576" height="152" fill="#fcfdfd" />
        {Array.from({ length: 97 }, (_, index) => (
          <line
            key={index}
            x1={184 + index * 6}
            x2={184 + index * 6}
            y1="35"
            y2="187"
            stroke={index % 4 === 0 ? "#cdd8e0" : "#e8edf1"}
            strokeWidth={index % 4 === 0 ? 1 : 0.6}
          />
        ))}
        {Array.from({ length: 5 }, (_, index) => (
          <line
            key={index}
            x1="184"
            x2="760"
            y1={35 + index * 38}
            y2={35 + index * 38}
            stroke="#cdd8e0"
          />
        ))}
        {Array.from({ length: 25 }, (_, index) => (
          <text
            key={index}
            x={x(index)}
            y="22"
            textAnchor="middle"
            className="hour-label"
          >
            {index === 0 || index === 24
              ? "12A"
              : index === 12
                ? "12P"
                : index % 12}
          </text>
        ))}
        <text x="806" y="22" textAnchor="middle" className="hour-label">
          HOURS
        </text>
        {dutyTotals(log).map((total, index) => (
          <g key={total.status}>
            <text x="3" y={59 + index * 38} className="duty-label">
              {index + 1}. {index === 3 ? "ON DUTY" : total.label.toUpperCase()}
              {index === 3 && (
                <tspan x="16" dy="12">
                  (NOT DRIVING)
                </tspan>
              )}
            </text>
            <text
              x="806"
              y={59 + index * 38}
              textAnchor="middle"
              className="total-label"
            >
              {total.hours.toFixed(2)}
            </text>
          </g>
        ))}
        <motion.path
          key={log.date}
          d={path}
          fill="none"
          stroke="#3274dc"
          strokeWidth="2.5"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: reduced ? 0 : 0.8 }}
        />
        <text x="184" y="212" className="hour-label">
          MIDNIGHT → MIDNIGHT · FIXED SCHEDULE CLOCK
        </text>
        <text x="806" y="212" textAnchor="middle" className="total-label">
          TOTAL {log.totalHours.toFixed(2)}
        </text>
      </svg>
    </div>
  );
}
