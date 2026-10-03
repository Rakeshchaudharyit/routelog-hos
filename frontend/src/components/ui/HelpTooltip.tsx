import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Info } from "lucide-react";

export function HelpTooltip({
  label,
  children,
  controlLabel,
}: {
  label: string;
  children: ReactNode;
  controlLabel?: string;
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const pinned = useRef(false);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const cancelLeave = () => clearTimeout(leaveTimer.current);
  const close = () => {
    cancelLeave();
    pinned.current = false;
    setOpen(false);
  };
  const leave = () => {
    cancelLeave();
    if (!pinned.current && document.activeElement !== trigger.current)
      leaveTimer.current = setTimeout(() => setOpen(false), 150);
  };
  useEffect(() => () => clearTimeout(leaveTimer.current), []);

  useLayoutEffect(() => {
    if (!open || !panel.current || !trigger.current) return;
    const element = panel.current;
    element.showPopover();
    const position = () => {
      const anchor = trigger.current!.getBoundingClientRect();
      if (anchor.bottom < 0 || anchor.top > window.innerHeight) {
        close();
        return;
      }
      const bounds = element.getBoundingClientRect();
      const width = document.documentElement.clientWidth;
      const height = window.innerHeight;
      const left = Math.max(
        12,
        Math.min(anchor.left, width - bounds.width - 12),
      );
      const below = anchor.bottom + 8;
      const above = anchor.top - bounds.height - 8;
      const top =
        !controlLabel && above >= 12
          ? above
          : below + bounds.height <= height - 12
            ? below
            : Math.max(12, above);
      element.style.left = `${left}px`;
      element.style.top = `${top}px`;
    };
    position();
    window.addEventListener("resize", position);
    document.addEventListener("scroll", position, true);
    return () => {
      window.removeEventListener("resize", position);
      document.removeEventListener("scroll", position, true);
      element.hidePopover();
    };
  }, [open, controlLabel]);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (
        !trigger.current?.contains(event.target as Node) &&
        !panel.current?.contains(event.target as Node)
      )
        close();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        // Dismiss this help first when it is inside the Full Log dialog.
        event.preventDefault();
        event.stopPropagation();
        close();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape, true);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape, true);
    };
  }, [open]);

  return (
    <span
      className="context-help"
      onMouseEnter={() => {
        cancelLeave();
        if (!controlLabel && window.matchMedia("(hover: hover)").matches)
          setOpen(true);
      }}
      onMouseLeave={(event) => {
        if (
          !pinned.current &&
          !panel.current?.contains(event.relatedTarget as Node) &&
          document.activeElement !== trigger.current
        )
          leave();
      }}
    >
      <button
        ref={trigger}
        type="button"
        className={`help-trigger${controlLabel ? " help-trigger-labeled" : ""}`}
        aria-label={controlLabel || `Help: ${label}`}
        aria-expanded={open}
        aria-controls={id}
        aria-describedby={open ? id : undefined}
        onFocus={() => {
          if (!controlLabel) setOpen(true);
        }}
        onBlur={(event) => {
          if (!panel.current?.contains(event.relatedTarget as Node)) close();
        }}
        onClick={() => {
          if (pinned.current) close();
          else {
            pinned.current = true;
            setOpen(true);
          }
        }}
      >
        <Info size={15} aria-hidden="true" />
        {controlLabel}
      </button>
      {open && (
        <div
          ref={panel}
          id={id}
          popover="manual"
          role={controlLabel ? "region" : "tooltip"}
          aria-label={controlLabel ? label : undefined}
          className={`help-panel${controlLabel ? " help-panel-guide" : ""}`}
          onMouseEnter={cancelLeave}
          onMouseLeave={leave}
        >
          {children}
        </div>
      )}
    </span>
  );
}
