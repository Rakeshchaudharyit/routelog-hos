import { useEffect, useRef, useState } from "react";
import { useWorkspace } from "../../context/WorkspaceContext";
export function AccountMenu({
  compact = false,
  onNavigate,
}: {
  compact?: boolean;
  onNavigate?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const { navigate, logout, user } = useWorkspace();
  useEffect(() => {
    if (!open) return;
    root.current
      ?.querySelector<HTMLButtonElement>('[role="menuitem"]')
      ?.focus();
    const outside = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  function close() {
    setOpen(false);
    trigger.current?.focus();
  }
  function action(path?: string) {
    close();
    onNavigate?.();
    if (path) navigate(path);
    else void logout();
  }
  return (
    <div
      className={`account-root ${compact ? "compact" : ""}`}
      ref={root}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          close();
        }
        if (e.key === "Tab") setOpen(false);
        if (open && ["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
          e.preventDefault();
          const items = Array.from(
            root.current!.querySelectorAll<HTMLButtonElement>(
              '[role="menuitem"]',
            ),
          );
          const index = items.indexOf(
            document.activeElement as HTMLButtonElement,
          );
          items[
            e.key === "Home"
              ? 0
              : e.key === "End"
                ? items.length - 1
                : (index + (e.key === "ArrowDown" ? 1 : -1) + items.length) %
                  items.length
          ]?.focus();
        }
      }}
    >
      <button
        ref={trigger}
        className={
          compact ? "avatar small account-trigger" : "profile account-trigger"
        }
        aria-label="Open account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {compact ? (
          user?.name
            .split(" ")
            .map((part) => part[0])
            .slice(0, 2)
            .join("") || "AM"
        ) : (
          <>
            <div className="avatar">
              {user?.name
                .split(" ")
                .map((part) => part[0])
                .slice(0, 2)
                .join("")}
            </div>
            <div>
              <strong>{user?.name}</strong>
              <small>{user?.role}</small>
            </div>
            <span className="online-dot" />
          </>
        )}
      </button>
      {open && (
        <div className="account-menu" role="menu" aria-label="Account">
          <div className="account-heading">
            <strong>{user?.name}</strong>
            <small>{user?.role}</small>
          </div>
          {user?.is_admin && (
            <>
              <button
                role="menuitem"
                onClick={() => action("/settings/general")}
              >
                Account Settings
              </button>
              <button
                role="menuitem"
                onClick={() => action("/settings/security")}
              >
                Change Password
              </button>
            </>
          )}
          <button role="menuitem" onClick={() => action()}>
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
