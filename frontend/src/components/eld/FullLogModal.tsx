import { HelpTooltip } from "../ui/HelpTooltip";
import { helpCopy } from "../ui/helpCopy";
import { useWorkspace } from "../../context/WorkspaceContext";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { X, Printer } from "lucide-react";
import type { DailyLog } from "../../types/trip";
import { dateLabel, clockLabel } from "../../types/schedule";
import { EldLogGrid, dutyTotals } from "./EldLogGrid";
export function FullLogModal({
  log,
  onClose,
}: {
  log: DailyLog;
  onClose: () => void;
}) {
  const { branding } = useWorkspace();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement as HTMLElement;
    element?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      element?.close();
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  return createPortal(
    <dialog
      ref={dialog}
      className="log-dialog full-daily-log"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      aria-labelledby="log-title"
    >
      <motion.div
        className="modal-content"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="full-log-toolbar">
          <span>Planned daily log</span>
          <div>
            <button className="secondary-button" onClick={() => window.print()}>
              <Printer size={15} />
              Print Log
            </button>
            <button
              className="icon-button"
              aria-label="Close daily log"
              onClick={onClose}
              autoFocus
            >
              <X size={21} />
            </button>
          </div>
        </div>
        <article className="driver-log-document">
          <header className="driver-log-header">
            <div>
              <div className="eyebrow">{branding.appName.toUpperCase()}</div>
              <h2 id="log-title">Driver’s Daily Log</h2>
              <p>24-Hour Duty Record</p>
            </div>
            <span className="planning-record-badge">
              Planned Log
              <br />
              Driver Certification Required
            </span>
          </header>
          <div className="log-date-strip">
            <div>
              <small>Date</small>
              <strong>{dateLabel(log.date, true)}</strong>
            </div>
            <div>
              <small>Total Miles Driving Today</small>
              <strong>
                {log.miles.toFixed(1)} <span>mi</span>
              </strong>
            </div>
          </div>
          <section className="driver-log-trip-details">
            <h3>Trip Details</h3>
            <dl className="driver-log-fields">
              {[
                ["Carrier", log.carrier.name],
                ["Main Office", log.carrier.main_office_address],
                ["Driver", log.driver.name],
                ["Co-Driver", log.driver.co_driver_name || "—"],
                ["Vehicle / Tractor", log.vehicleNumber],
                ["Shipping Document No.", log.shippingDocumentNumber],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </section>
          <section className="driver-log-graph">
            <div className="log-section-title">
              <h3>Record of Duty Status</h3>
              <span>00:00–24:00 · Quarter-hour grid</span>
            </div>
            <EldLogGrid log={log} />
            <div className="full-log-totals">
              {dutyTotals(log).map((total) => (
                <span key={total.status}>
                  {total.label}
                  <strong>{total.hours.toFixed(2)}</strong>
                </span>
              ))}
              <span>
                TOTAL<strong>{log.totalHours.toFixed(2)}</strong>
              </span>
            </div>
          </section>
          <section className="driver-log-remarks">
            <h3>Remarks</h3>
            {log.remarkDetails.length ? (
              <ol>
                {log.remarkDetails.map((remark, index) => (
                  <li key={`${remark.time}-${index}`}>
                    <time dateTime={remark.time}>
                      {clockLabel(remark.time)}
                    </time>
                    <span>
                      <strong>{remark.location}</strong>
                      <span className="log-remark-description">
                        {remark.description}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p>No new duty-status transitions started on this date.</p>
            )}
          </section>
          <section className="driver-log-certification">
            <h3>Driver Certification</h3>
            <p>“I certify that these entries are true and correct.”</p>
            <div>
              <span>
                Driver<strong>{log.certification.driver_name}</strong>
              </span>
              <span>
                Status
                <strong className="help-label">
                  Driver Certification Required
                  <HelpTooltip label="Driver Certification Required">
                    {helpCopy.certification}
                  </HelpTooltip>
                </strong>
              </span>
            </div>
            <div className="unsigned-line">
              <span>Signature</span>
              <strong>Not collected</strong>
            </div>
          </section>
          <p className="full-log-disclaimer">
            This log is generated from the planned trip schedule and is not an
            official ELD submission until reviewed and certified by the driver.
          </p>
        </article>
        <div className="modal-footer">
          <span>Planned Log — Driver Certification Required</span>
          <button className="primary-button" onClick={onClose}>
            Done
          </button>
        </div>
      </motion.div>
    </dialog>,
    document.body,
  );
}
