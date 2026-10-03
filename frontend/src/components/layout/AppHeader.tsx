import { AccountMenu } from "../account/AccountMenu";
import { useWorkspace } from "../../context/WorkspaceContext";
import { Bell, CircleHelp, ChevronRight, Menu, X } from "lucide-react";
import { useState } from "react";
export function AppHeader({ onMenu }: { onMenu: () => void }) {
  const { path } = useWorkspace();
  const [panel, setPanel] = useState<"help" | "notifications" | null>(null);
  return (
    <header className="app-header">
      <div className="breadcrumb">
        <button
          className="icon-button mobile-menu"
          onClick={onMenu}
          aria-label="Open navigation"
        >
          <Menu size={20} />
        </button>
        <span>Workspace</span>
        <ChevronRight size={14} />
        <strong>
          {path.startsWith("/settings") ? "Settings" : "Trip Planner"}
        </strong>
      </div>
      <div className="header-actions">
        <span className="demo-badge">
          <span />
          Demo workspace
        </span>
        <button
          className="icon-button"
          aria-label="Help"
          onClick={() => setPanel(panel === "help" ? null : "help")}
        >
          <CircleHelp size={19} />
        </button>
        <button
          className="icon-button notification-button"
          aria-label="Notifications"
          onClick={() =>
            setPanel(panel === "notifications" ? null : "notifications")
          }
        >
          <Bell size={19} />
          <i />
        </button>
        <AccountMenu compact />
      </div>
      {panel && (
        <div className="header-popover">
          <button
            className="icon-button"
            onClick={() => setPanel(null)}
            aria-label="Close panel"
          >
            <X size={16} />
          </button>
          <strong>
            {panel === "help"
              ? "Your route, simplified"
              : "You’re all caught up"}
          </strong>
          <p>
            {panel === "help"
              ? "Select your locations and Plan Trip to calculate the route, HOS schedule and daily logs under assessment assumptions. Logs are planning previews, not certified ELD records."
              : "No new notifications in your demo workspace."}
          </p>
        </div>
      )}
    </header>
  );
}
