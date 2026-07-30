import { useEffect, useRef, useState } from "react";
import {
  adminBlogCreate,
  adminBlogDelete,
  adminBlogList,
  adminBlogUpdate,
  adminFunnels,
  adminGrantEnterprise,
  adminLogin,
  adminLogout,
  adminMe,
  adminSignups,
  adminTraffic,
  isExcludeSelf,
  setExcludeSelf,
  type BlogPost,
  type FunnelStats,
  type SignupLists,
  type TrafficStats,
} from "../lib/adminApi";
import TurnstileWidget, { resetTurnstile } from "../components/TurnstileWidget";
import { useT } from "../lib/i18n";

type NavId =
  | "dashboard"
  | "activation"
  | "completion"
  | "template"
  | "traffic"
  | "email"
  | "errors"
  | "blog"
  | "signups"
  | "analytics";

function FunnelTable({
  title,
  steps,
  kpi,
  t,
}: {
  title: string;
  steps: { name: string; count: number }[];
  kpi?: string;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const max = Math.max(1, ...steps.map((s) => s.count));
  return (
    <section className="dash-card">
      <h2 className="dash-card-title">
        {title}
        {kpi ? (
          <span className="dash-kpi-tag">
            {t("admin.kpi")} · {kpi}
          </span>
        ) : null}
      </h2>
      <table className="admin-table">
        <thead>
          <tr>
            <th>{t("admin.colEvent")}</th>
            <th>{t("admin.colCount")}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {steps.map((step) => (
            <tr key={step.name} className={kpi && step.name === kpi ? "is-kpi" : undefined}>
              <td>
                <code>{step.name}</code>
              </td>
              <td>{step.count}</td>
              <td className="admin-bar-cell">
                <div className="admin-bar" style={{ width: `${(step.count / max) * 100}%` }} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function DayChart({
  rows,
  t,
}: {
  rows: { day: string; human: number; bot: number }[];
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.human + r.bot));
  return (
    <div className="dash-chart">
      <div className="dash-chart-bars">
        {rows.map((r) => (
          <div
            key={r.day}
            className="dash-chart-col"
            title={t("admin.chartTitle", { day: r.day, human: r.human, bot: r.bot })}
          >
            <div className="dash-chart-stack">
              <div className="dash-bar-human" style={{ height: `${(r.human / max) * 120}px` }} />
              <div className="dash-bar-bot" style={{ height: `${(r.bot / max) * 120}px` }} />
            </div>
            <span>{r.day.slice(5)}</span>
          </div>
        ))}
      </div>
      <div className="dash-chart-legend">
        <span>
          <i className="lg-human" /> {t("admin.legendHuman")}
        </span>
        <span>
          <i className="lg-bot" /> {t("admin.legendBot")}
        </span>
      </div>
    </div>
  );
}

function initials(email: string): string {
  const local = email.split("@")[0] || "A";
  return local.slice(0, 2).toUpperCase();
}

function DashAccountMenu({
  email,
  onAdmin,
  onLogout,
  t,
}: {
  email: string;
  onAdmin: () => void;
  onLogout: () => void;
  t: (key: string) => string;
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
        <a href="/app/account" role="menuitem">
          {t("account.subscription")}
        </a>
        <a href="/app/connector" role="menuitem">
          {t("nav.testConnectors")}
        </a>
        <button type="button" role="menuitem" className="is-active-soft" onClick={onAdmin}>
          {t("admin.title")}
        </button>
        <a href="mailto:founder@chasa.io" role="menuitem">
          {t("nav.support")}
        </a>
        <button type="button" role="menuitem" className="dash-logout" onClick={onLogout}>
          {t("nav.logoutArrow")}
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
        <span>{email}</span>
      </button>
    </div>
  );
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US");
  } catch {
    return iso.slice(0, 10);
  }
}

export default function Admin() {
  const t = useT();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [authedEmail, setAuthedEmail] = useState<string | null>(null);
  const [stats, setStats] = useState<FunnelStats | null>(null);
  const [traffic, setTraffic] = useState<TrafficStats | null>(null);
  const [signups, setSignups] = useState<SignupLists | null>(null);
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [nav, setNav] = useState<NavId>("analytics");
  const [days, setDays] = useState(30);
  // On by default: crawler hits belong in the page_views bot tiles, not in a funnel where the
  // click half can only ever come from a real browser.
  const [humansOnly, setHumansOnly] = useState(true);
  const [excludeSelf, setExcludeSelfState] = useState(isExcludeSelf());
  const [showAllFree, setShowAllFree] = useState(false);
  const [entEmail, setEntEmail] = useState("");
  const [blogForm, setBlogForm] = useState({
    title: "",
    slug: "",
    description: "",
    body: "",
    published: false,
  });

  async function loadAll(d = days, h = humansOnly) {
    const [f, t, s, b] = await Promise.all([
      adminFunnels(d, h),
      adminTraffic(d),
      adminSignups(),
      adminBlogList(),
    ]);
    setStats(f);
    setTraffic(t);
    setSignups(s);
    setPosts(b.posts);
  }

  useEffect(() => {
    adminMe()
      .then(async (me) => {
        setAuthedEmail(me.email);
        await loadAll(30);
      })
      .catch(() => setAuthedEmail(null))
      .finally(() => setLoading(false));
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await adminLogin(email, password, turnstileToken);
      setAuthedEmail(res.email);
      await loadAll(days);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("admin.loginFailed"));
      setTurnstileToken(null);
      resetTurnstile();
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    await adminLogout();
    setAuthedEmail(null);
    setStats(null);
  }

  async function changeDays(d: number) {
    setDays(d);
    setBusy(true);
    try {
      const [f, t] = await Promise.all([adminFunnels(d, humansOnly), adminTraffic(d)]);
      setStats(f);
      setTraffic(t);
    } finally {
      setBusy(false);
    }
  }

  // Only the funnels refetch — /traffic ignores the flag, since its human/bot split is the point.
  async function changeHumansOnly(on: boolean) {
    setHumansOnly(on);
    setBusy(true);
    try {
      setStats(await adminFunnels(days, on));
    } finally {
      setBusy(false);
    }
  }

  async function createBlog(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await adminBlogCreate({
        title: blogForm.title,
        slug: blogForm.slug || undefined,
        description: blogForm.description,
        body: blogForm.body,
        published: blogForm.published,
      });
      setBlogForm({ title: "", slug: "", description: "", body: "", published: false });
      const b = await adminBlogList();
      setPosts(b.posts);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("admin.createPostFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function togglePublish(post: BlogPost) {
    await adminBlogUpdate(post.id, { published: !post.published });
    const b = await adminBlogList();
    setPosts(b.posts);
  }

  async function removePost(id: string) {
    if (!confirm(t("admin.deletePostConfirm"))) return;
    await adminBlogDelete(id);
    const b = await adminBlogList();
    setPosts(b.posts);
  }

  async function grantEnterprise(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await adminGrantEnterprise(entEmail);
      setEntEmail("");
      setSignups(await adminSignups());
    } catch (err) {
      setError(err instanceof Error ? err.message : t("admin.grantFailed"));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="dash-shell">
        <div className="dash-loading">{t("common.loading")}</div>
      </div>
    );
  }

  if (!authedEmail) {
    return (
      <div className="dash-shell">
        <header className="dash-topnav">
          <a href="/" className="dash-brand" aria-label={t("admin.chasaHome")}>
            <img src="/brand/chasa-icon.png" alt="" width="22" height="22" />
            <span>chasa</span>
          </a>
        </header>
        <div className="dash-login-wrap">
          <div className="dash-login-card">
            <h1>{t("admin.title")}</h1>
            <p>{t("admin.signInSub")}</p>
            <form onSubmit={handleLogin}>
              <label>
                {t("team.email")}
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </label>
              <label>
                {t("login.passwordPlaceholder")}
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </label>
              <TurnstileWidget onToken={setTurnstileToken} />
              <button type="submit" className="btn-primary" disabled={busy}>
                {busy ? t("login.signingIn") : t("login.signIn")}
              </button>
            </form>
            {error && <div className="error-msg">{error}</div>}
          </div>
        </div>
      </div>
    );
  }

  const freeShown = showAllFree ? signups?.free ?? [] : (signups?.free ?? []).slice(0, 5);

  return (
    <div className="dash-shell">
      <header className="dash-topnav">
        <a href="/" className="dash-brand" aria-label={t("admin.chasaHome")}>
          <img src="/brand/chasa-icon.png" alt="" width="22" height="22" />
          <span>chasa</span>
        </a>
        <nav className="dash-topnav-links">
          <a href="/#pricing">{t("admin.pricing")}</a>
          <a href="/free-templates/">{t("admin.freeTemplates")}</a>
          <a href="/blog/">{t("admin.blog")}</a>
          <a href="/app/">{t("admin.app")}</a>
          <a href="/app/connector">{t("nav.testConnectors")}</a>
          <button type="button" className="dash-topnav-strong" onClick={() => setNav("analytics")}>
            {t("admin.title")}
          </button>
          <button type="button" onClick={handleLogout}>
            {t("nav.logout")}
          </button>
        </nav>
      </header>

      <div className="dash-body">
        <aside className="dash-sidebar">
          <a href="/app/" className="dash-new-btn">
            {t("admin.newChase")}
          </a>
          <nav className="dash-side-nav">
            {(
              [
                ["analytics", "admin.nav.analytics"],
                ["blog", "admin.nav.blog"],
                ["signups", "admin.nav.signups"],
                ["activation", "admin.nav.activation"],
                ["completion", "admin.nav.completion"],
                ["template", "admin.nav.template"],
                ["traffic", "admin.nav.traffic"],
                ["email", "admin.nav.email"],
                ["errors", "admin.nav.errors"],
              ] as const
            ).map(([id, labelKey]) => (
              <button
                key={id}
                type="button"
                className={nav === id ? "is-active" : ""}
                onClick={() => setNav(id)}
              >
                {t(labelKey)}
              </button>
            ))}
            <a href="/app/connector" className="dash-side-link">
              {t("nav.testConnectors")}
            </a>
          </nav>
          <div className="dash-side-footer">
            <DashAccountMenu
              email={authedEmail}
              onAdmin={() => setNav("analytics")}
              onLogout={handleLogout}
              t={t}
            />
          </div>
        </aside>

        <main className="dash-main">
          <h1>
            {nav === "blog"
              ? t("admin.nav.blog")
              : nav === "signups"
                ? t("admin.nav.signups")
                : nav === "analytics"
                  ? t("admin.nav.analytics")
                  : t("admin.welcomeBack")}
          </h1>
          <p className="dash-sub">
            {t("admin.analyticsSub")}
            {nav === "analytics" || nav === "activation" || nav === "completion"
              ? t("admin.signedInAs", { email: authedEmail })
              : null}
          </p>
          {error && <div className="error-msg">{error}</div>}

          {(nav === "analytics" ||
            nav === "activation" ||
            nav === "completion" ||
            nav === "template" ||
            nav === "traffic" ||
            nav === "email" ||
            nav === "errors") && (
            <>
              <div className="dash-range">
                {[7, 30, 90].map((d) => (
                  <button
                    key={d}
                    type="button"
                    className={days === d ? "is-on" : ""}
                    onClick={() => changeDays(d)}
                  >
                    {t("admin.lastDays", { days: d })}
                  </button>
                ))}
              </div>
              <label className="dash-exclude dash-exclude-tight">
                <input
                  type="checkbox"
                  checked={humansOnly}
                  onChange={(e) => changeHumansOnly(e.target.checked)}
                />
                {t("admin.humansOnly")}
              </label>
              <p className="dash-note dash-note-filter">
                {humansOnly ? t("admin.humansOnlyNote") : t("admin.allTrafficNote")}
              </p>
              <label className="dash-exclude">
                <input
                  type="checkbox"
                  checked={excludeSelf}
                  onChange={(e) => {
                    const on = e.target.checked;
                    setExcludeSelf(on);
                    setExcludeSelfState(on);
                  }}
                />
                {t("admin.excludeSelf")}
              </label>
            </>
          )}

          {nav === "analytics" && traffic && (
            <>
              <div className="dash-stat-row dash-stat-row-4">
                <div className="dash-stat">
                  <span className="dash-stat-label">{t("admin.pageViews")}</span>
                  <strong>{humansOnly ? traffic.humanPageViews : traffic.pageViews}</strong>
                  <em>
                    {humansOnly
                      ? t("admin.botExcluded", { pct: traffic.botPct })
                      : t("admin.botPct", { pct: traffic.botPct })}
                  </em>
                </div>
                <div className="dash-stat">
                  <span className="dash-stat-label">{t("admin.chasesSent")}</span>
                  <strong>{traffic.chasesSent}</strong>
                </div>
                <div className="dash-stat">
                  <span className="dash-stat-label">{t("admin.chasesCompleted")}</span>
                  <strong>{traffic.chasesCompleted}</strong>
                </div>
                <div className="dash-stat">
                  <span className="dash-stat-label">{t("admin.sentToCompleted")}</span>
                  <strong>{traffic.conversion}</strong>
                </div>
              </div>

              <section className="dash-card">
                <h2 className="dash-card-title">{t("admin.pageViewsByDay")}</h2>
                <DayChart rows={traffic.byDay} t={t} />
              </section>

              <div className="dash-grid-3">
                <section className="dash-card">
                  <h2 className="dash-card-title">{t("admin.byRoute")}</h2>
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>{t("admin.colRoute")}</th>
                        <th>{t("admin.colTotal")}</th>
                        <th>{t("admin.colHuman")}</th>
                        <th>{t("admin.colBot")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {traffic.byRoute.map((r) => (
                        <tr key={r.path}>
                          <td>
                            <code>{r.path}</code>
                          </td>
                          <td>{r.total}</td>
                          <td>{r.human}</td>
                          <td>{r.bot}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
                <section className="dash-card">
                  <h2 className="dash-card-title">{t("admin.byBot")}</h2>
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>{t("admin.colBotName")}</th>
                        <th>{t("admin.colViews")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {traffic.byBot.length === 0 ? (
                        <tr>
                          <td colSpan={2}>{t("admin.noBotsYet")}</td>
                        </tr>
                      ) : (
                        traffic.byBot.map((r) => (
                          <tr key={r.bot}>
                            <td>{r.bot}</td>
                            <td>{r.count}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </section>
                <section className="dash-card">
                  <h2 className="dash-card-title">{t("admin.byCountry")}</h2>
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>{t("admin.colCountry")}</th>
                        <th>{t("admin.colViews")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {traffic.byCountry.map((r) => (
                        <tr key={r.country}>
                          <td>{r.country}</td>
                          <td>{r.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              </div>
              <p className="dash-note">{traffic.note}</p>
            </>
          )}

          {nav === "blog" && (
            <section className="dash-card">
              <h2 className="dash-card-title">{t("admin.blogPosts")}</h2>
              <p className="dash-muted">{t("admin.blogMuted")}</p>
              {posts.length === 0 ? (
                <p className="dash-muted">{t("admin.noPosts")}</p>
              ) : (
                <ul className="dash-post-list">
                  {posts.map((p) => (
                    <li key={p.id}>
                      <div>
                        <strong>{p.title}</strong>
                        <span>
                          /{p.slug} · {p.published ? t("admin.published") : t("admin.draft")}
                        </span>
                      </div>
                      <div className="dash-post-actions">
                        <button type="button" className="btn-secondary" onClick={() => togglePublish(p)}>
                          {p.published ? t("admin.unpublish") : t("admin.publish")}
                        </button>
                        <button type="button" className="btn-secondary" onClick={() => removePost(p.id)}>
                          {t("admin.deletePost")}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <h3 className="dash-card-title" style={{ marginTop: 20 }}>
                {t("admin.newPost")}
              </h3>
              <form className="dash-blog-form" onSubmit={createBlog}>
                <input
                  placeholder={t("admin.postTitle")}
                  value={blogForm.title}
                  onChange={(e) => setBlogForm({ ...blogForm, title: e.target.value })}
                  required
                />
                <input
                  placeholder={t("admin.postSlug")}
                  value={blogForm.slug}
                  onChange={(e) => setBlogForm({ ...blogForm, slug: e.target.value })}
                />
                <input
                  placeholder={t("admin.postDesc")}
                  value={blogForm.description}
                  onChange={(e) => setBlogForm({ ...blogForm, description: e.target.value })}
                />
                <textarea
                  rows={8}
                  placeholder={t("admin.postBody")}
                  value={blogForm.body}
                  onChange={(e) => setBlogForm({ ...blogForm, body: e.target.value })}
                  required
                />
                <label className="dash-exclude">
                  <input
                    type="checkbox"
                    checked={blogForm.published}
                    onChange={(e) => setBlogForm({ ...blogForm, published: e.target.checked })}
                  />
                  {t("admin.publishedVisible")}
                </label>
                <button type="submit" className="btn-primary" disabled={busy}>
                  {t("admin.createPost")}
                </button>
              </form>
            </section>
          )}

          {nav === "signups" && signups && (
            <>
              <section className="dash-card">
                <h2 className="dash-card-title">{t("admin.allSignups", { total: signups.total })}</h2>
                <p className="dash-muted">{t("admin.signupsMuted")}</p>
                <button type="button" className="btn-secondary" onClick={() => setShowAllFree((v) => !v)}>
                  {showAllFree ? t("admin.showLess") : t("admin.showAll")}
                </button>
                <div className="dash-signup-cols">
                  <div>
                    <h3>{t("admin.free", { count: signups.free.length })}</h3>
                    <ul>
                      {freeShown.map((a) => (
                        <li key={a.email}>
                          <span>{a.email}</span>
                          <span>{fmtDate(a.createdAt)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3>{t("admin.paid", { count: signups.paid.length })}</h3>
                    <ul>
                      {signups.paid.map((a) => (
                        <li key={a.email}>
                          <span>
                            {a.email} · {a.plan}
                          </span>
                          <span>{fmtDate(a.createdAt)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </section>
              <section className="dash-card">
                <h2 className="dash-card-title">{t("admin.enterpriseAccounts")}</h2>
                <p className="dash-muted">{t("admin.enterpriseMuted")}</p>
                <form className="dash-ent-form" onSubmit={grantEnterprise}>
                  <input
                    type="email"
                    placeholder={t("admin.entEmailPlaceholder")}
                    value={entEmail}
                    onChange={(e) => setEntEmail(e.target.value)}
                    required
                  />
                  <button type="submit" className="btn-primary" disabled={busy}>
                    {t("admin.grantEnterprise")}
                  </button>
                </form>
                {signups.enterprise.length === 0 ? (
                  <p className="dash-muted">{t("admin.noEnterprise")}</p>
                ) : (
                  <ul className="dash-post-list">
                    {signups.enterprise.map((a) => (
                      <li key={a.email}>
                        <strong>{a.email}</strong>
                        <span>{fmtDate(a.createdAt)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}

          {stats && nav === "activation" && (
            <FunnelTable
              title={t("admin.activationFunnel")}
              steps={stats.activation}
              kpi="chase_sent"
              t={t}
            />
          )}
          {stats && nav === "completion" && (
            <FunnelTable
              title={t("admin.completionFunnel")}
              steps={stats.completion}
              kpi="chase_completed"
              t={t}
            />
          )}
          {stats && nav === "template" && (
            <FunnelTable
              title={t("admin.templateFunnel")}
              steps={stats.template}
              kpi="template_completed"
              t={t}
            />
          )}
          {stats && nav === "traffic" && (
            <FunnelTable
              title={t("admin.trafficEvents")}
              steps={stats.traffic}
              kpi="landingpage_cta_clicked"
              t={t}
            />
          )}
          {stats && nav === "email" && (
            <FunnelTable title={t("admin.emailFunnel")} steps={stats.email} kpi="email_clicked" t={t} />
          )}
          {stats && nav === "errors" && (
            <FunnelTable title={t("admin.errorEvents")} steps={stats.errors} t={t} />
          )}
        </main>
      </div>
    </div>
  );
}
