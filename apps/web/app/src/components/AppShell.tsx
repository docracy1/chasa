import { useState, type ReactNode } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { logout, type Account } from "../lib/api";
import { useT } from "../lib/i18n";
import LanguageSwitcher from "./LanguageSwitcher";
import UserChip from "./UserChip";

type NavIconName =
  | "dashboard"
  | "clients"
  | "connector"
  | "team"
  | "branding"
  | "webhooks"
  | "account"
  | "more"
  | "support";

function NavIcon({ name, size = 20 }: { name: NavIconName; size?: number }) {
  const common = {
    className: "nav-icon",
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none" as const,
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };
  switch (name) {
    case "dashboard":
      return (
        <svg {...common}>
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
      );
    case "clients":
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="3" />
          <path d="M3.5 19.5c0-3 2.5-5.5 5.5-5.5s5.5 2.5 5.5 5.5" />
          <circle cx="17" cy="9" r="2.25" />
          <path d="M15.5 14.2c2.3.4 4 2.4 4 5.3" />
        </svg>
      );
    case "connector":
      return (
        <svg {...common}>
          <path d="M10 13a5 5 0 0 0 7.07 0l1.41-1.41a5 5 0 0 0-7.07-7.07L10 5.93" />
          <path d="M14 11a5 5 0 0 0-7.07 0L5.52 12.41a5 5 0 0 0 7.07 7.07L14 18.07" />
        </svg>
      );
    case "team":
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="2.75" />
          <circle cx="16" cy="8" r="2.75" />
          <path d="M3.5 19c0-2.8 2-5 4.5-5s4.5 2.2 4.5 5" />
          <path d="M11.5 19c0-2.8 2-5 4.5-5s4.5 2.2 4.5 5" />
        </svg>
      );
    case "branding":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3.25" />
          <path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6.1 6.1l1.6 1.6M16.3 16.3l1.6 1.6M17.9 6.1l-1.6 1.6M7.7 16.3l-1.6 1.6" />
        </svg>
      );
    case "webhooks":
      return (
        <svg {...common}>
          <path d="M8 7h11l-2.5 3L19 13H8a3 3 0 1 1 0-6z" />
          <path d="M8 17a3 3 0 1 0 0-6" />
        </svg>
      );
    case "account":
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="3.25" />
          <path d="M5 19.5c0-3.4 3.1-6 7-6s7 2.6 7 6" />
        </svg>
      );
    case "support":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.25" />
          <path d="M9.4 9.4a2.7 2.7 0 0 1 5.2.9c0 1.6-2.6 2.2-2.6 3.7" />
          <circle cx="12" cy="17" r="0.8" fill="currentColor" stroke="none" />
        </svg>
      );
    case "more":
      return (
        <svg {...common}>
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      );
  }
}

function scrollToNewChase() {
  requestAnimationFrame(() => {
    document.getElementById("chase-workspace")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

export default function AppShell({
  account,
  loading,
  refresh,
  onLogout,
  children,
}: {
  account: Account | null;
  loading: boolean;
  refresh: () => Promise<void>;
  onLogout?: () => void | Promise<void>;
  children: ReactNode;
}) {
  const t = useT();
  const navigate = useNavigate();
  const location = useLocation();
  const [moreSheetOpen, setMoreSheetOpen] = useState(false);
  const logoSrc = account?.logoDataUrl || "/brand/chasa-icon.png";
  const wordmark = account?.workspaceName || "chasa";

  const nav = [
    { to: "/", label: t("nav.dashboard"), icon: "dashboard" as const, end: true },
    { to: "/clients", label: t("nav.clients"), icon: "clients" as const },
    { to: "/connector", label: t("nav.testConnectors"), icon: "connector" as const },
    { to: "/team", label: t("nav.team"), icon: "team" as const },
    { to: "/branding", label: t("nav.branding"), icon: "branding" as const },
    { to: "/webhooks", label: t("nav.webhooks"), icon: "webhooks" as const },
    { to: "/account", label: t("nav.account"), icon: "account" as const },
  ] as const;

  const moreLinks = [
    { to: "/team", label: t("nav.team"), icon: "team" as const },
    { to: "/branding", label: t("nav.branding"), icon: "branding" as const },
    { to: "/webhooks", label: t("nav.webhooks"), icon: "webhooks" as const },
    { to: "/account", label: t("nav.account"), icon: "account" as const },
  ] as const;

  const pageTitles: Array<{ match: (path: string) => boolean; title: string }> = [
    { match: (p) => p === "/" || p === "", title: t("nav.dashboard") },
    { match: (p) => p.startsWith("/clients"), title: t("nav.clients") },
    { match: (p) => p.startsWith("/connector"), title: t("nav.connectors") },
    { match: (p) => p.startsWith("/team"), title: t("nav.team") },
    { match: (p) => p.startsWith("/branding"), title: t("nav.branding") },
    { match: (p) => p.startsWith("/webhooks"), title: t("nav.webhooks") },
    { match: (p) => p.startsWith("/account"), title: t("nav.account") },
  ];

  const pageTitle = pageTitles.find((entry) => entry.match(location.pathname))?.title ?? "chasa";

  async function handleLogout() {
    setMoreSheetOpen(false);
    if (onLogout) {
      await onLogout();
      return;
    }
    await logout();
    await refresh();
    navigate("/login");
  }

  return (
    <div className="app-shell">
      <header className="app-mobile-header">
        <Link to="/" className="app-mobile-brand" aria-label={t("nav.home")} onClick={() => setMoreSheetOpen(false)}>
          <img src={logoSrc} alt="" width="24" height="24" />
          <span>{wordmark}</span>
        </Link>
        <span className="app-mobile-title">{pageTitle}</span>
      </header>

      <aside className="app-sidebar">
        <Link to="/" className="app-brand" aria-label={t("nav.home")}>
          <img src={logoSrc} alt="" width="28" height="28" />
          <span>{wordmark}</span>
        </Link>

        <Link
          to="/"
          className="dash-new-btn"
          onClick={() => {
            scrollToNewChase();
          }}
        >
          + {t("nav.newChase")}
        </Link>

        <nav className="dash-side-nav" aria-label={t("nav.app")}>
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={"end" in item ? item.end : false}
              className={({ isActive }) => (isActive ? "is-active" : undefined)}
            >
              <NavIcon name={item.icon} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="dash-side-footer">
          <LanguageSwitcher className="lang-switcher-sidebar" />
          {!loading && account ? (
            <UserChip email={account.email} plan={account.plan} onLogout={handleLogout} />
          ) : !loading ? (
            <Link to="/login" className="app-signin-chip">
              {t("nav.signin")}
            </Link>
          ) : (
            <div className="app-signin-chip is-muted">{t("common.loading")}</div>
          )}
        </div>
      </aside>

      <main className="app-main">{children}</main>

      <nav className="app-bottom-nav" aria-label={t("nav.app")}>
        <NavLink
          to="/"
          end
          className={({ isActive }) => `app-bottom-nav-item${isActive ? " is-active" : ""}`}
          onClick={() => setMoreSheetOpen(false)}
        >
          <NavIcon name="dashboard" size={22} />
          <span>{t("nav.dashboard")}</span>
        </NavLink>
        <NavLink
          to="/clients"
          className={({ isActive }) => `app-bottom-nav-item${isActive ? " is-active" : ""}`}
          onClick={() => setMoreSheetOpen(false)}
        >
          <NavIcon name="clients" size={22} />
          <span>{t("nav.clients")}</span>
        </NavLink>
        <Link
          to="/"
          className="app-bottom-nav-fab"
          aria-label={t("nav.newChase")}
          onClick={() => {
            setMoreSheetOpen(false);
            scrollToNewChase();
          }}
        >
          <span aria-hidden="true">+</span>
        </Link>
        <NavLink
          to="/connector"
          className={({ isActive }) => `app-bottom-nav-item${isActive ? " is-active" : ""}`}
          onClick={() => setMoreSheetOpen(false)}
        >
          <NavIcon name="connector" size={22} />
          <span>{t("nav.connect")}</span>
        </NavLink>
        <button
          type="button"
          className={`app-bottom-nav-item${moreSheetOpen ? " is-active" : ""}`}
          onClick={() => setMoreSheetOpen((open) => !open)}
        >
          <NavIcon name="more" size={22} />
          <span>{t("nav.more")}</span>
        </button>
      </nav>

      {moreSheetOpen && (
        <div className="app-more-sheet" role="dialog" aria-label={t("nav.more")}>
          <button
            type="button"
            className="app-more-backdrop"
            aria-label={t("nav.close")}
            onClick={() => setMoreSheetOpen(false)}
          />
          <div className="app-more-panel">
            <div className="app-more-handle" aria-hidden="true" />
            {account ? <p className="app-more-email">{account.email}</p> : null}
            <div className="app-more-lang">
              <LanguageSwitcher />
            </div>
            {moreLinks.map((item) => (
              <Link key={item.to} to={item.to} onClick={() => setMoreSheetOpen(false)}>
                <NavIcon name={item.icon} />
                <span>{item.label}</span>
              </Link>
            ))}
            <a href="mailto:founder@chasa.io" onClick={() => setMoreSheetOpen(false)}>
              <NavIcon name="support" />
              <span>{t("nav.support")}</span>
            </a>
            {account ? (
              <button type="button" className="app-more-danger" onClick={() => void handleLogout()}>
                {t("nav.logout")}
              </button>
            ) : (
              <Link to="/login" onClick={() => setMoreSheetOpen(false)}>
                {t("nav.signin")}
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
