import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useT } from "../lib/i18n";

function initials(email: string): string {
  const local = email.split("@")[0] || "A";
  return local.slice(0, 2).toUpperCase();
}

type MenuIconName = "team" | "subscription" | "admin" | "support" | "logout" | "branding" | "account";

function MenuIcon({ name }: { name: MenuIconName }) {
  const props = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };
  switch (name) {
    case "team":
      return (
        <svg {...props}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case "subscription":
      return (
        <svg {...props}>
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <path d="M2 10h20" />
        </svg>
      );
    case "admin":
      return (
        <svg {...props}>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      );
    case "support":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <path d="M12 17h.01" />
        </svg>
      );
    case "logout":
      return (
        <svg {...props}>
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
      );
    case "branding":
      return (
        <svg {...props}>
          <circle cx="13.5" cy="6.5" r="2.5" />
          <path d="M20 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M8 21v-2a4 4 0 0 1 3-3.87" />
          <path d="M4 21v-1a3 3 0 0 1 3-3h.5" />
        </svg>
      );
    case "account":
      return (
        <svg {...props}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
        </svg>
      );
  }
}

export default function UserChip({
  email,
  plan,
  isAdmin = false,
  onLogout,
}: {
  email: string;
  plan?: string | null;
  isAdmin?: boolean;
  onLogout: () => void;
}) {
  const t = useT();
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
        <Link to="/team" role="menuitem" onClick={() => setOpen(false)}>
          <MenuIcon name="team" />
          {t("nav.team")}
        </Link>
        <Link to="/account" role="menuitem" onClick={() => setOpen(false)}>
          <MenuIcon name="subscription" />
          {t("nav.subscription")}
        </Link>
        {isAdmin && (
          <Link to="/admin" role="menuitem" onClick={() => setOpen(false)}>
            <MenuIcon name="admin" />
            {t("nav.admin")}
          </Link>
        )}
        <a href="mailto:founder@docstoc.io" role="menuitem">
          <MenuIcon name="support" />
          {t("nav.support")}
        </a>
        <div className="dash-account-popover-divider" role="separator" />
        <button type="button" role="menuitem" className="dash-logout" onClick={onLogout}>
          <MenuIcon name="logout" />
          {t("nav.logout")}
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
