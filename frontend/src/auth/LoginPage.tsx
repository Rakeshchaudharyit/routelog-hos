import { AppLoader } from "../components/ui/AppLoader";
import { useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { Check, Copy, ShieldCheck, ArrowRight } from "lucide-react";
import { useWorkspace } from "../context/WorkspaceContext";
import { Brand } from "../components/ui/Brand";
import { PasswordField } from "../components/ui/PasswordField";
const SETUP_EMAIL_HINT = "Use the email configured during setup.";
export function LoginPage() {
  const { login, branding, notify } = useWorkspace();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "success">("idle");
  const [remember, setRemember] = useState(true);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setState("loading");
    try {
      await login(email, password, remember);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to sign in. Please try again.",
      );
      setState("idle");
    }
  }
  return (
    <motion.main
      className="login-page"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <section className="login-story">
        <div className="brand">
          <Brand />
        </div>
        <div className="story-content">
          <div className="login-eyebrow">A CLEARER ROAD AHEAD</div>
          <h1>
            Plan smarter.
            <br />
            <span>Drive compliant.</span>
          </h1>
          <p>
            Plan driver routes, stay ahead of Hours of Service limits, and keep
            every trip clearly documented.
          </p>
          <div className="route-art" aria-hidden="true">
            <svg viewBox="0 0 460 180">
              <defs>
                <pattern
                  id="map-grid"
                  width="30"
                  height="30"
                  patternUnits="userSpaceOnUse"
                >
                  <path
                    d="M 30 0 L 0 0 0 30"
                    fill="none"
                    stroke="#294354"
                    strokeWidth="1"
                  />
                </pattern>
              </defs>
              <rect width="460" height="180" fill="url(#map-grid)" />
              <motion.path
                d="M30 135 H115 Q145 135 145 105 V65 Q145 40 175 40 H280 Q310 40 310 70 V105 Q310 135 340 135 H430"
                fill="none"
                stroke="#83b6fe"
                strokeWidth="3"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 2 }}
              />
              {[
                [30, 135],
                [220, 40],
                [430, 135],
              ].map(([x, y]) => (
                <g key={x}>
                  <circle cx={x} cy={y} r="11" fill="#203f56" />
                  <circle cx={x} cy={y} r="4" fill="#a4ceff" />
                </g>
              ))}
            </svg>
            <div className="route-art-labels">
              <span>PLAN YOUR ROUTE</span>
              <span>KEEP HOURS IN BALANCE</span>
            </div>
          </div>
          <div className="login-compliance">
            <ShieldCheck size={18} /> Every mile. In balance.
          </div>
        </div>
        <span className="story-footer">Built for the road ahead.</span>
      </section>
      <section className="login-form-side">
        <motion.div
          className="login-card"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <span className="login-kicker">YOUR WORKSPACE AWAITS</span>
          <h2>Welcome back</h2>
          <p>
            Sign in to your{" "}
            {branding.appName === "RouteLog HOS"
              ? "RouteLog"
              : branding.appName}{" "}
            workspace.
          </p>
          <form onSubmit={submit}>
            <div className="field">
              <label htmlFor="email">Email address</label>
              <input
                id="email"
                type="email"
                autoComplete="username"
                placeholder="you@company.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <PasswordField
              label="Password"
              value={password}
              onChange={setPassword}
              autoComplete="current-password"
            />
            <div className="login-options">
              <label>
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />{" "}
                Remember me
              </label>
              <button
                type="button"
                className="text-button"
                onClick={() =>
                  notify(
                    "Password recovery is outside this assessment. Contact your workspace administrator.",
                  )
                }
              >
                Forgot password?
              </button>
            </div>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button className="primary-action" disabled={state !== "idle"}>
              {state === "loading" ? (
                <>
                  <AppLoader compact iconOnly />
                  Signing in...
                </>
              ) : state === "success" ? (
                <>
                  <Check size={17} />
                  Signed in
                </>
              ) : (
                <>
                  Sign in
                  <ArrowRight size={17} />
                </>
              )}
            </button>
          </form>
          <div className="credential-helper">
            <div>
              <strong>Demo credentials</strong>
              <span>{SETUP_EMAIL_HINT}</span>
              <span>Use the password configured during setup.</span>
            </div>
            <button
              className="icon-button"
              aria-label="Copy account email"
              onClick={async () => {
                try {
                  if (!email.trim()) {
                    notify("Enter your account email to copy it.");
                    return;
                  }
                  await navigator.clipboard.writeText(email.trim());
                  notify("Account email copied");
                } catch {
                  notify(
                    "Copy unavailable. Select the credentials to copy them.",
                  );
                }
              }}
            >
              <Copy size={16} />
            </button>
          </div>
          <div className="login-card-footer">
            <span className="workspace-dot" />
            Demo workspace
          </div>
        </motion.div>
      </section>
    </motion.main>
  );
}
