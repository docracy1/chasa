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
}: {
  title: string;
  steps: { name: string; count: number }[];
  kpi?: string;
}) {
  const max = Math.max(1, ...steps.map((s) => s.count));
  return (
    <section className="dash-card">
      <h2 className="dash-card-title">
        {title}
        {kpi ? <span className="dash-kpi-tag">KPI · {kpi}</span> : null}
      </h2>
      <table className="admin-table">
        <thead>
          <tr>
            <th>Event</th>
            <th>Count</th>
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

function DayChart({ rows }: { rows: { day: string; human: number; bot: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.human + r.bot));
  return (
    <div className="dash-chart">
      <div className="dash-chart-bars">
        {rows.map((r) => (
          <div key={r.day} className="dash-chart-col" title={`${r.day}: ${r.human} human / ${r.bot} bot`}>
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
          <i className="lg-human" /> Human
        </span>
        <span>
          <i className="lg-bot" /> Bot
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
}: {
  email: string;
  onAdmin: () => void;
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
        <a href="/app/account" role="menuitem">
          Subscription
        </a>
        <a href="/app/connector" role="menuitem">
          Test connectors
        </a>
        <button type="button" role="menuitem" className="is-active-soft" onClick={onAdmin}>
          Admin
        </button>
        <a href="mailto:founder@chasa.io" role="menuitem">
          Support
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
        <span>{email}</span>
      </button>
    </div>
  );
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-GB");
  } catch {
    return iso.slice(0, 10);
  }
}

export default function Admin() {
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

  async function loadAll(d = days) {
    const [f, t, s, b] = await Promise.all([
      adminFunnels(d),
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
      setError(err instanceof Error ? err.message : "Login failed");
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
      const [f, t] = await Promise.all([adminFunnels(d), adminTraffic(d)]);
      setStats(f);
      setTraffic(t);
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
      setError(err instanceof Error ? err.message : "Could not create post");
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
    if (!confirm("Delete this post?")) return;
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
      setError(err instanceof Error ? err.message : "Grant failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="dash-shell">
        <div className="dash-loading">Loading…</div>
      </div>
    );
  }

  if (!authedEmail) {
    return (
      <div className="dash-shell">
        <header className="dash-topnav">
          <a href="/" className="dash-brand" aria-label="Chasa home">
            <img src="/brand/chasa-icon.png" alt="" width="22" height="22" />
            <span>chasa</span>
          </a>
        </header>
        <div className="dash-login-wrap">
          <div className="dash-login-card">
            <h1>Admin</h1>
            <p>Sign in as admin to manage Chasa.</p>
            <form onSubmit={handleLogin}>
              <label>
                Email
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </label>
              <label>
                Password
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </label>
              <TurnstileWidget onToken={setTurnstileToken} />
              <button type="submit" className="btn-primary" disabled={busy}>
                {busy ? "Signing in…" : "Sign in"}
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
        <a href="/" className="dash-brand" aria-label="Chasa home">
          <img src="/brand/chasa-icon.png" alt="" width="22" height="22" />
          <span>chasa</span>
        </a>
        <nav className="dash-topnav-links">
          <a href="/#pricing">Pricing</a>
          <a href="/free-templates/">Free templates</a>
          <a href="/blog/">Blog</a>
          <a href="/app/">App</a>
          <a href="/app/connector">Test connectors</a>
          <button type="button" className="dash-topnav-strong" onClick={() => setNav("analytics")}>
            Admin
          </button>
          <button type="button" onClick={handleLogout}>
            Log out
          </button>
        </nav>
      </header>

      <div className="dash-body">
        <aside className="dash-sidebar">
          <a href="/app/" className="dash-new-btn">
            + New chase
          </a>
          <nav className="dash-side-nav">
            {(
              [
                ["analytics", "Analytics"],
                ["blog", "Blog posts"],
                ["signups", "Signups"],
                ["activation", "Activation"],
                ["completion", "Completion"],
                ["template", "Templates"],
                ["traffic", "Traffic events"],
                ["email", "Email"],
                ["errors", "Errors"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={nav === id ? "is-active" : ""}
                onClick={() => setNav(id)}
              >
                {label}
              </button>
            ))}
            <a href="/app/connector" className="dash-side-link">
              Test connectors
            </a>
          </nav>
          <div className="dash-side-footer">
            <DashAccountMenu
              email={authedEmail}
              onAdmin={() => setNav("analytics")}
              onLogout={handleLogout}
            />
          </div>
        </aside>

        <main className="dash-main">
          <h1>
            {nav === "blog"
              ? "Blog posts"
              : nav === "signups"
                ? "Signups"
                : nav === "analytics"
                  ? "Analytics"
                  : "Welcome back"}
          </h1>
          <p className="dash-sub">
            Aggregate traffic and funnel counts — no per-visitor tracking, no IPs stored.
            {nav === "analytics" || nav === "activation" || nav === "completion"
              ? ` Signed in as ${authedEmail}.`
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
                    Last {d}d
                  </button>
                ))}
              </div>
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
                Don&apos;t count my own visits (this browser only)
              </label>
            </>
          )}

          {nav === "analytics" && traffic && (
            <>
              <div className="dash-stat-row dash-stat-row-4">
                <div className="dash-stat">
                  <span className="dash-stat-label">Page views</span>
                  <strong>{traffic.pageViews}</strong>
                  <em>{traffic.botPct}% known bots</em>
                </div>
                <div className="dash-stat">
                  <span className="dash-stat-label">Chases sent</span>
                  <strong>{traffic.chasesSent}</strong>
                </div>
                <div className="dash-stat">
                  <span className="dash-stat-label">Chases completed</span>
                  <strong>{traffic.chasesCompleted}</strong>
                </div>
                <div className="dash-stat">
                  <span className="dash-stat-label">Sent → completed</span>
                  <strong>{traffic.conversion}</strong>
                </div>
              </div>

              <section className="dash-card">
                <h2 className="dash-card-title">Page views by day</h2>
                <DayChart rows={traffic.byDay} />
              </section>

              <div className="dash-grid-3">
                <section className="dash-card">
                  <h2 className="dash-card-title">By route</h2>
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Route</th>
                        <th>Total</th>
                        <th>Human</th>
                        <th>Bot</th>
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
                  <h2 className="dash-card-title">By bot</h2>
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Bot</th>
                        <th>Views</th>
                      </tr>
                    </thead>
                    <tbody>
                      {traffic.byBot.length === 0 ? (
                        <tr>
                          <td colSpan={2}>No bots yet</td>
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
                  <h2 className="dash-card-title">By country</h2>
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Country</th>
                        <th>Views</th>
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
              <h2 className="dash-card-title">Blog posts</h2>
              <p className="dash-muted">
                Publish articles yourself — no code deploy needed. New posts appear on /blog as soon
                as you publish them.
              </p>
              {posts.length === 0 ? (
                <p className="dash-muted">No posts yet — write your first one below.</p>
              ) : (
                <ul className="dash-post-list">
                  {posts.map((p) => (
                    <li key={p.id}>
                      <div>
                        <strong>{p.title}</strong>
                        <span>
                          /{p.slug} · {p.published ? "Published" : "Draft"}
                        </span>
                      </div>
                      <div className="dash-post-actions">
                        <button type="button" className="btn-secondary" onClick={() => togglePublish(p)}>
                          {p.published ? "Unpublish" : "Publish"}
                        </button>
                        <button type="button" className="btn-secondary" onClick={() => removePost(p.id)}>
                          Delete
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <h3 className="dash-card-title" style={{ marginTop: 20 }}>
                New post
              </h3>
              <form className="dash-blog-form" onSubmit={createBlog}>
                <input
                  placeholder="Title"
                  value={blogForm.title}
                  onChange={(e) => setBlogForm({ ...blogForm, title: e.target.value })}
                  required
                />
                <input
                  placeholder="Slug (optional — derived from title if blank)"
                  value={blogForm.slug}
                  onChange={(e) => setBlogForm({ ...blogForm, slug: e.target.value })}
                />
                <input
                  placeholder="Short description (shown on the blog index and in search results)"
                  value={blogForm.description}
                  onChange={(e) => setBlogForm({ ...blogForm, description: e.target.value })}
                />
                <textarea
                  rows={8}
                  placeholder="Body — separate paragraphs with a blank line"
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
                  Published (visible on /blog)
                </label>
                <button type="submit" className="btn-primary" disabled={busy}>
                  Create post
                </button>
              </form>
            </section>
          )}

          {nav === "signups" && signups && (
            <>
              <section className="dash-card">
                <h2 className="dash-card-title">All signups ({signups.total})</h2>
                <p className="dash-muted">
                  Every account, including free signups that never pay. Chasa&apos;s magic-link
                  sign-in only collects an email address.
                </p>
                <button type="button" className="btn-secondary" onClick={() => setShowAllFree((v) => !v)}>
                  {showAllFree ? "Show less" : "Show all"}
                </button>
                <div className="dash-signup-cols">
                  <div>
                    <h3>Free ({signups.free.length})</h3>
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
                    <h3>Paid ({signups.paid.length})</h3>
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
                <h2 className="dash-card-title">Enterprise accounts</h2>
                <p className="dash-muted">
                  Self-serve customers checkout via Stripe (Solo / Pro / Enterprise). For bank
                  transfers or offline deals, grant Enterprise manually here once payment is
                  confirmed.
                </p>
                <form className="dash-ent-form" onSubmit={grantEnterprise}>
                  <input
                    type="email"
                    placeholder="customer@example.com"
                    value={entEmail}
                    onChange={(e) => setEntEmail(e.target.value)}
                    required
                  />
                  <button type="submit" className="btn-primary" disabled={busy}>
                    Grant Enterprise
                  </button>
                </form>
                {signups.enterprise.length === 0 ? (
                  <p className="dash-muted">No enterprise accounts yet.</p>
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
            <FunnelTable title="Activation funnel" steps={stats.activation} kpi="chase_sent" />
          )}
          {stats && nav === "completion" && (
            <FunnelTable title="Completion funnel" steps={stats.completion} kpi="chase_completed" />
          )}
          {stats && nav === "template" && (
            <FunnelTable title="Template funnel" steps={stats.template} kpi="template_completed" />
          )}
          {stats && nav === "traffic" && (
            <FunnelTable
              title="Traffic events"
              steps={stats.traffic}
              kpi="landingpage_cta_clicked"
            />
          )}
          {stats && nav === "email" && (
            <FunnelTable title="Email funnel" steps={stats.email} kpi="email_clicked" />
          )}
          {stats && nav === "errors" && <FunnelTable title="Error events" steps={stats.errors} />}
        </main>
      </div>
    </div>
  );
}
