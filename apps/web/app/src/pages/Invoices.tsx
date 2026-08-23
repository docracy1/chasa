import { useEffect, useMemo, useState } from "react";
import {
  createInvoice,
  deleteInvoice,
  listInvoices,
  setInvoiceStatus,
  type Account,
  type InvoiceLineItem,
  type InvoiceRecord,
} from "../lib/api";
import { formatUsDateTime } from "../lib/locale";
import { useT } from "../lib/i18n";

const EMPTY_ITEM: InvoiceLineItem = { description: "", quantity: 1, unitPrice: 0 };

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function inTwoWeeksIso(): string {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return d.toISOString().slice(0, 10);
}

export default function InvoicesPage({ account }: { account: Account | null }) {
  const t = useT();
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [lastCreated, setLastCreated] = useState<{ publicId: string } | null>(null);

  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [issueDate, setIssueDate] = useState(todayIso());
  const [dueDate, setDueDate] = useState(inTwoWeeksIso());
  const [currency, setCurrency] = useState("USD");
  const [taxRate, setTaxRate] = useState(0);
  const [notes, setNotes] = useState("");
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([{ ...EMPTY_ITEM }]);

  const appOrigin = typeof window !== "undefined" ? window.location.origin : "";

  const totals = useMemo(() => {
    const subtotal = lineItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const taxAmount = subtotal * (taxRate / 100);
    return { subtotal, taxAmount, total: subtotal + taxAmount };
  }, [lineItems, taxRate]);

  async function refresh() {
    setLoading(true);
    try {
      const res = await listInvoices();
      setInvoices(res.invoices);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("invoices.loadFailed"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (account) refresh();
    else setLoading(false);
  }, [account?.email]);

  function updateItem(index: number, patch: Partial<InvoiceLineItem>) {
    setLineItems((items) => items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function removeItem(index: number) {
    setLineItems((items) => (items.length > 1 ? items.filter((_, i) => i !== index) : items));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLastCreated(null);
    const items = lineItems.filter((item) => item.description.trim().length > 0);
    if (!clientName.trim() || items.length === 0) {
      setError(t("invoices.validationFailed"));
      return;
    }
    setCreating(true);
    try {
      const res = await createInvoice({
        clientName: clientName.trim(),
        clientEmail: clientEmail.trim() || undefined,
        issueDate,
        dueDate,
        currency,
        lineItems: items,
        taxRate,
        notes: notes.trim() || undefined,
      });
      setLastCreated({ publicId: res.invoice.publicId });
      setClientName("");
      setClientEmail("");
      setNotes("");
      setLineItems([{ ...EMPTY_ITEM }]);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("invoices.createFailed"));
    } finally {
      setCreating(false);
    }
  }

  async function handleCopy(publicId: string) {
    try {
      await navigator.clipboard.writeText(`${appOrigin}/invoice/${publicId}`);
      setCopiedId(publicId);
      setTimeout(() => setCopiedId((id) => (id === publicId ? null : id)), 2000);
    } catch {
      /* clipboard unavailable — ignore */
    }
  }

  async function handleStatus(id: string, status: "draft" | "sent" | "paid") {
    setError(null);
    try {
      await setInvoiceStatus(id, status);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("invoices.updateFailed"));
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm(t("invoices.deleteConfirm"))) return;
    setError(null);
    try {
      await deleteInvoice(id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("invoices.deleteFailed"));
    }
  }

  if (!account) {
    return (
      <div className="panel">
        <h1>{t("invoices.title")}</h1>
        <p className="page-sub">{t("invoices.signInSub")}</p>
        <a className="btn-primary" href="/app/login">
          {t("nav.signin")}
        </a>
      </div>
    );
  }

  return (
    <div className="webhooks-page">
      <section className="branding-card">
        <h1 className="webhooks-title">{t("invoices.title")}</h1>
        <p className="branding-help">{t("invoices.pageSub")}</p>

        <form onSubmit={handleCreate} style={{ marginTop: 16 }}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <label style={{ flex: "1 1 220px" }}>
              {t("invoices.clientName")}
              <input value={clientName} onChange={(e) => setClientName(e.target.value)} required />
            </label>
            <label style={{ flex: "1 1 220px" }}>
              {t("invoices.clientEmail")}
              <input type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} />
            </label>
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
            <label>
              {t("invoices.issueDate")}
              <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} required />
            </label>
            <label>
              {t("invoices.dueDate")}
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
            </label>
            <label>
              {t("invoices.currency")}
              <input value={currency} maxLength={3} onChange={(e) => setCurrency(e.target.value.toUpperCase())} style={{ width: 70 }} />
            </label>
            <label>
              {t("invoices.taxRate")}
              <input
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={taxRate}
                onChange={(e) => setTaxRate(Number(e.target.value))}
                style={{ width: 90 }}
              />
            </label>
          </div>

          <div style={{ marginTop: 16 }}>
            {lineItems.map((item, i) => (
              <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-end", marginBottom: 8, flexWrap: "wrap" }}>
                <label style={{ flex: "1 1 240px" }}>
                  {i === 0 ? t("invoices.itemDescription") : ""}
                  <input
                    value={item.description}
                    onChange={(e) => updateItem(i, { description: e.target.value })}
                    placeholder={t("invoices.itemDescriptionPlaceholder")}
                  />
                </label>
                <label style={{ width: 80 }}>
                  {i === 0 ? t("invoices.itemQty") : ""}
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={item.quantity}
                    onChange={(e) => updateItem(i, { quantity: Number(e.target.value) })}
                  />
                </label>
                <label style={{ width: 110 }}>
                  {i === 0 ? t("invoices.itemPrice") : ""}
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={item.unitPrice}
                    onChange={(e) => updateItem(i, { unitPrice: Number(e.target.value) })}
                  />
                </label>
                <button type="button" className="btn-secondary" onClick={() => removeItem(i)}>
                  {t("invoices.removeItem")}
                </button>
              </div>
            ))}
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setLineItems((items) => [...items, { ...EMPTY_ITEM }])}
            >
              {t("invoices.addItem")}
            </button>
          </div>

          <label style={{ display: "block", marginTop: 12 }}>
            {t("invoices.notes")}
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} style={{ width: "100%" }} />
          </label>

          <div className="page-sub" style={{ marginTop: 12 }}>
            {t("invoices.totalPreview", {
              total: totals.total.toFixed(2),
              currency,
            })}
          </div>

          {error && <div className="error-msg">{error}</div>}

          <button type="submit" className="btn-primary" disabled={creating} style={{ marginTop: 12 }}>
            {creating ? t("invoices.creating") : t("invoices.create")}
          </button>
        </form>

        {lastCreated && (
          <div className="branding-card" style={{ marginTop: 16 }}>
            <h2>{t("invoices.created")}</h2>
            <p>{t("invoices.shareLink")}</p>
            <code>{`${appOrigin}/invoice/${lastCreated.publicId}`}</code>
            <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
              <button type="button" className="btn-secondary" onClick={() => handleCopy(lastCreated.publicId)}>
                {copiedId === lastCreated.publicId ? t("invoices.copied") : t("invoices.copyLink")}
              </button>
              <a className="btn-secondary" href={`/invoice/${lastCreated.publicId}`} target="_blank" rel="noopener noreferrer">
                {t("invoices.viewInvoice")}
              </a>
            </div>
          </div>
        )}

        {loading ? (
          <p className="page-sub">{t("common.loading")}</p>
        ) : invoices.length === 0 ? (
          <p className="webhooks-empty">{t("invoices.empty")}</p>
        ) : (
          <ul className="webhooks-list">
            {invoices.map((inv) => (
              <li key={inv.id}>
                <div>
                  <code>{inv.invoiceNumber}</code> — {inv.clientName}
                  <div className="page-sub">
                    {formatUsDateTime(inv.createdAt)} · {inv.currency} {inv.total.toFixed(2)} ·{" "}
                    {inv.status === "paid"
                      ? t("invoices.statusPaid")
                      : inv.status === "sent"
                      ? t("invoices.statusSent")
                      : t("invoices.statusDraft")}
                    {inv.certificatePublicId && <> · {t("invoices.certified")}</>}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button type="button" className="btn-secondary" onClick={() => handleCopy(inv.publicId)}>
                    {copiedId === inv.publicId ? t("invoices.copied") : t("invoices.copyLink")}
                  </button>
                  {inv.certificatePublicId && (
                    <a
                      className="btn-secondary"
                      href={`/verify/${inv.certificatePublicId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {t("invoices.viewCertificate")}
                    </a>
                  )}
                  {inv.status === "draft" && (
                    <button type="button" className="btn-secondary" onClick={() => handleStatus(inv.id, "sent")}>
                      {t("invoices.markSent")}
                    </button>
                  )}
                  {inv.status === "sent" && (
                    <button type="button" className="btn-secondary" onClick={() => handleStatus(inv.id, "paid")}>
                      {t("invoices.markPaid")}
                    </button>
                  )}
                  {!inv.certificatePublicId && (
                    <button type="button" className="btn-secondary" onClick={() => handleDelete(inv.id)}>
                      {t("invoices.delete")}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
