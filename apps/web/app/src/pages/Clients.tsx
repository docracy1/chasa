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

function riskLabel(score: number | null | undefined): { text: string; className: string } | null {
  if (score == null) return null;
  if (score >= 70) return { text: "High risk", className: "client-risk high" };
  if (score >= 40) return { text: "Medium risk", className: "client-risk medium" };
  return { text: "Low risk", className: "client-risk low" };
}

export default function ClientsPage({ account }: { account: Account | null }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get("id");
  const isPaid = account?.plan !== "free" && account?.plan != null;
  const isPro = account?.plan === "pro" || account?.plan === "enterprise";

  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [detail, setDetail] = useState<ClientRecord | null>(null);
  const [invoices, setInvoices] = useState<AgingInvoiceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [createName, setCreateName] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createNotes, setCreateNotes] = useState("");
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
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load clients"))
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
        setContactNote(res.client.lastContactNote ?? "");
        setDraft(null);
        try {
          const stats = await trackingStats(res.invoices.map((i) => i.id));
          setOpenStats(stats.stats);
        } catch {
          setOpenStats({});
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load client"))
      .finally(() => setBusy(false));
  }, [selectedId, isPaid]);

  const outstandingLabel = useMemo(() => {
    if (!detail) return "";
    if (detail.outstandingCount === 0) return "No linked overdue invoices";
    return `${detail.outstandingCount} open · $${detail.outstandingTotal.toFixed(2)}`;
  }, [detail]);

  if (!account) {
    return (
      <div className="panel">
        <h1>Clients</h1>
        <p className="page-sub">Sign in on Solo or higher to manage clients and chase notes.</p>
        <a className="btn-primary" href="/app/login">
          Sign in
        </a>
      </div>
    );
  }

  if (!isPaid) {
    return (
      <div className="panel">
        <h1>Clients</h1>
        <p className="page-sub">
          Client management (contacts, notes, promised-to-pay) is included on Solo and up. Aging from
          CSV still works for free in the Tool.
        </p>
        <div className="upgrade-nudge">
          <Link to="/account">Upgrade to Solo</Link> to unlock saved clients.
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
      });
      track("client_created");
      await refreshList();
      setSearchParams({ id: created.id });
      setCreateName("");
      setCreateEmail("");
      setCreateNotes("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create client");
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
      });
      setDetail(updated);
      await refreshList();
      track("client_updated");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save client");
    } finally {
      setBusy(false);
    }
  }

  async function handlePromised() {
    if (!detail) return;
    setBusy(true);
    setError(null);
    try {
      const note = contactNote.trim() || "Promised to pay";
      const updated = await updateClient(detail.id, { lastContactNote: note });
      setDetail(updated);
      setContactNote(updated.lastContactNote ?? note);
      await refreshList();
      track("client_contact_note");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save note");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!detail) return;
    if (!confirm(`Delete client “${detail.name}”? Aging rows stay but unlink.`)) return;
    setBusy(true);
    try {
      await deleteClient(detail.id);
      track("client_deleted");
      setSearchParams({});
      setDetail(null);
      await refreshList();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete");
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
      setError(err instanceof Error ? err.message : "Could not draft chase");
    } finally {
      setDraftBusy(false);
    }
  }

  return (
    <div className="clients-page">
      <p className="crumb">
        <Link to="/">Tool</Link> / Clients
      </p>
      <h1>Clients</h1>
      <p className="page-sub">
        Contacts for chase drafts — notes, promised-to-pay, and linked overdue invoices from your
        aging board. Draft only; Chasa never emails clients.
      </p>

      {!isPaid && (
        <div className="usage-bar">
          {usedCount}/{FREE_LIMIT} free drafts used this month
        </div>
      )}

      {error && <div className="error-msg">{error}</div>}
      {loading && <p className="page-sub">Loading…</p>}
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
                  setError(err instanceof Error ? err.message : "Google import failed");
                } finally {
                  setImportingGoogle(false);
                }
              }}
            >
              {importingGoogle ? "Importing…" : "Import from Google"}
            </button>
          ) : (
            <span className="branding-help">
              To import Google contacts,{" "}
              <Link to="/connector">connect Google Drive first</Link>.
            </span>
          )}
          {importGoogleResult && (
            <span className="branding-help">
              Imported {importGoogleResult.imported}
              {importGoogleResult.skipped > 0
                ? `, ${importGoogleResult.skipped} skipped`
                : ""}
              .
            </span>
          )}
        </div>
      )}

      <div className="clients-layout">
        <section className="branding-card">
          <h2>All clients</h2>
          {clients.length === 0 ? (
            <p className="branding-help">No clients yet. Add one, or sync aging from the Tool (CSV).</p>
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
                        ? `$${c.outstandingTotal.toFixed(2)} open`
                        : "No open invoices"}
                    </span>
                    {isPro && c.riskScore != null && (
                      <span className={riskLabel(c.riskScore)?.className}>
                        {riskLabel(c.riskScore)?.text}
                        {c.avgDaysLate != null ? ` · avg ${Math.round(c.avgDaysLate)}d late` : ""}
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

          <h2 style={{ marginTop: 20 }}>Add client</h2>
          <form className="clients-form" onSubmit={handleCreate}>
            <input
              type="text"
              placeholder="Name"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              required
              maxLength={120}
              disabled={busy}
            />
            <input
              type="email"
              placeholder="Email (optional)"
              value={createEmail}
              onChange={(e) => setCreateEmail(e.target.value)}
              disabled={busy}
            />
            <textarea
              rows={2}
              placeholder="Notes (optional)"
              value={createNotes}
              onChange={(e) => setCreateNotes(e.target.value)}
              disabled={busy}
            />
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? "Saving…" : "Add client"}
            </button>
          </form>
        </section>

        <section className="branding-card">
          {detail ? (
            <>
              <h2>{detail.name}</h2>
              <p className="branding-help">{outstandingLabel}</p>
              {isPro && detail.riskScore != null && (
                <p className={`client-risk-detail ${riskLabel(detail.riskScore)?.className ?? ""}`}>
                  Payment risk: {detail.riskScore}/100
                  {detail.avgDaysLate != null ? ` · pays ~${Math.round(detail.avgDaysLate)} days late on average` : ""}
                  {detail.paidInvoiceCount != null && detail.paidInvoiceCount > 0
                    ? ` · ${detail.paidInvoiceCount} paid, ${detail.lateInvoiceCount ?? 0} late`
                    : ""}
                </p>
              )}
              {isPro && detail.riskScore == null && (
                <p className="branding-help">Risk score updates when you mark invoices paid.</p>
              )}
              <form className="clients-form" onSubmit={handleSave}>
                <label>
                  Name
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
                  Email
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={busy}
                  />
                </label>
                <label>
                  Notes
                  <textarea
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    disabled={busy}
                  />
                </label>
                <div className="draft-actions">
                  <button type="submit" className="btn-primary" disabled={busy}>
                    Save
                  </button>
                  <button type="button" className="btn-secondary" disabled={busy} onClick={handleDelete}>
                    Delete
                  </button>
                </div>
              </form>

              <h3 className="clients-subhead">Last contact / promised to pay</h3>
              <div className="clients-form">
                <input
                  type="text"
                  placeholder='e.g. "Promised to pay Friday"'
                  value={contactNote}
                  onChange={(e) => setContactNote(e.target.value)}
                  disabled={busy}
                  maxLength={500}
                />
                <button type="button" className="btn-secondary" disabled={busy} onClick={handlePromised}>
                  Save contact note
                </button>
                {detail.lastContactAt && (
                  <p className="branding-help">
                    Last note {formatUsDateTime(detail.lastContactAt)}
                  </p>
                )}
              </div>

              <h3 className="clients-subhead">Related overdue</h3>
              {invoices.length === 0 ? (
                <p className="branding-help">
                  No linked aging rows. Upload a CSV in the <Link to="/">Tool</Link> — paid accounts
                  sync clients automatically.
                </p>
              ) : (
                <>
                <table className="aging-table">
                  <thead>
                    <tr>
                      <th>Amount</th>
                      <th>Due</th>
                      <th>Days</th>
                      <th>Last chase</th>
                      <th>Opens</th>
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
                                  ? ` · ${openStats[inv.id].clickCount} clicks`
                                  : ""
                              }`
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="branding-help" style={{ marginTop: 8 }}>
                  Opens only count when you used Copy tracked HTML (image pixel). Plain mailto does
                  not track.
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
                    {draftBusy ? "Writing…" : "Draft chase email"}
                  </button>
                  <Link className="btn-secondary" to="/">
                    Open in Tool
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
                      Copy
                    </button>
                    <a
                      className="btn-secondary"
                      href={`mailto:${encodeURIComponent(detail.email || "")}?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.body)}`}
                      onClick={() => track("chase_sent", { method: "mailto", source: "clients" })}
                    >
                      Open in email client
                    </a>
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="branding-help">Select a client to edit notes, mark promised-to-pay, or draft a chase.</p>
          )}
        </section>
      </div>
    </div>
  );
}
