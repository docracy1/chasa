import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

function initials(email: string): string {
  const local = email.split("@")[0] || "A";
  return local.slice(0, 2).toUpperCase();
}

export default function UserChip({
  email,
  plan,
  onLogout,
}: {
  email: string;
  plan?: string | null;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearLeaveTimer() {
    if (leaveTimer.current != null) {
      clearTimeout(leaveTimer.current);
      leaveTimer.current = null;
    }
  }

  function openMenu() {
    clearLeaveTimer();
    setOpen(true);
  }

  function scheduleClose(delayMs = 160) {
    clearLeaveTimer();
    leaveTimer.current = setTimeout(() => setOpen(false), delayMs);
  }

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      clearLeaveTimer();
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className={`dash-account-menu${open ? " is-open" : ""}`}
      onMouseEnter={openMenu}
      onMouseLeave={() => scheduleClose()}
      onFocusCapture={openMenu}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) scheduleClose(0);
      }}
    >
      <div className="dash-account-popover" role="menu" hidden={!open}>
        <Link to="/account" role="menuitem" onClick={() => setOpen(false)}>
          Account
        </Link>
        <Link to="/team" role="menuitem" onClick={() => setOpen(false)}>
          Team
        </Link>
        <Link to="/connector" role="menuitem" onClick={() => setOpen(false)}>
          Test connectors
        </Link>
        <a href="/app/admin" role="menuitem">
          Admin
        </a>
        <a href="mailto:founder@chasa.io" role="menuitem">
          Support
        </a>
        <a href="/" role="menuitem">
          Marketing site
        </a>
        <a
          href="https://www.linkedin.com/company/chasa-io"
          role="menuitem"
          target="_blank"
          rel="noopener noreferrer"
        >
          LinkedIn
        </a>
        <a href="https://x.com/chasaHQ" role="menuitem" target="_blank" rel="noopener noreferrer">
          X
        </a>
        <button type="button" role="menuitem" className="dash-logout" onClick={onLogout}>
          ← Log out
        </button>
      </div>
      <button
        type="button"
        className="dash-user-chip"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          clearLeaveTimer();
          const fineHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
          if (fineHover) {
            setOpen(true);
            return;
          }
          setOpen((v) => !v);
        }}
      >
        <span className="dash-avatar" aria-hidden="true">
          {initials(email)}
        </span>
        <span className="dash-user-meta">
          <span className="dash-user-email">{email}</span>
          {plan ? <span className="dash-user-plan">{plan}</span> : null}
        </span>
      </button>
    </div>
  );
}
