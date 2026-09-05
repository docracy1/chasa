import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  decideSoxApproval,
  createSoxApproval,
  createSoxAuditorPack,
  getSoxOverview,
  listAuditAnchors,
  listSoxApprovals,
  listSoxAuditEvents,
  listSoxAuditorPacks,
  soxAuditorPackHtmlUrl,
  soxAuditorPackOtsUrl,
  soxAuditorPackSha256Url,
  soxPeriodEvidenceUrl,
  updateSoxSettings,
  type Account,
  type AuditAnchorRecord,
  type SoxAuditorPack,
  type SoxAuditEvent,
  type SoxOverview,
  type SoxSendApproval,
} from "../lib/api";
import { isPaidPlan, isWorkspaceAdmin } from "../lib/plan";
import { useT } from "../lib/i18n";

type TabId = "overview" | "trail" | "sod" | "evidence" | "retention";

function statusClass(status: string): string {
  if (status === "ready") return "sox-pill sox-pill-ready";
  if (status === "partial") return "sox-pill sox-pill-partial";
  return "sox-pill sox-pill-missing";
}

function defaultFromDate(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 30);
  return d.toISOString().slice(0, 10);
}

function defaultToDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function SoxReportingPage({ account }: { account: Account | null }) {
  const t = useT();
  const [tab, setTab] = useState<TabId>("overview");
  const [overview, setOverview] = useState<SoxOverview | null>(null);
  const [events, setEvents] = useState<SoxAuditEvent[]>([]);
  const [anchors, setAnchors] = useState<AuditAnchorRecord[]>([]);
  const [approvals, setApprovals] = useState<SoxSendApproval[]>([]);
  const [packs, setPacks] = useState<SoxAuditorPack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [fromDate, setFromDate] = useState(defaultFromDate);
  const [toDate, setToDate] = useState(defaultToDate);
  const [sodRequired, setSodRequired] = useState(false);
  const [retentionDays, setRetentionDays] = useState(2555);
  const [reqInvoiceId, setReqInvoiceId] = useState("");
  const [reqClientName, setReqClientName] = useState("");
  const [reqSubject, setReqSubject] = useState("");

  const paid = isPaidPlan(account);
  const admin = isWorkspaceAdmin(account);

  const tabs = useMemo(
    () =>
      [
        { id: "overview" as const, label: t("sox.tabOverview") },
        { id: "trail" as const, label: t("sox.tabTrail") },
        { id: "sod" as const, label: t("sox.tabSod") },
        { id: "evidence" as const, label: t("sox.tabEvidence") },
        { id: "retention" as const, label: t("sox.tabRetention") },
      ] as const,
    [t]
  );

  async function load() {
    if (!account) return;
    setError(null);
    if (!paid) {
      setLoading(false);
      return;
    }
    try {
      const [ov, audit, anch, appr, packList] = await Promise.all([
        getSoxOverview(),
        listSoxAuditEvents(100),
        listAuditAnchors(),
        listSoxApprovals(),
        listSoxAuditorPacks(),
      ]);
      setOverview(ov.overview);
      setEvents(audit.events);
      setAnchors(anch.anchors);
      setApprovals(appr.approvals);
      setPacks(packList.packs);
      setSodRequired(ov.overview.settings.sodRequired);
      setRetentionDays(ov.overview.settings.retentionDays);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("sox.loadFailed"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!account) {
      setLoading(false);
      return;
    }
    load().catch(() => {});
  }, [account?.email, paid]);

  async function saveSettings() {
    if (!admin) return;
    setBusy(true);
    setError(null);
    try {
      const res = await updateSoxSettings({ sodRequired, retentionDays });
      setOverview((prev) => (prev ? { ...prev, settings: res.settings } : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("sox.saveFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function requestApproval() {
    if (!reqInvoiceId.trim() || !reqClientName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await createSoxApproval({
        agingInvoiceId: reqInvoiceId.trim(),
        clientName: reqClientName.trim(),
        subject: reqSubject.trim() || null,
      });
      setReqInvoiceId("");
      setReqClientName("");
      setReqSubject("");
      await load();
      setTab("sod");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("sox.requestFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function freezeAuditorPack() {
    setBusy(true);
    setError(null);
    try {
      await createSoxAuditorPack({ from: fromDate, to: toDate });
      await load();
      setTab("evidence");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("sox.packFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function decide(id: string, decision: "approved" | "rejected") {
    setBusy(true);
    setError(null);
    try {
      await decideSoxApproval(id, { decision });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("sox.decideFailed"));
    } finally {
      setBusy(false);
    }
  }

  if (!account) {
    return (
      <div className="panel">
        <h1>{t("sox.title")}</h1>
        <p className="page-sub">{t("sox.signInSub")}</p>
        <a className="btn-primary" href="/app/login">
          {t("nav.signin")}
        </a>
      </div>
    );
  }

  if (!paid) {
    return (
      <div className="webhooks-page sox-page">
        <section className="branding-card">
          <h1 className="webhooks-title">{t("sox.title")}</h1>
          <p className="branding-help">{t("sox.upgradeSub")}</p>
          <Link className="btn-primary" to="/account">
            {t("sox.upgradeCta")}
          </Link>
        </section>
      </div>
    );
  }

  return (
    <div className="webhooks-page sox-page">
      <section className="branding-card">
        <h1 className="webhooks-title">{t("sox.title")}</h1>
        <p className="branding-help">{t("sox.pageSub")}</p>

        <div className="sox-tabs" role="tablist" aria-label={t("sox.title")}>
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              className={`sox-tab${tab === item.id ? " is-active" : ""}`}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        {error && <div className="error-msg">{error}</div>}
        {loading ? <p className="page-sub">{t("common.loading")}</p> : null}

        {!loading && tab === "overview" && overview ? (
          <div className="sox-panel">
            <div className="sox-stats">
              <div className="sox-stat">
                <div className="sox-stat-value">{overview.pendingApprovals}</div>
                <div className="sox-stat-label">{t("sox.statPending")}</div>
              </div>
              <div className="sox-stat">
                <div className="sox-stat-value">{overview.recentAuditCount}</div>
                <div className="sox-stat-label">{t("sox.statAudit")}</div>
              </div>
              <div className="sox-stat">
                <div className="sox-stat-value">
                  {overview.confirmedAnchors}/{overview.anchorCount}
                </div>
                <div className="sox-stat-label">{t("sox.statAnchors")}</div>
              </div>
              <div className="sox-stat">
                <div className="sox-stat-value">{overview.certificateCount}</div>
                <div className="sox-stat-label">{t("sox.statCerts")}</div>
              </div>
            </div>

            <h2 className="sox-section-title">{t("sox.controlsTitle")}</h2>
            <ul className="sox-controls">
              {overview.controls.map((c) => (
                <li key={c.id}>
                  <div className="sox-control-head">
                    <strong>{c.title}</strong>
                    <span className={statusClass(c.status)}>{t(`sox.status.${c.status}`)}</span>
                  </div>
                  <p className="page-sub">{c.detail}</p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {!loading && tab === "trail" ? (
          <div className="sox-panel">
            <h2 className="sox-section-title">{t("sox.actorTrailTitle")}</h2>
            <p className="branding-help">{t("sox.actorTrailSub")}</p>
            {events.length === 0 ? (
              <p className="webhooks-empty">{t("sox.noAuditEvents")}</p>
            ) : (
              <ul className="webhooks-list sox-event-list">
                {events.map((ev) => (
                  <li key={ev.id}>
                    <div>
                      <code>{ev.action}</code>
                      <div className="page-sub">
                        {ev.actorEmail}
                        {ev.actorRole ? ` · ${ev.actorRole}` : ""} ·{" "}
                        {new Date(ev.createdAt).toLocaleString()}
                      </div>
                      <div>{ev.summary}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <h2 className="sox-section-title">{t("sox.anchorsTitle")}</h2>
            <p className="branding-help">{t("sox.anchorsSub")}</p>
            <p className="page-sub">
              <Link to="/audit-log">{t("sox.openAuditLog")}</Link>
            </p>
            {anchors.length === 0 ? (
              <p className="webhooks-empty">{t("auditLog.empty")}</p>
            ) : (
              <ul className="webhooks-list">
                {anchors.slice(0, 14).map((anchor) => (
                  <li key={anchor.id}>
                    <div>
                      <code>{anchor.periodDate}</code>
                      <div className="page-sub">
                        {t("auditLog.eventCount", { count: anchor.eventCount })} ·{" "}
                        {anchor.otsStatus === "confirmed"
                          ? t("auditLog.otsConfirmed")
                          : anchor.otsStatus === "pending"
                            ? t("auditLog.otsPending")
                            : t("auditLog.otsNone")}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}

        {!loading && tab === "sod" ? (
          <div className="sox-panel">
            <h2 className="sox-section-title">{t("sox.sodTitle")}</h2>
            <p className="branding-help">{t("sox.sodSub")}</p>
            {!overview?.settings.sodRequired ? (
              <p className="page-sub">{t("sox.sodDisabledHint")}</p>
            ) : null}
            <p className="page-sub">
              <Link to="/team">{t("sox.manageTeam")}</Link>
            </p>

            <h3 className="sox-section-title">{t("sox.requestApproval")}</h3>
            <p className="branding-help">{t("sox.requestApprovalSub")}</p>
            <div className="sox-period-form">
              <label>
                {t("sox.invoiceId")}
                <input
                  value={reqInvoiceId}
                  onChange={(e) => setReqInvoiceId(e.target.value)}
                  placeholder="aging invoice id"
                />
              </label>
              <label>
                {t("sox.clientName")}
                <input value={reqClientName} onChange={(e) => setReqClientName(e.target.value)} />
              </label>
              <label>
                {t("sox.subjectOptional")}
                <input value={reqSubject} onChange={(e) => setReqSubject(e.target.value)} />
              </label>
              <button
                type="button"
                className="btn-secondary"
                disabled={busy || !reqInvoiceId.trim() || !reqClientName.trim()}
                onClick={() => void requestApproval()}
              >
                {t("sox.submitRequest")}
              </button>
            </div>

            <h3 className="sox-section-title">{t("sox.pendingApprovals")}</h3>
            {approvals.filter((a) => a.status === "pending").length === 0 ? (
              <p className="webhooks-empty">{t("sox.noPending")}</p>
            ) : (
              <ul className="webhooks-list">
                {approvals
                  .filter((a) => a.status === "pending")
                  .map((a) => (
                    <li key={a.id}>
                      <div>
                        <strong>{a.clientName}</strong>
                        <div className="page-sub">
                          {t("sox.requestedBy", { email: a.requestedByEmail })} ·{" "}
                          {new Date(a.createdAt).toLocaleString()}
                        </div>
                        {a.subject ? <div>{a.subject}</div> : null}
                      </div>
                      {a.requestedByEmail !== account.email ? (
                        <div className="sox-actions">
                          <button
                            type="button"
                            className="btn-primary"
                            disabled={busy}
                            onClick={() => void decide(a.id, "approved")}
                          >
                            {t("sox.approve")}
                          </button>
                          <button
                            type="button"
                            className="btn-secondary"
                            disabled={busy}
                            onClick={() => void decide(a.id, "rejected")}
                          >
                            {t("sox.reject")}
                          </button>
                        </div>
                      ) : (
                        <span className="page-sub">{t("sox.awaitingChecker")}</span>
                      )}
                    </li>
                  ))}
              </ul>
            )}

            <h3 className="sox-section-title">{t("sox.recentApprovals")}</h3>
            <ul className="webhooks-list">
              {approvals
                .filter((a) => a.status !== "pending")
                .slice(0, 20)
                .map((a) => (
                  <li key={a.id}>
                    <div>
                      <strong>{a.clientName}</strong> · {a.status}
                      <div className="page-sub">
                        {a.requestedByEmail}
                        {a.decidedByEmail ? ` → ${a.decidedByEmail}` : ""}
                      </div>
                    </div>
                  </li>
                ))}
            </ul>
          </div>
        ) : null}

        {!loading && tab === "evidence" ? (
          <div className="sox-panel">
            <h2 className="sox-section-title">{t("sox.packTitle")}</h2>
            <p className="branding-help">{t("sox.packSub")}</p>
            <div className="sox-period-form">
              <label>
                {t("sox.from")}
                <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
              </label>
              <label>
                {t("sox.to")}
                <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
              </label>
              <button
                type="button"
                className="btn-primary"
                disabled={busy || !fromDate || !toDate}
                onClick={() => void freezeAuditorPack()}
              >
                {t("sox.freezePack")}
              </button>
              <a
                className="btn-secondary"
                href={soxPeriodEvidenceUrl(fromDate, toDate)}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t("sox.previewPeriod")}
              </a>
            </div>

            <h3 className="sox-section-title">{t("sox.frozenPacks")}</h3>
            {packs.length === 0 ? (
              <p className="webhooks-empty">{t("sox.noPacks")}</p>
            ) : (
              <ul className="webhooks-list">
                {packs.map((p) => (
                  <li key={p.id}>
                    <div>
                      <strong>
                        {p.fromDate} → {p.toDate}
                      </strong>
                      <div className="page-sub">
                        {t("sox.packMeta", {
                          invoices: p.invoiceCount,
                          events: p.eventCount,
                        })}{" "}
                        ·{" "}
                        {p.otsStatus === "confirmed"
                          ? t("sox.otsConfirmed")
                          : p.otsStatus === "pending"
                            ? t("sox.otsPending")
                            : p.otsStatus === "failed"
                              ? t("sox.otsFailed")
                              : t("sox.otsNone")}
                      </div>
                      <div className="page-sub">
                        SHA-256: <code>{p.contentSha256.slice(0, 20)}…</code>
                      </div>
                    </div>
                    <div className="sox-actions">
                      <a className="btn-secondary" href={soxAuditorPackHtmlUrl(p.id)}>
                        {t("sox.downloadHtml")}
                      </a>
                      <a className="btn-secondary" href={soxAuditorPackSha256Url(p.id)}>
                        .sha256
                      </a>
                      {(p.otsStatus === "pending" || p.otsStatus === "confirmed") && (
                        <a className="btn-secondary" href={soxAuditorPackOtsUrl(p.id)}>
                          {t("sox.downloadOts")}
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <p className="page-sub">
              <Link to="/certificates">{t("sox.openCertificates")}</Link>
              {" · "}
              <Link to="/audit-log">{t("sox.openAuditLog")}</Link>
            </p>
          </div>
        ) : null}

        {!loading && tab === "retention" ? (
          <div className="sox-panel">
            <h2 className="sox-section-title">{t("sox.retentionTitle")}</h2>
            <p className="branding-help">{t("sox.retentionSub")}</p>
            <label className="sox-check">
              <input
                type="checkbox"
                checked={sodRequired}
                disabled={!admin || busy}
                onChange={(e) => setSodRequired(e.target.checked)}
              />
              <span>{t("sox.enableSod")}</span>
            </label>
            <label className="sox-field">
              {t("sox.retentionDays")}
              <input
                type="number"
                min={90}
                max={3650}
                value={retentionDays}
                disabled={!admin || busy}
                onChange={(e) => setRetentionDays(Number(e.target.value) || 2555)}
              />
            </label>
            {admin ? (
              <button type="button" className="btn-primary" disabled={busy} onClick={() => void saveSettings()}>
                {t("sox.saveSettings")}
              </button>
            ) : (
              <p className="page-sub">{t("sox.adminOnly")}</p>
            )}
          </div>
        ) : null}
      </section>
    </div>
  );
}
