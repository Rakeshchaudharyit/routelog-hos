import { useEffect, useState, lazy, Suspense } from "react";
import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import { Check, X } from "lucide-react";
import { AppSidebar } from "./components/layout/AppSidebar";
import { AppHeader } from "./components/layout/AppHeader";
import { TripPlannerPage } from "./pages/TripPlannerPage";
const SettingsPage = lazy(() =>
  import("./pages/SettingsPage").then((m) => ({ default: m.SettingsPage })),
);
import { LoginPage } from "./auth/LoginPage";
import { WorkspaceProvider, useWorkspace } from "./context/WorkspaceContext";
function Application() {
  const [open, setOpen] = useState(false);
  const {
    authenticated,
    user,
    loading,
    bootstrapError,
    bootstrap,
    path,
    navigate,
    toast,
    notify,
  } = useWorkspace();
  const target = !authenticated
    ? "/login"
    : path === "/login" ||
        ![
          "/trip-planner",
          "/settings",
          "/settings/general",
          "/settings/branding",
          "/settings/security",
        ].includes(path)
      ? "/trip-planner"
      : path.startsWith("/settings") && !user?.is_admin
        ? "/trip-planner"
        : path === "/settings"
          ? "/settings/general"
          : path;
  useEffect(() => {
    if (!loading && !bootstrapError && path !== target) {
      navigate(target, true);
    }
  }, [path, target, navigate, loading, bootstrapError]);
  if (loading || bootstrapError)
    return (
      <main
        className="login-page"
        style={{ display: "grid", placeItems: "center" }}
      >
        <div role="status">
          {bootstrapError || "Loading workspace…"}
          {bootstrapError && (
            <button
              className="secondary-action"
              onClick={() => void bootstrap()}
            >
              Retry
            </button>
          )}
        </div>
      </main>
    );
  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence mode="wait">
        {!authenticated ? (
          <LoginPage key="login" />
        ) : (
          <motion.div
            key="workspace"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <AppSidebar open={open} onClose={() => setOpen(false)} />
            <div className="app-shell">
              <AppHeader onMenu={() => setOpen(true)} />
              {path.startsWith("/settings") ? (
                <Suspense fallback={<div role="status">Loading settings…</div>}>
                  <SettingsPage />
                </Suspense>
              ) : (
                <TripPlannerPage />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {toast && (
          <motion.div
            className="toast"
            role="status"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <Check size={18} />
            <span>{toast}</span>
            <button
              className="icon-button"
              aria-label="Dismiss notification"
              onClick={() => notify("")}
            >
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </MotionConfig>
  );
}
export default function App() {
  return (
    <WorkspaceProvider>
      <Application />
    </WorkspaceProvider>
  );
}
