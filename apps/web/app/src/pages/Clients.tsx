import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  createClient,
  deleteClient,
  generateEmail,
  getClient,
  importGoogleContacts,
  listClients,
  listCloudConnectors,
  trackingStats,
  updateClient,
  type Account,
  type AgingInvoiceRecord,
  type ClientRecord,
} from "../lib/api";
import { track } from "../lib/analytics";
import { getUsedCount, incrementUsedCount, isAtLimit, FREE_LIMIT } from "../lib/usage";

import { daysOverdue } from "../lib/dates";
import { formatUsDateTime } from "../lib/locale";
import { useT } from "../lib/i18n";

function riskLabel(
  score: number | null | undefined,
  t: (key: string) => string
): { text: string; className: string } | null {
  if (score == null) return null;
  if (score >= 70) return { text: t("clients.highRisk"), className: "client-risk high" };
  if (score >= 40) return { text: t("clients.mediumRisk"), className: "client-risk medium" };
  return { text: t("clients.lowRisk"), className: "client-risk low" };
}

export default function ClientsPage({ account }: { account: Account | null }) {
  const t = useT();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get("id");
  const isPaid = account?.plan !== "free" && account?.plan != null;
  const isPro = account?.plan === "business";

  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [detail, setDetail] = useState<ClientRecord | null>(null);
  const [invoices, setInvoices] = useState<AgingInvoiceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [address, setAddress] = useState("");
  const [state, setState] = useState("");
  const [postal, setPostal] = useState("");
  const [country, setCountry] = useState("");
  const [vat, setVat] = useState("");
  const [createName, setCreateName] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createNotes, setCreateNotes] = useState("");
  const [createAddress, setCreateAddress] = useState("");
  const [createState, setCreateState] = useState("");
  const [createPostal, setCreatePostal] = useState("");
  const [createCountry, setCreateCountry] = useState("");
  const [createVat, setCreateVat] = useState("");
  const [contactNote, setContactNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [draftBusy, setDraftBusy] = useState(false);
  const [draft, setDraft] = useState<{ subject: string; body: string } | null>(null);
  const [usedCount, setUsedCount] = useState(getUsedCount());
  const [openStats, setOpenStats] = useState<
    Record<string, { openCount: number; clickCount: number; lastOpenAt: string | null }>
  >({});
  const [googleConnected, setGoogleConnected] = useState(false);
  const [importingGoogle, setImportingGoogle] = useState(false);
  const [importGoogleResult, setImportGoogleResult] = useState<{ imported: number; skipped: number } | null>(null);

  async function refreshList() {
    const res = await listClients();
    setClients(res.clients);
  }

  useEffect(() => {
    if (!account || !isPaid) return;
    setLoading(true);
    refreshList()
      .catch((err) => setError(err instanceof Error ? err.message : t("clients.loadFailed")))
      .finally(() => setLoading(false));
    listCloudConnectors()
      .then((res) => setGoogleConnected(res.connectors.some((c) => c.provider === "google" && c.connected)))
      .catch(() => setGoogleConnected(false));
  }, [account, isPaid]);

  useEffect(() => {
    if (!selectedId || !isPaid) {
      setDetail(null);
      setInvoices([]);
      return;
    }
    setBusy(true);
    getClient(selectedId)
      .then(async (res) => {
        setDetail(res.client);
        setInvoices(res.invoices);
        setName(res.client.name);
        setEmail(res.client.email ?? "");
        setNotes(res.client.notes ?? "");
        setAddress(res.client.address ?? "");
        setState(res.client.state ?? "");
        setPostal(res.client.postal ?? "");
        setCountry(res.client.country ?? "");
        setVat(res.client.vat ?? "");
        setContactNote(res.client.lastContactNote ?? "");
        setDraft(null);
        try {
          const stats = await trackingStats(res.invoices.map((i) => i.id));
          setOpenStats(stats.stats);
        } catch {
          setOpenStats({});
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : t("clients.loadClientFailed")))
      .finally(() => setBusy(false));
  }, [selectedId, isPaid]);

  const outstandingLabel = useMemo(() => {
    if (!detail) return "";
    if (detail.outstandingCount === 0) return t("clients.noLinkedOverdue");
    return t("clients.openTotal", {
      count: detail.outstandingCount,
      total: detail.outstandingTotal.toFixed(2),
    });
  }, [detail, t]);

  if (!account) {
    return (
      <div className="panel">
        <h1>{t("clients.title")}</h1>
        <p className="page-sub">{t("clients.signInSub")}</p>
        <a className="btn-primary" href="/app/login">
          {t("nav.signin")}
        </a>
      </div>
    );
  }

  if (!isPaid) {
    return (
      <div className="panel">
        <h1>{t("clients.title")}</h1>
        <p className="page-sub">{t("clients.upgradeSub")}</p>
        <div className="upgrade-nudge">
          <Link to="/account">{t("clients.upgradeToSolo")}</Link> {t("clients.upgradeHint")}
        </div>
      </div>
    );
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!createName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const created = await createClient({
        name: createName.trim(),
        email: createEmail.trim() || undefined,
        notes: createNotes.trim() || undefined,
        address: createAddress.trim() || undefined,
        state: createState.trim() || undefined,
        postal: createPostal.trim() || undefined,
        country: createCountry.trim() || undefined,
        vat: createVat.trim() || undefined,
      });
      track("client_created");
      await refreshList();
      setSearchParams({ id: created.id });
      setCreateName("");
      setCreateEmail("");
      setCreateNotes("");
      setCreateAddress("");
      setCreateState("");
      setCreatePostal("");
      setCreateCountry("");
      setCreateVat("");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("clients.createFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!detail) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await updateClient(detail.id, {
        name: name.trim(),
        email: email.trim(),
        notes: notes.trim(),
        address: address.trim(),
        state: state.trim(),
        postal: postal.trim(),
        country: country.trim(),
        vat: vat.trim(),
      });
      setDetail(updated);
      await refreshList();
      track("client_updated");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("clients.saveFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function handlePromised() {
    if (!detail) return;
    setBusy(true);
    setError(null);
    try {
      const note = contactNote.trim() || t("clients.promisedDefault");
      const updated = await updateClient(detail.id, { lastContactNote: note });
      setDetail(updated);
      setContactNote(updated.lastContactNote ?? note);
      await refreshList();
      track("client_contact_note");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("clients.noteFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!detail) return;
    if (!confirm(t("clients.deleteConfirm", { name: detail.name }))) return;
    setBusy(true);
    try {
      await deleteClient(detail.id);
      track("client_deleted");
      setSearchParams({});
      setDetail(null);
      await refreshList();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("clients.deleteFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function draftChase() {
    if (!detail || invoices.length === 0) return;
    if (!isPaid && isAtLimit()) return;
    setDraftBusy(true);
    setError(null);
    try {
      const result = await generateEmail({
        client_name: detail.name,
        invoice_amount: invoices.reduce((s, i) => s + i.amount, 0),
        days_overdue: Math.max(...invoices.map((i) => daysOverdue(i.dueDate))),
        payment_link: account?.paymentLink ?? undefined,
        invoices: invoices.map((i) => ({
          client_name: detail.name,
          invoice_amount: i.amount,
          days_overdue: daysOverdue(i.dueDate),
          due_date: i.dueDate,
        })),
      });
      if (!isPaid) setUsedCount(incrementUsedCount());
      setDraft(result);
      track("client_chase_drafted", { invoices: invoices.length });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("clients.draftFailed"));
    } finally {
      setDraftBusy(false);
    }
  }

  return (
    <div className="clients-page">
      <p className="crumb">
        <Link to="/">{t("clients.toolCrumb")}</Link> / {t("clients.title")}
      </p>
      <h1>{t("clients.title")}</h1>
      <p className="page-sub">{t("clients.pageSub")}</p>

      {!isPaid && (
        <div className="usage-bar">
          {t("usage.bar", { used: usedCount, limit: FREE_LIMIT })}
        </div>
      )}

      {error && <div className="error-msg">{error}</div>}
      {loading && <p className="page-sub">{t("common.loading")}</p>}
      {isPaid && (
        <div style={{ marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {googleConnected ? (
            <button
              type="button"
              className="btn-secondary"
              disabled={importingGoogle}
              onClick={async () => {
                setImportingGoogle(true);
                setImportGoogleResult(null);
                setError(null);
                try {
                  const result = await importGoogleContacts();
                  setImportGoogleResult({ imported: result.imported, skipped: result.skipped });
                  await refreshList();
                } catch (err) {
                  setError(err instanceof Error ? err.message : t("clients.googleImportFailed"));
                } finally {
                  setImportingGoogle(false);
                }
              }}
            >
              {importingGoogle ? t("common.importing") : t("clients.importGoogle")}
            </button>
          ) : (
            <span className="branding-help">
              {t("clients.connectGooglePrefix")}{" "}
              <Link to="/connector">{t("clients.connectGoogle")}</Link>.
            </span>
          )}
          {importGoogleResult && (
            <span className="branding-help">
              {t("clients.importedCount", { count: importGoogleResult.imported })}
              {importGoogleResult.skipped > 0
                ? t("clients.importedSkipped", { skipped: importGoogleResult.skipped })
                : ""}
              .
            </span>
          )}
        </div>
      )}

      <div className="clients-layout">
        <section className="branding-card">
          <h2>{t("clients.all")}</h2>
          {clients.length === 0 ? (
            <p className="branding-help">{t("clients.empty")}</p>
          ) : (
            <ul className="clients-list">
              {clients.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className={selectedId === c.id ? "client-row active" : "client-row"}
                    onClick={() => setSearchParams({ id: c.id })}
                  >
                    <strong>{c.name}</strong>
                    <span>
                      {c.outstandingCount > 0
                        ? t("clients.openAmount", { amount: c.outstandingTotal.toFixed(2) })
                        : t("clients.noOpenInvoices")}
                    </span>
                    {isPro && c.riskScore != null && (
                      <span className={riskLabel(c.riskScore, t)?.className}>
                        {riskLabel(c.riskScore, t)?.text}
                        {c.avgDaysLate != null
                          ? t("clients.avgDaysLate", { days: Math.round(c.avgDaysLate) })
                          : ""}
                      </span>
                    )}
                    {c.lastContactNote && (
                      <em className="client-contact-preview">{c.lastContactNote}</em>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <h2 style={{ marginTop: 20 }}>{t("clients.add")}</h2>
          <form className="clients-form" onSubmit={handleCreate}>
            <input
              type="text"
              placeholder={t("clients.name")}
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              required
              maxLength={120}
              disabled={busy}
            />
            <input
              type="email"
              placeholder={t("clients.email")}
              value={createEmail}
              onChange={(e) => setCreateEmail(e.target.value)}
              disabled={busy}
            />
            <input
              type="text"
              placeholder={t("clients.address")}
              value={createAddress}
              onChange={(e) => setCreateAddress(e.target.value)}
              disabled={busy}
            />
            <input
              type="text"
              placeholder={t("clients.postal")}
              value={createPostal}
              onChange={(e) => setCreatePostal(e.target.value)}
              disabled={busy}
            />
            <input
              type="text"
              placeholder={t("clients.state")}
              value={createState}
              onChange={(e) => setCreateState(e.target.value)}
              disabled={busy}
            />
            <input
              type="text"
              placeholder={t("clients.country")}
              value={createCountry}
              onChange={(e) => setCreateCountry(e.target.value)}
              disabled={busy}
            />
            <input
              type="text"
              placeholder={t("clients.vat")}
              value={createVat}
              onChange={(e) => setCreateVat(e.target.value)}
              disabled={busy}
            />
            <textarea
              rows={2}
              placeholder={t("clients.notes")}
              value={createNotes}
              onChange={(e) => setCreateNotes(e.target.value)}
              disabled={busy}
            />
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? t("common.saving") : t("clients.add")}
            </button>
          </form>
        </section>

        <section className="branding-card">
          {detail ? (
            <>
              <h2>{detail.name}</h2>
              <p className="branding-help">{outstandingLabel}</p>
              {isPro && detail.riskScore != null && (
                <p className={`client-risk-detail ${riskLabel(detail.riskScore, t)?.className ?? ""}`}>
                  {t("clients.paymentRisk", { score: detail.riskScore })}
                  {detail.avgDaysLate != null
                    ? t("clients.paysLate", { days: Math.round(detail.avgDaysLate) })
                    : ""}
                  {detail.paidInvoiceCount != null && detail.paidInvoiceCount > 0
                    ? t("clients.paidLateCount", {
                        paid: detail.paidInvoiceCount,
                        late: detail.lateInvoiceCount ?? 0,
                      })
                    : ""}
                </p>
              )}
              {isPro && detail.riskScore == null && (
                <p className="branding-help">{t("clients.riskScoreHint")}</p>
              )}
              {isPaid && !isPro && (
                <p className="branding-help">
                  <Link to="/account">{t("clients.unlockRisk")}</Link>
                </p>
              )}
              <form className="clients-form" onSubmit={handleSave}>
                <label>
                  {t("clients.name")}
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    maxLength={120}
                    disabled={busy}
                  />
                </label>
                <label>
                  {t("clients.emailField")}
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={busy}
                  />
                </label>
                <label>
                  {t("clients.address")}
                  <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} disabled={busy} />
                </label>
                <label>
                  {t("clients.postal")}
                  <input type="text" value={postal} onChange={(e) => setPostal(e.target.value)} disabled={busy} />
                </label>
                <label>
                  {t("clients.state")}
                  <input type="text" value={state} onChange={(e) => setState(e.target.value)} disabled={busy} />
                </label>
                <label>
                  {t("clients.country")}
                  <input type="text" value={country} onChange={(e) => setCountry(e.target.value)} disabled={busy} />
                </label>
                <label>
                  {t("clients.vat")}
                  <input type="text" value={vat} onChange={(e) => setVat(e.target.value)} disabled={busy} />
                </label>
                <label>
                  {t("clients.notesField")}
                  <textarea
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    disabled={busy}
                  />
                </label>
                <div className="draft-actions">
                  <button type="submit" className="btn-primary" disabled={busy}>
                    {t("common.save")}
                  </button>
                  <button type="button" className="btn-secondary" disabled={busy} onClick={handleDelete}>
                    {t("common.delete")}
                  </button>
                </div>
              </form>

              <h3 className="clients-subhead">{t("clients.contactNoteTitle")}</h3>
              <div className="clients-form">
                <input
                  type="text"
                  placeholder={t("clients.contactNotePlaceholder")}
                  value={contactNote}
                  onChange={(e) => setContactNote(e.target.value)}
                  disabled={busy}
                  maxLength={500}
                />
                <button type="button" className="btn-secondary" disabled={busy} onClick={handlePromised}>
                  {t("clients.saveContactNote")}
                </button>
                {detail.lastContactAt && (
                  <p className="branding-help">
                    {t("clients.lastNote", { date: formatUsDateTime(detail.lastContactAt) })}
                  </p>
                )}
              </div>

              <h3 className="clients-subhead">{t("clients.relatedOverdue")}</h3>
              {invoices.length === 0 ? (
                <p className="branding-help">
                  {t("clients.noLinkedBeforeTool")}{" "}
                  <Link to="/">{t("clients.toolCrumb")}</Link> {t("clients.noLinkedAfterTool")}
                </p>
              ) : (
                <>
                <table className="aging-table">
                  <thead>
                    <tr>
                      <th>{t("aging.amount")}</th>
                      <th>{t("invoice.dueLabel")}</th>
                      <th>{t("aging.days")}</th>
                      <th>{t("aging.lastChase")}</th>
                      <th>{t("clients.opensCol")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv) => (
                      <tr key={inv.id}>
                        <td>${inv.amount.toFixed(2)}</td>
                        <td>{inv.dueDate}</td>
                        <td>{daysOverdue(inv.dueDate)}</td>
                        <td>{inv.lastChaseStatus || "—"}</td>
                        <td>
                          {openStats[inv.id]
                            ? `${openStats[inv.id].openCount}${
                                openStats[inv.id].clickCount
                                  ? t("clients.clicksInCell", {
                                      count: openStats[inv.id].clickCount,
                                    })
                                  : ""
                              }`
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="branding-help" style={{ marginTop: 8 }}>
                  {t("clients.trackingHint")}
                </p>
                </>
              )}

              {invoices.length > 0 && (
                <div className="draft-actions" style={{ marginTop: 12 }}>
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={draftBusy}
                    onClick={() => void draftChase()}
                  >
                    {draftBusy ? t("common.writing") : t("clients.draftChase")}
                  </button>
                  <Link className="btn-secondary" to="/">
                    {t("clients.openTool")}
                  </Link>
                </div>
              )}

              {draft && (
                <div className="client-draft">
                  <input
                    type="text"
                    className="draft-subject"
                    value={draft.subject}
                    onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
                  />
                  <textarea
                    rows={8}
                    value={draft.body}
                    onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                  />
                  <div className="draft-actions">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => {
                        navigator.clipboard.writeText(
                          `Subject: ${draft.subject}\n\n${draft.body}`
                        );
                        track("chase_sent", { method: "copy", source: "clients" });
                      }}
                    >
                      {t("common.copy")}
                    </button>
                    <a
                      className="btn-secondary"
                      href={`mailto:${encodeURIComponent(detail.email || "")}?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.body)}`}
                      onClick={() => track("chase_sent", { method: "mailto", source: "clients" })}
                    >
                      {t("invoice.openMail")}
                    </a>
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="branding-help">{t("clients.selectHint")}</p>
          )}
        </section>
      </div>
    </div>
  );
}
