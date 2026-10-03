import {
  ShieldCheck,
  Check,
  Coffee,
  ArrowUpRight,
  AlertTriangle,
} from "lucide-react";
import { ProgressBar } from "../ui/ProgressBar";
import type { Compliance, ScheduleSummary } from "../../types/schedule";
const labels: Record<string, string> = {
  "11_hour_driving_limit": "11-hour driving limit",
  "14_hour_driving_window": "14-hour driving window",
  "30_minute_break": "Driving between qualifying breaks",
  "70_hour_cycle": "70-hour cycle",
};
export function ComplianceSummary({
  compliance,
  schedule,
}: {
  compliance: Compliance;
  schedule: ScheduleSummary;
}) {
  return (
    <section className="card compliance-card">
      <div className="section-heading">
        <div className="heading-inline">
          <ShieldCheck size={19} />
          <h2>HOS compliance</h2>
        </div>
        <span
          className={`status-badge ${compliance.compliant ? "" : "warning"}`}
        >
          {compliance.compliant ? "Compliant" : "Review needed"}
        </span>
      </div>
      <div className="compliance-content">
        <p className="compliance-intro">
          Calculated from your chronological schedule.
        </p>
        {compliance.checks.map((check) => (
          <div className="compliance-rule" key={check.rule}>
            <div>
              <strong>{labels[check.rule] || check.rule}</strong>
              {check.status === "compliant" ? (
                <Check size={14} />
              ) : (
                <AlertTriangle size={14} />
              )}
            </div>
            <div className="rule-value">
              {check.max_hours.toFixed(2)}
              <span> / {check.limit_hours} hrs</span>
            </div>
            <ProgressBar
              value={check.max_hours}
              label={labels[check.rule] || check.rule}
              max={check.limit_hours}
              tone={check.status === "compliant" ? "green" : "amber"}
            />
            <small>Maximum observed in this schedule</small>
          </div>
        ))}
        <div className="break-callout">
          <Coffee size={18} />
          <div>
            <strong>
              {schedule.required_30m_breaks} required 30-minute{" "}
              {schedule.required_30m_breaks === 1 ? "break" : "breaks"}
            </strong>
            <p>Pickup and qualifying rests also reset the break clock.</p>
          </div>
        </div>
        {compliance.fuel && (
          <div className="compliance-rule">
            <div>
              <strong>Fuel interval</strong>
              {compliance.fuel.compliant ? (
                <Check size={14} />
              ) : (
                <AlertTriangle size={14} />
              )}
            </div>
            <div className="rule-value">
              {compliance.fuel.max_interval_miles.toFixed(1)}
              <span> / {compliance.fuel.limit_miles} mi</span>
            </div>
            <small>
              {schedule.fuel_stops} planned fuel stops · 30 minutes each
            </small>
          </div>
        )}
        <div className="compliance-foot">
          {schedule.daily_rests} daily rests · {schedule.cycle_restarts} cycle
          restarts
          <ArrowUpRight size={14} />
        </div>
        {compliance.warnings.map((warning) => (
          <p key={warning}>{warning}</p>
        ))}
      </div>
    </section>
  );
}
