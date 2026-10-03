import type { ScheduleEvent } from "../../types/schedule";
import {
  scheduleDate,
  dateLabel,
  clockLabel,
  durationLabel,
} from "../../types/schedule";
import { useState } from "react";
import { motion } from "framer-motion";
import { Navigation, Package, Moon, Coffee, Check, Clock3 } from "lucide-react";
import { dutyLabels } from "../../data/demoTrip";
export function TripTimeline({ events }: { events: ScheduleEvent[] }) {
  const dates = Array.from(
    new Set(
      events.flatMap((event) => [
        scheduleDate(event.start),
        scheduleDate(event.end),
      ]),
    ),
  ).sort();
  // Include intermediate days touched by a long rest/restart as well.
  const first = dates[0],
    last = dates[dates.length - 1];
  const allDates: string[] = [];
  for (
    let date = new Date(`${first}T00:00:00Z`);
    date.toISOString().slice(0, 10) <= last;
    date.setUTCDate(date.getUTCDate() + 1)
  )
    allDates.push(date.toISOString().slice(0, 10));
  const [selected, setSelected] = useState(0);
  const day = allDates[selected] || first;
  return (
    <section className="card timeline-card">
      <div className="section-heading">
        <div>
          <h2>Trip timeline</h2>
          <p>Every stop, thoughtfully planned.</p>
        </div>
        <Clock3 size={18} className="muted" />
      </div>
      <div className="timeline-day-tabs" aria-label="Timeline day">
        {allDates.map((date, index) => (
          <button
            key={date}
            aria-pressed={date === day}
            className={date === day ? "active" : ""}
            onClick={() => setSelected(index)}
          >
            Day {index + 1}
            <span>{dateLabel(date)}</span>
          </button>
        ))}
      </div>
      <div className="timeline-list" key={day}>
        {events
          .filter(
            (event) =>
              scheduleDate(event.start) <= day &&
              (event.duration_seconds === 0
                ? scheduleDate(event.start) === day
                : scheduleDate(event.end) > day ||
                  (scheduleDate(event.end) === day &&
                    clockLabel(event.end) !== "00:00:00")),
          )
          .map((event, index) => {
            const Icon =
              event.type === "trip_complete"
                ? Check
                : event.status === "driving"
                  ? Navigation
                  : event.type === "daily_rest" ||
                      event.type === "cycle_restart"
                    ? Moon
                    : event.status === "off_duty"
                      ? Coffee
                      : Package;
            const continuing = scheduleDate(event.start) < day;
            return (
              <motion.div
                className={`timeline-event ${event.status}`}
                key={`${event.start}-${event.type}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.035 }}
              >
                <span className="timeline-icon">
                  <Icon size={14} />
                </span>
                <div>
                  <div className="event-top">
                    <time dateTime={event.start}>
                      {continuing ? "00:00:00" : clockLabel(event.start)}
                    </time>
                    <span>
                      {event.duration_seconds
                        ? durationLabel(event.duration_seconds)
                        : ""}
                    </span>
                  </div>
                  <strong>
                    {event.description}
                    {continuing ? " · continued" : ""}
                  </strong>
                  <p>{event.location?.address || "En route"}</p>
                  {event.duration_seconds > 0 && (
                    <p>
                      Until {dateLabel(event.end)} {clockLabel(event.end)}
                    </p>
                  )}
                  <span className="duty-badge">{dutyLabels[event.status]}</span>
                </div>
              </motion.div>
            );
          })}
      </div>
      <div className="timeline-footer">
        <span className="live-dot" />
        All times shown in the fixed trip schedule clock
      </div>
    </section>
  );
}
