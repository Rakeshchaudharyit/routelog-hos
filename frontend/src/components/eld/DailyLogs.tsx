import { AppLoader } from "../ui/AppLoader";
import { HelpTooltip } from "../ui/HelpTooltip";
import { helpCopy } from "../ui/helpCopy";
import { dateLabel } from "../../types/schedule";
import { useState, useRef, lazy, Suspense } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, ClipboardList, Check } from "lucide-react";
import type { DailyLog } from "../../types/trip";
import { EldLogGrid } from "./EldLogGrid";
const FullLogModal = lazy(() =>
  import("./FullLogModal").then((m) => ({ default: m.FullLogModal })),
);
export function DailyLogs({ logs }: { logs: DailyLog[] }) {
  const [day, setDay] = useState(0);
  const [full, setFull] = useState(false);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const log = logs[day];
  return (
    <section className="card daily-logs">
      <div className="section-heading">
        <div className="heading-inline">
          <ClipboardList size={20} />
          <div>
            <div className="help-label">
              <h2>Daily ELD logs</h2>
              <HelpTooltip label="Daily Logs / ELD">
                {helpCopy.logs}
              </HelpTooltip>
            </div>
            <p>Your hours, clearly documented.</p>
          </div>
        </div>
        <span className="small-badge">{logs.length} DAILY LOGS</span>
      </div>
      <div className="log-tab-row">
        <div role="tablist" aria-label="Daily log day">
          {logs.map((d, i) => (
            <button
              key={d.day}
              ref={(el) => {
                tabs.current[i] = el;
              }}
              role="tab"
              id={`day-tab-${i}`}
              aria-controls="log-panel"
              aria-selected={day === i}
              tabIndex={day === i ? 0 : -1}
              onClick={() => setDay(i)}
              onKeyDown={(e) => {
                if (
                  ["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)
                ) {
                  e.preventDefault();
                  const next =
                    e.key === "Home"
                      ? 0
                      : e.key === "End"
                        ? logs.length - 1
                        : (day +
                            (e.key === "ArrowRight" ? 1 : -1) +
                            logs.length) %
                          logs.length;
                  setDay(next);
                  tabs.current[next]?.focus();
                }
              }}
              className={day === i ? "active" : ""}
            >
              Day {d.day}
              <span>{dateLabel(d.date)}</span>
            </button>
          ))}
        </div>
        <span className="log-verified">
          <Check size={13} />
          {log.totalHours.toFixed(2)} hours accounted for
        </span>
      </div>
      <motion.div
        id="log-panel"
        role="tabpanel"
        aria-labelledby={`day-tab-${day}`}
        key={day}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="log-panel"
      >
        <div className="log-grid-heading">
          <span>DUTY STATUS</span>
          <span>24-HOUR LOG · SCHEDULE TIME</span>
        </div>
        <EldLogGrid log={log} />
        <div className="log-details">
          <div>
            <small>Date</small>
            <strong>{dateLabel(log.date, true)}</strong>
          </div>
          <div>
            <small>Total miles</small>
            <strong>{log.miles.toFixed(1)} mi</strong>
          </div>
          <div>
            <small>Driving</small>
            <strong>{log.totals.driving.toFixed(2)} hrs</strong>
          </div>
          <div>
            <small>On duty</small>
            <strong>{log.totals.on_duty.toFixed(2)} hrs</strong>
          </div>
          <div>
            <small>Cycle used</small>
            <strong>{log.cycleUsed.toFixed(2)} hrs</strong>
          </div>
          <div>
            <small>Daily total</small>
            <strong>{log.totalHours.toFixed(2)} hrs</strong>
          </div>
        </div>
        <div className="remarks-preview">
          <h3>Remarks</h3>
          <p>{log.remarks.join(" · ")}</p>
        </div>
      </motion.div>
      <div className="log-bottom">
        <span>
          <span className="live-dot" />
          Generated from the calculated schedule
        </span>
        <button className="secondary-button" onClick={() => setFull(true)}>
          View full log
          <ArrowUpRight size={15} />
        </button>
      </div>
      <AnimatePresence>
        {full && (
          <Suspense fallback={<AppLoader compact label="Loading full log…" />}>
            <FullLogModal log={log} onClose={() => setFull(false)} />
          </Suspense>
        )}
      </AnimatePresence>
    </section>
  );
}
