import { useWorkspace } from "../../context/WorkspaceContext";
import { Brand } from "../ui/Brand";
import { AccountMenu } from "../account/AccountMenu";
import { useEffect, useRef } from "react";
import {
  Route,
  ShieldCheck,
  Settings,
  ArrowUpRight,
  X,
  Truck,
} from "lucide-react";
export function AppSidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { branding, user, path, navigate } = useWorkspace();
  const sidebar = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!open || !window.matchMedia("(max-width: 700px)").matches) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const controls = sidebar.current?.querySelectorAll<HTMLElement>(
      "a[href], button:not(:disabled)",
    );
    sidebar.current?.querySelector<HTMLButtonElement>(".drawer-close")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab" || !controls?.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [open, onClose]);
  return (
    <>
      <div
        className={`drawer-overlay ${open ? "visible" : ""}`}
        onClick={onClose}
      />
      <aside
        ref={sidebar}
        aria-label="Main navigation"
        className={`sidebar ${open ? "open" : ""}`}
      >
        <a
          className="brand"
          href="/trip-planner"
          aria-label={`${branding.appName} home`}
          onClick={(e) => {
            e.preventDefault();
            navigate("/trip-planner");
            onClose();
          }}
        >
          <Brand />
        </a>
        <button
          className="drawer-close icon-button"
          onClick={onClose}
          aria-label="Close navigation"
        >
          <X />
        </button>
        <div className="workspace">
          <span className="workspace-icon">
            <Truck size={17} />
          </span>
          <div>
            {branding.workspaceName}
            <small>{branding.workspaceSubtitle}</small>
          </div>
          <span className="workspace-dot" />
        </div>
        <p className="nav-caption">WORKSPACE</p>
        <nav>
          {[
            {
              icon: Route,
              label: "Trip Planner",
              target: "/trip-planner",
              active: !path.startsWith("/settings"),
            },
            ...(user?.is_admin
              ? [
                  {
                    icon: Settings,
                    label: "Settings",
                    target: "/settings/general",
                    active: path.startsWith("/settings"),
                  },
                ]
              : []),
          ].map(({ icon: Icon, label, target, active }) => (
            <button
              key={label}
              aria-label={label}
              aria-current={active ? "page" : undefined}
              className={`nav-item ${active ? "active" : ""}`}
              onClick={() => {
                navigate(target);
                onClose();
              }}
            >
              <Icon size={19} />
              <span>{label}</span>
              {active && <span className="nav-active-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <ShieldCheck size={23} />
            <strong>Every mile. In balance.</strong>
            <p>Smarter planning for the road ahead.</p>
            <span>
              70-hour / 8-day cycle <ArrowUpRight size={14} />
            </span>
          </div>
          <AccountMenu onNavigate={onClose} />
        </div>
      </aside>
    </>
  );
}
