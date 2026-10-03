import { HelpTooltip } from "../ui/HelpTooltip";
import { helpCopy } from "../ui/helpCopy";
import { AddressAutocomplete } from "../maps/AddressAutocomplete";
import { isValidLocation } from "../../types/location";
import { useState } from "react";
import {
  MapPin,
  Circle,
  Package,
  ArrowRight,
  LoaderCircle,
  Clock3,
  Info,
} from "lucide-react";
import type { TripInput } from "../../types/trip";
import { defaultInput } from "../../data/demoTrip";
import { ProgressBar } from "../ui/ProgressBar";
export function TripPlannerForm({
  onPlan,
  loading,
}: {
  onPlan: (input: TripInput) => void;
  loading: boolean;
}) {
  const [input, setInput] = useState(defaultInput);
  const [attempted, setAttempted] = useState(false);
  const [error, setError] = useState("");
  function submit(e: React.FormEvent) {
    e.preventDefault();
    setAttempted(true);
    if (
      ![
        input.currentLocation,
        input.pickupLocation,
        input.dropoffLocation,
      ].every(isValidLocation) ||
      !Number.isFinite(input.currentCycleUsed) ||
      input.currentCycleUsed < 0 ||
      input.currentCycleUsed > 70
    ) {
      setError(
        "Select all three addresses and enter cycle hours between 0 and 70.",
      );
      return;
    }
    setError("");
    onPlan(input);
  }
  return (
    <section className="card planner-card">
      <div className="section-heading">
        <div className="heading-inline">
          <span className="section-icon">
            <MapPin size={19} />
          </span>
          <div>
            <h2>Plan a new trip</h2>
            <p>A great trip starts with a clear plan.</p>
          </div>
        </div>
        <span className="muted-label">01 — TRIP DETAILS</span>
      </div>
      <form onSubmit={submit}>
        <div className="form-grid">
          {(
            [
              {
                key: "currentLocation",
                label: "Current location",
                icon: Circle,
              },
              {
                key: "pickupLocation",
                label: "Pickup location",
                icon: Package,
              },
              {
                key: "dropoffLocation",
                label: "Dropoff location",
                icon: MapPin,
              },
            ] as const
          ).map(({ key, label, icon: Icon }, i) => (
            <AddressAutocomplete
              key={key}
              label={label}
              icon={Icon}
              index={i}
              value={input[key]}
              onChange={(value) =>
                setInput((previous) => ({ ...previous, [key]: value }))
              }
              showValidation={attempted}
              disabled={loading}
            />
          ))}
          <div className="cycle-input-field">
            <div className="help-label">
              <label htmlFor="current-cycle-used">Current cycle used</label>
              <HelpTooltip label="Current Cycle Used">
                {helpCopy.cycle}
              </HelpTooltip>
            </div>
            <div className="input-wrap">
              <Clock3 size={17} />
              <input
                id="current-cycle-used"
                type="number"
                min="0"
                max="70"
                step="0.25"
                value={
                  Number.isNaN(input.currentCycleUsed)
                    ? ""
                    : input.currentCycleUsed
                }
                onChange={(e) =>
                  setInput({
                    ...input,
                    currentCycleUsed:
                      e.target.value === "" ? NaN : Number(e.target.value),
                  })
                }
                required
              />
              <span>hrs</span>
            </div>
          </div>
        </div>
        <div className="form-footer">
          <div className="cycle-block">
            <div>
              <span>
                <strong>
                  {Number.isFinite(input.currentCycleUsed)
                    ? input.currentCycleUsed
                    : 0}
                </strong>{" "}
                / 70 hours used
              </span>
              <span>
                {Math.max(0, 70 - (input.currentCycleUsed || 0))} hrs remaining
              </span>
            </div>
            <ProgressBar value={input.currentCycleUsed || 0} />
          </div>
          <div className="form-cta">
            <span className="helper">
              <Info size={14} />
              <span>
                Property-carrying driver
                <br />
                70-hour / 8-day cycle
              </span>
            </span>
            <button className="primary-button" disabled={loading} type="submit">
              {loading ? (
                <>
                  <LoaderCircle className="spin" size={17} />
                  Planning route…
                </>
              ) : (
                <>
                  Plan Trip
                  <ArrowRight size={17} />
                </>
              )}
            </button>
          </div>
        </div>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
      </form>
    </section>
  );
}
