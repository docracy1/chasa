import { useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { logout, type Account } from "../lib/api";
import { isWorkspaceAdmin } from "../lib/plan";
import { useT } from "../lib/i18n";
import LanguageSwitcher from "./LanguageSwitcher";
import UserChip from "./UserChip";

type NavIconName =
  | "dashboard"
  | "clients"
  | "tools"
  | "templates"
  | "chases"
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
    case "templates":
      return (
        <svg {...common}>
          <path d="M8 3h8a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
          <path d="M9.5 8h5M9.5 12h5M9.5 16h3" />
        </svg>
      );
    case "chases":
      return (
        <svg {...common}>
          <path d="M4 6h12l4 6-4 6H4l4-6-4-6z" />
          <path d="M8 12h6" />
        </svg>
      );
    case "tools":
      return (
        <svg {...common}>
          <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3.5 17.5l3 3 5.8-5.8a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.5-2.5 2.5-2.5z" />
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
  const [chasesExpanded, setChasesExpanded] = useState(false);
  const [toolsExpanded, setToolsExpanded] = useState(false);
  const logoSrc = account?.logoDataUrl || "/brand/chasa-icon.png";
  const wordmark = account?.workspaceName || "chasa";
  const workspaceAdmin = isWorkspaceAdmin(account);

  const view = new URLSearchParams(location.search).get("view");
  const onDashboard = location.pathname === "/" || location.pathname === "";

  // Docracy-style sidebar: text items + Documents/Tools-style accordions. Team/Subscription stay
  // in the account chip only. Branding / webhooks / connectors are workspace-admin only.
  const chasesNav = [
    { pathname: "/", search: "?view=overdue", view: "overdue" as const, label: t("nav.chasesOverdue") },
    { pathname: "/", search: "?view=waiting", view: "waiting" as const, label: t("nav.chasesWaiting") },
    { pathname: "/", search: "?view=paid", view: "paid" as const, label: t("nav.chasesPaid") },
  ];

  // Docracy keeps Tools to admin-only workspace settings — Contacts/Team live outside it
  // (Contacts gets its own sidebar slot, Team lives in the account popover).
  const toolsNav = (
    [
      workspaceAdmin
        ? { to: "/connector", hash: "api-key", label: t("nav.connectorApi") }
        : null,
      workspaceAdmin ? { to: "/webhooks", hash: undefined, label: t("nav.webhooks") } : null,
      workspaceAdmin
        ? { to: "/connector", hash: "cloud", label: t("nav.connectors") }
        : null,
      workspaceAdmin ? { to: "/branding", hash: undefined, label: t("nav.branding") } : null,
    ] as const
  ).filter(Boolean) as Array<{ to: string; hash: string | undefined; label: string }>;

  const chasesPathActive = onDashboard && (view === "overdue" || view === "waiting" || view === "paid");
  const toolsPathActive =
    workspaceAdmin &&
    (location.pathname.startsWith("/connector") ||
      location.pathname.startsWith("/webhooks") ||
      location.pathname.startsWith("/branding"));

  useEffect(() => {
    if (chasesPathActive) setChasesExpanded(true);
  }, [chasesPathActive]);

  useEffect(() => {
    if (toolsPathActive) setToolsExpanded(true);
  }, [toolsPathActive]);

  const moreLinks = (
    [
      { to: "/?view=overdue", label: t("nav.chasesOverdue"), icon: "chases" as const },
      { to: "/?view=waiting", label: t("nav.chasesWaiting"), icon: "chases" as const },
      { to: "/?view=paid", label: t("nav.chasesPaid"), icon: "chases" as const },
      { to: "/clients", label: t("nav.clients"), icon: "clients" as const },
      workspaceAdmin
        ? { to: "/connector", label: t("nav.connectorApi"), icon: "connector" as const }
        : null,
      workspaceAdmin
        ? { to: "/webhooks", label: t("nav.webhooks"), icon: "webhooks" as const }
        : null,
      workspaceAdmin
        ? { to: "/branding", label: t("nav.branding"), icon: "branding" as const }
        : null,
      { to: "/team", label: t("nav.team"), icon: "team" as const },
      { to: "/account", label: t("nav.subscription"), icon: "account" as const },
    ] as const
  ).filter(Boolean) as Array<{
    to: string;
    label: string;
    icon: "chases" | "clients" | "connector" | "webhooks" | "branding" | "team" | "account";
  }>;

  const pageTitles: Array<{ match: (path: string, search: string) => boolean; title: string }> = [
    {
      match: (p, s) => (p === "/" || p === "") && new URLSearchParams(s).get("view") === "overdue",
      title: t("nav.chasesOverdue"),
    },
    {
      match: (p, s) => (p === "/" || p === "") && new URLSearchParams(s).get("view") === "waiting",
      title: t("nav.chasesWaiting"),
    },
    {
      match: (p, s) => (p === "/" || p === "") && new URLSearchParams(s).get("view") === "paid",
      title: t("nav.chasesPaid"),
    },
    { match: (p) => p.startsWith("/new"), title: t("nav.newChase") },
    { match: (p) => p.startsWith("/templates"), title: t("nav.templates") },
    { match: (p) => p === "/" || p === "", title: t("nav.dashboard") },
    { match: (p) => p.startsWith("/clients"), title: t("nav.clients") },
    { match: (p) => p.startsWith("/connector"), title: t("nav.tools") },
    { match: (p) => p.startsWith("/team"), title: t("nav.team") },
    { match: (p) => p.startsWith("/branding"), title: t("nav.branding") },
    { match: (p) => p.startsWith("/webhooks"), title: t("nav.webhooks") },
    { match: (p) => p.startsWith("/account"), title: t("nav.subscription") },
    { match: (p) => p.startsWith("/admin"), title: t("nav.admin") },
  ];

  const pageTitle =
    pageTitles.find((entry) => entry.match(location.pathname, location.search))?.title ?? "chasa";

  function toolItemActive(to: string, hash?: string): boolean {
    if (to === "/webhooks") return location.pathname.startsWith("/webhooks");
    if (to === "/branding") return location.pathname.startsWith("/branding");
    if (!location.pathname.startsWith("/connector")) return false;
    const current = location.hash.replace(/^#/, "") || "api-key";
    return current === (hash || "api-key");
  }

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
      <header className="app-topbar">
        <Link
          to="/"
          className="app-topbar-brand"
          aria-label={t("nav.home")}
          onClick={(e) => {
            e.preventDefault();
            setMoreSheetOpen(false);
            // Always return to the clean dashboard (drop ?view= / ?focus=).
            navigate({ pathname: "/", search: "" }, { replace: true });
            window.scrollTo(0, 0);
          }}
        >
          <img src={logoSrc} alt="" width="24" height="24" />
          <span>{wordmark}</span>
        </Link>
        <span className="app-topbar-title">{pageTitle}</span>
        <LanguageSwitcher className="lang-switcher-on-dark" />
      </header>

      <aside className="app-sidebar">
        <Link
          to="/"
          className="app-brand"
          aria-label={t("nav.home")}
          onClick={(e) => {
            e.preventDefault();
            setMoreSheetOpen(false);
            navigate({ pathname: "/", search: "" }, { replace: true });
            window.scrollTo(0, 0);
          }}
        >
          <img src={logoSrc} alt="" width="28" height="28" />
          <span>{wordmark}</span>
        </Link>
        <Link to="/new" className={`dash-new-btn${location.pathname.startsWith("/new") ? " is-active" : ""}`}>
          {t("nav.new")}
        </Link>

        <nav className="dash-side-nav" aria-label={t("nav.app")}>
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              isActive && !view ? "dash-nav-item is-active" : "dash-nav-item"
            }
          >
            <span className="dash-nav-item-label">
              <NavIcon name="dashboard" />
              <span>{t("nav.dashboard")}</span>
            </span>
          </NavLink>

          <NavLink
            to="/templates"
            className={({ isActive }) => (isActive ? "dash-nav-item is-active" : "dash-nav-item")}
          >
            <span className="dash-nav-item-label">
              <NavIcon name="templates" />
              <span>{t("nav.templates")}</span>
            </span>
          </NavLink>

          <NavLink
            to="/clients"
            className={({ isActive }) => (isActive ? "dash-nav-item is-active" : "dash-nav-item")}
          >
            <span className="dash-nav-item-label">
              <NavIcon name="clients" />
              <span>{t("nav.clients")}</span>
            </span>
          </NavLink>

          <div className="dash-nav-group">
            <button
              type="button"
              className={`dash-nav-item dash-nav-group-header${chasesPathActive ? " is-active" : ""}`}
              aria-expanded={chasesExpanded}
              onClick={() => {
                setChasesExpanded((open) => !open);
                if (!onDashboard) navigate("/");
              }}
            >
              <span className="dash-nav-item-label">
                <NavIcon name="chases" />
                <span>{t("nav.chases")}</span>
              </span>
              <span className={`dash-nav-chevron${chasesExpanded ? " is-open" : ""}`} aria-hidden="true">
                ⌄
              </span>
            </button>
            {chasesExpanded ? (
              <div className="dash-nav-subitems">
                {chasesNav.map((item) => (
                  <Link
                    key={item.view}
                    to={{ pathname: item.pathname, search: item.search }}
                    className={`dash-nav-subitem${onDashboard && view === item.view ? " is-active" : ""}`}
                    onClick={() => setChasesExpanded(true)}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>

          <div className="dash-nav-group">
            <button
              type="button"
              className={`dash-nav-item dash-nav-group-header${toolsPathActive ? " is-active" : ""}`}
              aria-expanded={toolsExpanded}
              onClick={() => setToolsExpanded((open) => !open)}
            >
              <span className="dash-nav-item-label">
                <NavIcon name="tools" />
                <span>{t("nav.tools")}</span>
              </span>
              <span className={`dash-nav-chevron${toolsExpanded ? " is-open" : ""}`} aria-hidden="true">
                ⌄
              </span>
            </button>
            {toolsExpanded ? (
              <div className="dash-nav-subitems">
                {toolsNav.map((item) => {
                  const href = item.hash ? `${item.to}#${item.hash}` : item.to;
                  const active = toolItemActive(item.to, item.hash);
                  return (
                    <Link
                      key={href}
                      to={href}
                      className={`dash-nav-subitem${active ? " is-active" : ""}`}
                      onClick={() => setToolsExpanded(true)}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            ) : null}
          </div>
        </nav>

        <div className="dash-side-footer">
          {!loading && account ? (
            <UserChip
              email={account.email}
              plan={account.plan}
              isAdmin={!!account.isAdmin}
              onLogout={handleLogout}
            />
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
          className={({ isActive }) => `app-bottom-nav-item${isActive && !view ? " is-active" : ""}`}
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
          to="/new"
          className="app-bottom-nav-fab"
          aria-label={t("nav.newChase")}
          onClick={() => setMoreSheetOpen(false)}
        >
          <span aria-hidden="true">+</span>
        </Link>
        <NavLink
          to={workspaceAdmin ? "/connector" : "/templates"}
          className={({ isActive }) => `app-bottom-nav-item${isActive ? " is-active" : ""}`}
          onClick={() => setMoreSheetOpen(false)}
        >
          <NavIcon name={workspaceAdmin ? "tools" : "templates"} size={22} />
          <span>{workspaceAdmin ? t("nav.tools") : t("nav.templates")}</span>
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
            <Link to="/templates" onClick={() => setMoreSheetOpen(false)}>
              <NavIcon name="templates" />
              <span>{t("nav.templates")}</span>
            </Link>
            {moreLinks.map((item) => (
              <Link key={item.to} to={item.to} onClick={() => setMoreSheetOpen(false)}>
                <NavIcon name={item.icon} />
                <span>{item.label}</span>
              </Link>
            ))}
            {account?.isAdmin ? (
              <Link to="/admin" onClick={() => setMoreSheetOpen(false)}>
                <NavIcon name="account" />
                <span>{t("nav.admin")}</span>
              </Link>
            ) : null}
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
