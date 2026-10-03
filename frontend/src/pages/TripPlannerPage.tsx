import { planTrip } from "../services/trips";
import type { TripPlanResponse } from "../types/api";
import { useWorkspace } from "../context/WorkspaceContext";
import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck,
  ArrowDown,
  Route,
  Check,
  LoaderCircle,
  Sparkles,
} from "lucide-react";
import { TripPlannerForm } from "../components/trip/TripPlannerForm";
import { TripSummary } from "../components/trip/TripSummary";
const RouteMap = lazy(() =>
  import("../components/trip/RouteMap").then((m) => ({ default: m.RouteMap })),
);
import { ComplianceSummary } from "../components/trip/ComplianceSummary";
import { TripTimeline } from "../components/trip/TripTimeline";
import { DailyLogs } from "../components/eld/DailyLogs";
import { shortAddress } from "../types/route";
import type { TripInput } from "../types/trip";
export function TripPlannerPage() {
  const { branding } = useWorkspace();
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState(0);
  const [result, setResult] = useState<TripPlanResponse | null>(null);
  const [generation, setGeneration] = useState(0);
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    if (!loading) return;
    const timer = setInterval(
      () => setStage((value) => Math.min(2, value + 1)),
      800,
    );
    return () => clearInterval(timer);
  }, [loading]);
  async function plan(input: TripInput) {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setStage(0);
    setError("");
    setResult(null);
    try {
      const response = await planTrip(input, controller.signal);
      if (controller.signal.aborted) return;
      setResult(response);
      setGeneration((value) => value + 1);
    } catch (failure) {
      if (!controller.signal.aborted)
        setError(
          failure instanceof Error
            ? failure.message
            : "Unable to plan your trip. Please try again.",
        );
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }
  return (
    <motion.main initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <div className="page-intro">
        <div>
          <div className="eyebrow">YOUR NEXT JOURNEY, SIMPLIFIED</div>
          <h1>Good plans. Better miles.</h1>
          <p>Plan your route, stay ahead of your hours, and keep moving.</p>
        </div>
        <span className="rules-pill">
          <ShieldCheck size={15} />
          70-hour HOS schedule
        </span>
      </div>
      <TripPlannerForm onPlan={plan} loading={loading} />
      {error && (
        <div className="api-error" role="alert">
          <strong>Trip planning unavailable</strong>
          <p>{error}</p>
          <small>
            No sample result was substituted. Submit the trip again to retry.
          </small>
        </div>
      )}
      <div className="result-announcement" role="status" aria-live="polite">
        {loading ? (
          <>
            <LoaderCircle size={16} className="spin" />
            {
              ["Planning route…", "Calculating distance…", "Preparing trip…"][
                stage
              ]
            }
          </>
        ) : result ? (
          <>
            <Check size={15} />
            Trip ready. Your route, HOS schedule and daily logs are calculated.
          </>
        ) : (
          <>
            <ShieldCheck size={15} />
            Smart Driver Trip Planning & ELD Compliance
            <span className="announcement-note">
              Real routing · Calculated HOS
            </span>
          </>
        )}
      </div>
      <AnimatePresence mode="wait">
        {result && !loading ? (
          <motion.div
            key={generation}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
          >
            <div className="result-heading">
              <div>
                <h2>
                  Your trip, at a glance{" "}
                  <span className="status-badge">Ready to review</span>
                </h2>
                <p>
                  {[
                    result.requested_locations.current_location,
                    result.requested_locations.pickup_location,
                    result.requested_locations.dropoff_location,
                  ]
                    .map((location) => shortAddress(location.address))
                    .join(" → ")}
                </p>
              </div>
              <span className="trip-id">TRIP #{result.trip_id}</span>
            </div>
            <div className="demo-notice">
              Calculated under the assessment assumptions: qualifying rest
              before departure, 70-hour cycle and one hour each for pickup and
              dropoff. Stops are approximate positions along the route, not
              verified parking or fuel stations. Times use a fixed schedule
              clock.
            </div>
            <TripSummary summary={result.summary} schedule={result.schedule} />
            <div className="route-layout">
              <Suspense
                fallback={
                  <div className="card" role="status">
                    Loading route map…
                  </div>
                }
              >
                <RouteMap
                  route={result.route}
                  events={result.events}
                  locations={[
                    result.requested_locations.current_location,
                    result.requested_locations.pickup_location,
                    result.requested_locations.dropoff_location,
                  ]}
                />
              </Suspense>
              <ComplianceSummary
                compliance={result.compliance}
                schedule={result.schedule}
              />
            </div>
            <div className="detail-layout">
              <TripTimeline events={result.events} />
              <DailyLogs logs={result.daily_logs} />
            </div>
          </motion.div>
        ) : !loading ? (
          <motion.div
            className="empty-state"
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="empty-route">
              <span>A</span>
              <i />
              <Route size={29} />
              <i />
              <span>B</span>
            </div>
            <h2>Your next great trip starts here.</h2>
            <p>
              Enter your trip details above. We’ll bring your route,
              <br />
              rest stops, and daily logs into one clear view.
            </p>
            <div className="empty-features">
              <span>
                <Route size={15} />A route with a plan
              </span>
              <span>
                <ShieldCheck size={15} />
                Hours in balance
              </span>
              <span>
                <Sparkles size={15} />
                Logs made simple
              </span>
            </div>
            <span className="empty-tip">
              <ArrowDown size={13} />
              Your results will appear here
            </span>
          </motion.div>
        ) : (
          <motion.div
            className="loading-skeleton"
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="skeleton-metrics">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} />
              ))}
            </div>
            <div className="skeleton-map">
              <Route size={36} />
              <p>Putting the pieces of your journey together</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <footer className="page-footer">
        <span className="footer-brand">
          <Route size={16} />
          {branding.appName}
        </span>
        <span>Built for the road ahead.</span>
        <span>
          Frontend preview <i /> v0.1
        </span>
      </footer>
    </motion.main>
  );
}
