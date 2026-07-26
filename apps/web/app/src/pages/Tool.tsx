import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Papa from "papaparse";
import {
  CLOUD_IMPORT_STORAGE_KEY,
  generateEmail,
  generateReply,
  generateSequence,
  generateThankYou,
  importCloudConnectorFile,
  listCloudConnectorFiles,
  listCloudConnectors,
  markAgingChase,
  notifyWebhook,
  rewriteEmail,
  syncAging,
  type Account,
  type ChaseSequence,
  type CloudFile,
  type CloudFileImport,
  type CloudProvider,
  type RewriteAction,
} from "../lib/api";
import { getUsedCount, incrementUsedCount, isAtLimit, FREE_LIMIT } from "../lib/usage";
import { track } from "../lib/analytics";

type PendingCloudImport = CloudFileImport & {
  provider: CloudProvider;
  providerLabel: string;
};

const CLOUD_LABELS: Record<CloudProvider, string> = {
  dropbox: "Dropbox",
  onedrive: "OneDrive",
  box: "Box",
};

const TOOL_STORAGE_KEY = "chasa.tool.invoices";
const PAYMENT_LINK_STORAGE_KEY = "chasa.tool.paymentLink";

type AiBusy = RewriteAction | "thankyou" | "reply" | "sequence" | "multi" | null;

interface Invoice {
  id: string;
  clientName: string;
  amount: number;
  dueDate: string;
  draft?: { subject: string; body: string };
  generating: boolean;
  rewriting: AiBusy;
  clientReply?: string;
  sequence?: ChaseSequence | null;
  lastChaseStatus?: string | null;
  lastChaseAt?: string | null;
  error?: string;
}

type StoredInvoice = {
  id: string;
  clientName: string;
  amount: number;
  dueDate: string;
  lastChaseStatus?: string | null;
  lastChaseAt?: string | null;
};

function loadStoredInvoices(): Invoice[] {
  try {
    const raw = localStorage.getItem(TOOL_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredInvoice[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((r) => r?.clientName && Number.isFinite(r.amount) && r.dueDate)
      .map((r) => ({
        id: r.id || crypto.randomUUID(),
        clientName: r.clientName,
        amount: r.amount,
        dueDate: r.dueDate,
        lastChaseStatus: r.lastChaseStatus ?? null,
        lastChaseAt: r.lastChaseAt ?? null,
        generating: false,
        rewriting: null,
      }));
  } catch {
    return [];
  }
}

function persistInvoices(invoices: Invoice[]) {
  const slim: StoredInvoice[] = invoices.map((inv) => ({
    id: inv.id,
    clientName: inv.clientName,
    amount: inv.amount,
    dueDate: inv.dueDate,
    lastChaseStatus: inv.lastChaseStatus ?? null,
    lastChaseAt: inv.lastChaseAt ?? null,
  }));
  localStorage.setItem(TOOL_STORAGE_KEY, JSON.stringify(slim));
}

function daysOverdue(dueDate: string): number {
  const due = new Date(dueDate);
  const now = new Date();
  const ms = now.setHours(0, 0, 0, 0) - due.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)));
}

// Unified aliases for QBO / FreshBooks / Xero / Wave / Zoho / sevDesk (+ Chasa). Exact match after normalize.
const CLIENT_HEADERS = [
  "customer name", // Zoho Books/Invoice, Wave Connect
  "customer full name",
  "customer",
  "client name",
  "client",
  "contact name",
  "contact", // sevDesk Kontakt
  "kundenname",
  "kunde", // sevDesk
  "company name",
  "company",
  "name",
];
const AMOUNT_HEADERS = [
  "amount due", // Wave
  "amount due value",
  "open balance",
  "outstanding balance", // Zoho reports
  "balance due",
  "outstanding",
  "invoice amount",
  "invoice total",
  "total value", // Wave
  "sum gross", // sevDesk sumGross
  "offener betrag",
  "restbetrag",
  "brutto",
  "summe",
  "betrag", // sevDesk / DATEV-ish
  "balance",
  "amount",
  "total",
];
const DUE_DATE_HEADERS = [
  "due date",
  "duedate",
  "due_date",
  "payment due date",
  "invoice due date",
  "fälligkeitsdatum",
  "falligkeitsdatum",
  "fälligkeit",
  "faelligkeit", // sevDesk
];
const DAYS_HEADERS = [
  "days overdue",
  "days past due",
  "overdue days",
  "aging",
  "days_overdue",
  "tage überfällig",
  "tage uberfallig",
];

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

function findCol(headers: string[], candidates: string[]): number {
  const norm = headers.map(normalizeHeader);
  for (const c of candidates) {
    const i = norm.indexOf(c);
    if (i >= 0) return i;
  }
  return -1;
}

function looksLikeHeaderRow(row: string[]): boolean {
  const joined = row.map(normalizeHeader);
  return (
    CLIENT_HEADERS.some((h) => joined.includes(h)) ||
    AMOUNT_HEADERS.some((h) => joined.includes(h)) ||
    DUE_DATE_HEADERS.some((h) => joined.includes(h)) ||
    DAYS_HEADERS.some((h) => joined.includes(h))
  );
}

function parseAmount(raw: string): number {
  const cleaned = String(raw).replace(/[^0-9.-]/g, "");
  return Number(cleaned);
}

/** Convert days-overdue / aging into a due date (today minus N days). */
function dueDateFromDaysOverdue(days: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - Math.max(0, Math.round(days)));
  return d.toISOString().slice(0, 10);
}

function parseCsvRow(
  row: string[],
  cols: { client: number; amount: number; due: number; days: number } | null
): { clientName: string; amount: number; dueDate: string } | null {
  let name: string;
  let amtRaw: string;
  let dueRaw: string | undefined;
  let daysRaw: string | undefined;

  if (cols) {
    name = row[cols.client] ?? "";
    amtRaw = row[cols.amount] ?? "";
    dueRaw = cols.due >= 0 ? row[cols.due] : undefined;
    daysRaw = cols.days >= 0 ? row[cols.days] : undefined;
  } else {
    // Legacy Chasa positional: client, amount, due date
    [name, amtRaw, dueRaw] = row;
  }

  if (!name?.trim() || !amtRaw) return null;
  const parsedAmt = parseAmount(amtRaw);
  if (!Number.isFinite(parsedAmt)) return null;

  if (dueRaw?.trim()) {
    const parsedDate = new Date(dueRaw);
    if (!Number.isNaN(parsedDate.getTime())) {
      return {
        clientName: name.trim(),
        amount: parsedAmt,
        dueDate: parsedDate.toISOString().slice(0, 10),
      };
    }
  }

  if (daysRaw?.trim()) {
    const days = Number(String(daysRaw).replace(/[^0-9.-]/g, ""));
    if (Number.isFinite(days)) {
      return {
        clientName: name.trim(),
        amount: parsedAmt,
        dueDate: dueDateFromDaysOverdue(days),
      };
    }
  }

  return null;
}

function toneClass(days: number): "sage" | "amber" | "rust" {
  if (days <= 7) return "sage";
  if (days <= 30) return "amber";
  return "rust";
}

function toneLabel(days: number): string {
  if (days <= 7) return "Friendly";
  if (days <= 30) return "Professional";
  return "Direct";
}

function chaseTip(days: number): string {
  if (days === 0) return "Due today — a short friendly nudge with a pay link works best.";
  if (days <= 3) return "1–3 days late — assume an oversight; ask for a payment date, no blame.";
  if (days <= 7) return "About a week late — firm but respectful; confirm they received the invoice.";
  if (days <= 14) return "Two weeks late — offer a short payment plan if cash flow is the issue.";
  if (days <= 30) return "Approaching a month — formal tone; set a clear new deadline.";
  return "30+ days — direct consequence (pause work / next steps). Still factual, not angry.";
}

export default function Tool({ account }: { account: Account | null }) {
  const [invoices, setInvoices] = useState<Invoice[]>(() => loadStoredInvoices());
  const [clientName, setClientName] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [paymentLink, setPaymentLink] = useState(() => {
    try {
      return localStorage.getItem(PAYMENT_LINK_STORAGE_KEY) || account?.paymentLink || "";
    } catch {
      return account?.paymentLink || "";
    }
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [multiDraft, setMultiDraft] = useState<{ subject: string; body: string } | null>(null);
  const [multiBusy, setMultiBusy] = useState(false);
  const [multiError, setMultiError] = useState<string | null>(null);
  const [usedCount, setUsedCount] = useState(getUsedCount());
  const [pendingImport, setPendingImport] = useState<PendingCloudImport | null>(null);
  const [importClient, setImportClient] = useState("");
  const [importAmount, setImportAmount] = useState("");
  const [importDue, setImportDue] = useState("");
  const [showPdfPicker, setShowPdfPicker] = useState(false);
  const [pdfProviders, setPdfProviders] = useState<CloudProvider[]>([]);
  const [pdfProvider, setPdfProvider] = useState<CloudProvider | null>(null);
  const [pdfFiles, setPdfFiles] = useState<CloudFile[]>([]);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const isPaid = account?.plan !== "free" && account?.plan != null;
  const isPro = account?.plan === "pro" || account?.plan === "enterprise";

  useEffect(() => {
    persistInvoices(invoices);
  }, [invoices]);

  useEffect(() => {
    try {
      localStorage.setItem(PAYMENT_LINK_STORAGE_KEY, paymentLink);
    } catch {
      /* ignore */
    }
  }, [paymentLink]);

  useEffect(() => {
    if (account?.paymentLink && !paymentLink) {
      setPaymentLink(account.paymentLink);
    }
  }, [account?.paymentLink]);

  // Solo+: sync aging snapshot to D1 (also creates clients by name)
  const agingSnapshot = invoices
    .map(
      (inv) =>
        `${inv.id}|${inv.clientName}|${inv.amount}|${inv.dueDate}|${inv.lastChaseStatus ?? ""}|${inv.lastChaseAt ?? ""}`
    )
    .join(";");

  useEffect(() => {
    if (!isPaid || invoices.length === 0) return;
    const timer = window.setTimeout(() => {
      void syncAging(
        invoices.map((inv) => ({
          id: inv.id,
          clientName: inv.clientName,
          amount: inv.amount,
          dueDate: inv.dueDate,
          lastChaseStatus: inv.lastChaseStatus ?? null,
          lastChaseAt: inv.lastChaseAt ?? null,
        })),
        true
      ).catch(() => {});
    }, 800);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync only when aging fields change
  }, [isPaid, agingSnapshot]);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(CLOUD_IMPORT_STORAGE_KEY);
      if (!raw) return;
      sessionStorage.removeItem(CLOUD_IMPORT_STORAGE_KEY);
      const parsed = JSON.parse(raw) as PendingCloudImport;
      if (!parsed?.file?.name || !parsed?.hints) return;
      setPendingImport(parsed);
      setImportClient(parsed.hints.clientName ?? "");
      setImportAmount(
        parsed.hints.amount != null && Number.isFinite(parsed.hints.amount)
          ? String(parsed.hints.amount)
          : ""
      );
      // Default due date to today when the PDF/filename didn't yield one — form requires a date
      setImportDue(parsed.hints.dueDate ?? new Date().toISOString().slice(0, 10));
      track("fields_added", { source: "cloud_pdf_pending" });
    } catch {
      sessionStorage.removeItem(CLOUD_IMPORT_STORAGE_KEY);
    }
  }, []);

  function addInvoice(clientName: string, amount: number, dueDate: string) {
    setInvoices((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        clientName,
        amount,
        dueDate,
        generating: false,
        rewriting: null,
      },
    ]);
  }

  function handleAddManual(e: React.FormEvent) {
    e.preventDefault();
    const amt = Number(amount);
    if (!clientName.trim() || !Number.isFinite(amt) || !dueDate) {
      track("field_error", { source: "manual" });
      return;
    }
    addInvoice(clientName.trim(), amt, dueDate);
    track("fields_added", { source: "manual" });
    setClientName("");
    setAmount("");
    setDueDate("");
  }

  function confirmCloudImport(e: React.FormEvent) {
    e.preventDefault();
    const amt = Number(importAmount);
    if (!importClient.trim() || !Number.isFinite(amt) || !importDue) {
      track("field_error", { source: "cloud_pdf" });
      return;
    }
    addInvoice(importClient.trim(), amt, importDue);
    track("fields_added", { source: "cloud_pdf" });
    setPendingImport(null);
    setImportClient("");
    setImportAmount("");
    setImportDue("");
  }

  function dismissCloudImport() {
    setPendingImport(null);
    setImportClient("");
    setImportAmount("");
    setImportDue("");
  }

  async function openPdfPicker() {
    if (!isPaid) return;
    setShowPdfPicker(true);
    setPdfBusy(true);
    setPdfError(null);
    setPdfFiles([]);
    setPdfProvider(null);
    try {
      const res = await listCloudConnectors();
      const connected = res.connectors.filter((c) => c.connected).map((c) => c.provider);
      setPdfProviders(connected);
      if (connected.length === 1) {
        await loadPdfFiles(connected[0]);
      }
    } catch (err) {
      setPdfError(err instanceof Error ? err.message : "Could not load connectors");
    } finally {
      setPdfBusy(false);
    }
  }

  async function loadPdfFiles(provider: CloudProvider) {
    setPdfBusy(true);
    setPdfError(null);
    setPdfProvider(provider);
    try {
      const res = await listCloudConnectorFiles(provider);
      setPdfFiles(res.files);
    } catch (err) {
      setPdfFiles([]);
      setPdfError(err instanceof Error ? err.message : "Could not list PDFs");
    } finally {
      setPdfBusy(false);
    }
  }

  async function importPdfFromTool(file: CloudFile) {
    if (!pdfProvider || !isPaid) return;
    setPdfBusy(true);
    setPdfError(null);
    try {
      const result = await importCloudConnectorFile(pdfProvider, {
        id: file.id,
        path: file.path,
      });
      setPendingImport({
        ...result,
        provider: pdfProvider,
        providerLabel: CLOUD_LABELS[pdfProvider],
      });
      setImportClient(result.hints.clientName ?? "");
      setImportAmount(
        result.hints.amount != null && Number.isFinite(result.hints.amount)
          ? String(result.hints.amount)
          : ""
      );
      setImportDue(result.hints.dueDate ?? new Date().toISOString().slice(0, 10));
      setShowPdfPicker(false);
      track("fields_added", { source: "cloud_pdf_pending" });
    } catch (err) {
      setPdfError(err instanceof Error ? err.message : "Could not import PDF");
    } finally {
      setPdfBusy(false);
    }
  }

  function handleCsvUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    track("upload_started", { filename: file.name });
    Papa.parse<string[]>(file, {
      complete: (result) => {
        if (result.errors?.length) {
          track("upload_failed", { reason: "parse_error", errors: result.errors.length });
        }
        const rows = result.data.filter((r) => r.some((c) => String(c ?? "").trim()));
        if (rows.length === 0) {
          track("upload_failed", { reason: "no_valid_rows" });
          return;
        }

        let dataRows = rows;
        let cols: { client: number; amount: number; due: number; days: number } | null = null;

        if (looksLikeHeaderRow(rows[0])) {
          const headers = rows[0].map((h) => String(h ?? ""));
          const client = findCol(headers, CLIENT_HEADERS);
          const amount = findCol(headers, AMOUNT_HEADERS);
          const due = findCol(headers, DUE_DATE_HEADERS);
          const days = findCol(headers, DAYS_HEADERS);
          dataRows = rows.slice(1);
          if (client >= 0 && amount >= 0 && (due >= 0 || days >= 0)) {
            cols = { client, amount, due, days };
          }
        }

        let added = 0;
        for (const row of dataRows) {
          const parsed = parseCsvRow(row.map((c) => String(c ?? "")), cols);
          if (!parsed) continue;
          addInvoice(parsed.clientName, parsed.amount, parsed.dueDate);
          added += 1;
        }
        if (added > 0) {
          track("invoice_uploaded", { rows: added });
          track("fields_added", { source: "csv", rows: added });
        } else {
          track("upload_failed", { reason: "no_valid_rows" });
        }
      },
      error: () => {
        track("upload_failed", { reason: "file_error" });
      },
    });
    e.target.value = "";
  }

  async function handleGenerate(invoiceId: string) {
    if (!isPaid && isAtLimit()) return;

    setInvoices((prev) =>
      prev.map((inv) =>
        inv.id === invoiceId ? { ...inv, generating: true, error: undefined } : inv
      )
    );

    const invoice = invoices.find((inv) => inv.id === invoiceId);
    if (!invoice) return;

    try {
      const draft = await generateEmail({
        client_name: invoice.clientName,
        invoice_amount: invoice.amount,
        days_overdue: daysOverdue(invoice.dueDate),
        payment_link: paymentLink.trim() || undefined,
        invoices: [
          {
            client_name: invoice.clientName,
            invoice_amount: invoice.amount,
            days_overdue: daysOverdue(invoice.dueDate),
            due_date: invoice.dueDate,
          },
        ],
      });
      if (!isPaid) setUsedCount(incrementUsedCount());
      const now = new Date().toISOString();
      setInvoices((prev) =>
        prev.map((inv) =>
          inv.id === invoiceId
            ? {
                ...inv,
                draft,
                generating: false,
                lastChaseStatus: "drafted",
                lastChaseAt: now,
              }
            : inv
        )
      );
      if (isPaid) void markAgingChase(invoiceId, "drafted").catch(() => {});
      track("chase_drafted", { source: "single" });
    } catch (err) {
      track("send_failed", { source: "generate" });
      setInvoices((prev) =>
        prev.map((inv) =>
          inv.id === invoiceId
            ? {
                ...inv,
                generating: false,
                error: err instanceof Error ? err.message : "Something went wrong.",
              }
            : inv
        )
      );
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllOverdue() {
    setSelectedIds(new Set(invoices.map((inv) => inv.id)));
  }

  function clearSelection() {
    setSelectedIds(new Set());
    setMultiDraft(null);
    setMultiError(null);
  }

  async function handleMultiDraft() {
    const selected = invoices.filter((inv) => selectedIds.has(inv.id));
    if (selected.length < 2) {
      setMultiError("Select at least two invoices.");
      return;
    }
    if (!isPaid && isAtLimit()) return;

    setMultiBusy(true);
    setMultiError(null);
    try {
      const names = [...new Set(selected.map((s) => s.clientName))];
      const clientLabel =
        names.length === 1 ? names[0] : names.length <= 3 ? names.join(" / ") : "your team";
      const draft = await generateEmail({
        client_name: clientLabel,
        invoice_amount: selected.reduce((s, i) => s + i.amount, 0),
        days_overdue: Math.max(...selected.map((i) => daysOverdue(i.dueDate))),
        payment_link: paymentLink.trim() || undefined,
        invoices: selected.map((i) => ({
          client_name: i.clientName,
          invoice_amount: i.amount,
          days_overdue: daysOverdue(i.dueDate),
          due_date: i.dueDate,
        })),
      });
      if (!isPaid) setUsedCount(incrementUsedCount());
      const now = new Date().toISOString();
      setMultiDraft(draft);
      setInvoices((prev) =>
        prev.map((inv) =>
          selectedIds.has(inv.id)
            ? { ...inv, lastChaseStatus: "multi-drafted", lastChaseAt: now }
            : inv
        )
      );
      if (isPaid) {
        for (const id of selectedIds) {
          void markAgingChase(id, "multi-drafted").catch(() => {});
        }
      }
      track("chase_drafted", { source: "multi", count: selected.length });
    } catch (err) {
      track("send_failed", { source: "multi" });
      setMultiError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setMultiBusy(false);
    }
  }

  function scrollToInvoice(id: string) {
    const el = document.getElementById(`invoice-${id}`);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function handleRewrite(invoiceId: string, action: RewriteAction) {
    if (!isPaid) return;
    const invoice = invoices.find((inv) => inv.id === invoiceId);
    if (!invoice?.draft) return;

    setInvoices((prev) =>
      prev.map((inv) =>
        inv.id === invoiceId ? { ...inv, rewriting: action, error: undefined } : inv
      )
    );

    try {
      const draft = await rewriteEmail({
        subject: invoice.draft.subject,
        body: invoice.draft.body,
        action,
      });
      setInvoices((prev) =>
        prev.map((inv) =>
          inv.id === invoiceId ? { ...inv, draft, rewriting: null } : inv
        )
      );
    } catch (err) {
      track("send_failed", { source: "rewrite", action });
      setInvoices((prev) =>
        prev.map((inv) =>
          inv.id === invoiceId
            ? {
                ...inv,
                rewriting: null,
                error: err instanceof Error ? err.message : "Something went wrong.",
              }
            : inv
        )
      );
    }
  }

  async function handleThankYou(invoiceId: string) {
    if (!isPaid) return;
    const invoice = invoices.find((inv) => inv.id === invoiceId);
    if (!invoice) return;
    setInvoices((prev) =>
      prev.map((inv) =>
        inv.id === invoiceId ? { ...inv, rewriting: "thankyou", error: undefined } : inv
      )
    );
    try {
      const draft = await generateThankYou({
        client_name: invoice.clientName,
        invoice_amount: invoice.amount,
      });
      setInvoices((prev) =>
        prev.map((inv) =>
          inv.id === invoiceId ? { ...inv, draft, rewriting: null } : inv
        )
      );
    } catch (err) {
      track("send_failed", { source: "thankyou" });
      setInvoices((prev) =>
        prev.map((inv) =>
          inv.id === invoiceId
            ? {
                ...inv,
                rewriting: null,
                error: err instanceof Error ? err.message : "Something went wrong.",
              }
            : inv
        )
      );
    }
  }

  async function handleReply(invoiceId: string) {
    if (!isPaid) return;
    const invoice = invoices.find((inv) => inv.id === invoiceId);
    if (!invoice?.clientReply?.trim()) return;
    setInvoices((prev) =>
      prev.map((inv) =>
        inv.id === invoiceId ? { ...inv, rewriting: "reply", error: undefined } : inv
      )
    );
    try {
      const draft = await generateReply({
        client_name: invoice.clientName,
        invoice_amount: invoice.amount,
        days_overdue: daysOverdue(invoice.dueDate),
        client_message: invoice.clientReply.trim(),
      });
      setInvoices((prev) =>
        prev.map((inv) =>
          inv.id === invoiceId ? { ...inv, draft, rewriting: null } : inv
        )
      );
    } catch (err) {
      track("send_failed", { source: "reply" });
      setInvoices((prev) =>
        prev.map((inv) =>
          inv.id === invoiceId
            ? {
                ...inv,
                rewriting: null,
                error: err instanceof Error ? err.message : "Something went wrong.",
              }
            : inv
        )
      );
    }
  }

  async function handleSequence(invoiceId: string) {
    if (!isPro) return;
    const invoice = invoices.find((inv) => inv.id === invoiceId);
    if (!invoice) return;
    setInvoices((prev) =>
      prev.map((inv) =>
        inv.id === invoiceId ? { ...inv, rewriting: "sequence", error: undefined } : inv
      )
    );
    try {
      const sequence = await generateSequence({
        client_name: invoice.clientName,
        invoice_amount: invoice.amount,
        days_overdue: daysOverdue(invoice.dueDate),
      });
      const first = sequence.steps[0];
      setInvoices((prev) =>
        prev.map((inv) =>
          inv.id === invoiceId
            ? {
                ...inv,
                sequence,
                draft: first ? { subject: first.subject, body: first.body } : inv.draft,
                rewriting: null,
              }
            : inv
        )
      );
    } catch (err) {
      track("send_failed", { source: "sequence" });
      setInvoices((prev) =>
        prev.map((inv) =>
          inv.id === invoiceId
            ? {
                ...inv,
                rewriting: null,
                error: err instanceof Error ? err.message : "Something went wrong.",
              }
            : inv
        )
      );
    }
  }

  function applySequenceStep(invoiceId: string, stepIndex: number) {
    setInvoices((prev) =>
      prev.map((inv) => {
        if (inv.id !== invoiceId || !inv.sequence?.steps[stepIndex]) return inv;
        const step = inv.sequence.steps[stepIndex];
        return { ...inv, draft: { subject: step.subject, body: step.body } };
      })
    );
  }

  function updateDraft(invoiceId: string, field: "subject" | "body", value: string) {
    setInvoices((prev) =>
      prev.map((inv) =>
        inv.id === invoiceId ? { ...inv, draft: { ...inv.draft!, [field]: value } } : inv
      )
    );
  }

  function copyDraft(invoice: Invoice) {
    if (!invoice.draft) return;
    navigator.clipboard.writeText(`Subject: ${invoice.draft.subject}\n\n${invoice.draft.body}`);
    track("chase_sent", { method: "copy" });
    const now = new Date().toISOString();
    setInvoices((prev) =>
      prev.map((inv) =>
        inv.id === invoice.id
          ? { ...inv, lastChaseStatus: "copied", lastChaseAt: now }
          : inv
      )
    );
    if (isPaid) {
      void markAgingChase(invoice.id, "copied").catch(() => {});
      void notifyWebhook("chase.sent", {
        method: "copy",
        client_name: invoice.clientName,
        invoice_amount: invoice.amount,
      });
    }
  }

  function mailtoLink(invoice: Invoice): string {
    if (!invoice.draft) return "#";
    const subject = encodeURIComponent(invoice.draft.subject);
    const body = encodeURIComponent(invoice.draft.body);
    return `mailto:?subject=${subject}&body=${body}`;
  }

  function handleMailtoClick(invoice?: Invoice) {
    track("chase_sent", { method: "mailto" });
    if (invoice) {
      const now = new Date().toISOString();
      setInvoices((prev) =>
        prev.map((inv) =>
          inv.id === invoice.id
            ? { ...inv, lastChaseStatus: "mailto", lastChaseAt: now }
            : inv
        )
      );
      if (isPaid) void markAgingChase(invoice.id, "mailto").catch(() => {});
    }
    if (isPaid && invoice) {
      void notifyWebhook("chase.sent", {
        method: "mailto",
        client_name: invoice.clientName,
        invoice_amount: invoice.amount,
      });
    }
  }

  function downloadCsv() {
    const rows = invoices
      .filter((inv) => inv.draft)
      .map((inv) => ({
        client: inv.clientName,
        amount: inv.amount,
        due_date: inv.dueDate,
        days_overdue: daysOverdue(inv.dueDate),
        subject: inv.draft!.subject,
        body: inv.draft!.body,
      }));
    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "chasa-drafts.csv";
    a.click();
    URL.revokeObjectURL(url);
    track("chase_downloaded", { rows: rows.length });
    if (isPaid) void notifyWebhook("chase.downloaded", { rows: rows.length });
  }

  const atLimit = !isPaid && isAtLimit();
  const selectedCount = selectedIds.size;

  function sequenceSendDate(daysFromNow: number): string {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + daysFromNow);
    return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  }

  const overdueCount = invoices.filter((inv) => daysOverdue(inv.dueDate) > 0).length;
  const draftedCount = invoices.filter((inv) => inv.draft).length;
  const firstName = account?.email?.split("@")[0]?.split(/[._-]/)[0] || null;
  const welcomeName = firstName
    ? firstName.charAt(0).toUpperCase() + firstName.slice(1)
    : null;

  return (
    <div>
      <section className="welcome-block">
        <h1>{welcomeName ? `Welcome, ${welcomeName}` : "Welcome"}</h1>
        <p className="page-sub" style={{ marginBottom: 0 }}>
          Here&apos;s what needs your attention today.
        </p>

        <div className="welcome-attention">
          <div className={`welcome-stat${overdueCount > 0 ? " is-accent" : ""}`}>
            <span className="welcome-stat-label">Overdue invoices</span>
            <strong>{overdueCount}</strong>
            <em>{invoices.length === 0 ? "Add invoices to begin" : "In this workspace"}</em>
          </div>
          <div className="welcome-stat">
            <span className="welcome-stat-label">Drafts ready</span>
            <strong>{draftedCount}</strong>
            <em>Never auto-sent</em>
          </div>
          <div className="welcome-stat">
            <span className="welcome-stat-label">{isPaid ? "Plan" : "Free drafts"}</span>
            <strong>{isPaid ? account?.plan ?? "paid" : `${Math.max(0, FREE_LIMIT - usedCount)}`}</strong>
            <em>{isPaid ? "All features unlocked" : `of ${FREE_LIMIT} left this month`}</em>
          </div>
        </div>

        <h2 className="welcome-section-title">Start something new</h2>
        <div className="welcome-actions">
          <a className="welcome-action" href="#chase-workspace">
            <span className="welcome-action-icon" aria-hidden="true">
              +
            </span>
            <span>
              <strong>New chase</strong>
              <span>Paste invoices or add a row, write drafts</span>
            </span>
          </a>
          <a className="welcome-action" href="#chase-workspace">
            <span className="welcome-action-icon" aria-hidden="true">
              ↗
            </span>
            <span>
              <strong>Import CSV</strong>
              <span>QuickBooks, Xero, Wave, Zoho, sevDesk…</span>
            </span>
          </a>
          <Link className="welcome-action" to="/connector">
            <span className="welcome-action-icon" aria-hidden="true">
              ≡
            </span>
            <span>
              <strong>Connectors</strong>
              <span>Dropbox, OneDrive, Box, or API keys</span>
            </span>
          </Link>
          <Link className="welcome-action" to={isPaid ? "/clients" : "/account"}>
            <span className="welcome-action-icon" aria-hidden="true">
              ▤
            </span>
            <span>
              <strong>Aging &amp; clients</strong>
              <span>{isPaid ? "Track outstanding balances" : "Unlock on Solo+"}</span>
            </span>
          </Link>
        </div>

        <h2 className="welcome-section-title">Needs attention</h2>
        {overdueCount === 0 ? (
          <div className="welcome-quiet">
            <span className="welcome-quiet-check" aria-hidden="true">
              ✓
            </span>
            <span>
              <strong>You&apos;re all caught up. Smooth.</strong>
              <span>
                {invoices.length === 0
                  ? "Nothing overdue yet — import a CSV or add an invoice below."
                  : "No overdue invoices waiting on a chase right now."}
              </span>
            </span>
          </div>
        ) : (
          <div className="welcome-quiet">
            <span className="welcome-quiet-check" aria-hidden="true" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
              !
            </span>
            <span>
              <strong>
                {overdueCount} overdue invoice{overdueCount === 1 ? "" : "s"}
              </strong>
              <span>Scroll to the aging table or draft follow-ups below.</span>
            </span>
          </div>
        )}
      </section>

      <div id="chase-workspace">
        <h2 className="welcome-section-title" style={{ marginTop: 8 }}>
          Chase workspace
        </h2>
        <p className="page-sub">
          Add invoices manually, upload a CSV, or import a PDF from Dropbox / OneDrive / Box (Solo+).
          Chasa writes the follow-up — draft only, never auto-sent.
        </p>
      </div>

      {!isPaid && (
        <div className="usage-bar">
          {usedCount}/{FREE_LIMIT} free drafts used this month
        </div>
      )}

      {atLimit && (
        <div className="upgrade-nudge">
          You've used your 5 free drafts this month.{" "}
          <Link to="/account">Upgrade to Chasa Paid</Link> for unlimited invoices.
        </div>
      )}

      {invoices.length > 0 && (
        <section className="panel aging-panel">
          <div className="aging-head">
            <div>
              <h2 className="aging-title">Aging overview</h2>
              <p className="branding-help">
                Client · amount · days overdue · last chase. Rows stay in this browser
                {isPaid ? " and sync to your Solo+ workspace" : " (re-upload CSV anytime)"}.
              </p>
            </div>
            <div className="aging-actions">
              <button type="button" className="btn-secondary" onClick={selectAllOverdue}>
                Select all
              </button>
              {selectedCount > 0 && (
                <button type="button" className="btn-secondary" onClick={clearSelection}>
                  Clear ({selectedCount})
                </button>
              )}
              <button
                type="button"
                className="btn-primary"
                disabled={selectedCount < 2 || multiBusy || atLimit}
                onClick={() => void handleMultiDraft()}
              >
                {multiBusy ? "Writing…" : "Draft one email"}
              </button>
            </div>
          </div>
          <div className="aging-table-wrap">
            <table className="aging-table">
              <thead>
                <tr>
                  <th className="aging-check" />
                  <th>Client</th>
                  <th>Amount</th>
                  <th>Days overdue</th>
                  <th>Last chase</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => {
                  const days = daysOverdue(inv.dueDate);
                  return (
                    <tr key={inv.id} className={`aging-row ${toneClass(days)}`}>
                      <td className="aging-check">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(inv.id)}
                          onChange={() => toggleSelect(inv.id)}
                          aria-label={`Select ${inv.clientName}`}
                        />
                      </td>
                      <td>{inv.clientName}</td>
                      <td>${inv.amount.toFixed(2)}</td>
                      <td>
                        <span className={`days-badge ${toneClass(days)}`}>
                          {days}d · {toneLabel(days)}
                        </span>
                      </td>
                      <td className="aging-status">
                        {inv.lastChaseStatus ? (
                          <>
                            {inv.lastChaseStatus}
                            {inv.lastChaseAt && (
                              <span className="aging-status-time">
                                {new Date(inv.lastChaseAt).toLocaleDateString()}
                              </span>
                            )}
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => {
                            scrollToInvoice(inv.id);
                            if (!inv.draft && !atLimit) void handleGenerate(inv.id);
                          }}
                        >
                          {inv.draft ? "View draft" : "Generate chase"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {multiError && <div className="error-msg">{multiError}</div>}
          {multiDraft && (
            <div className="multi-draft-box">
              <div className="ai-tools-label">Multi-invoice draft ({selectedCount} invoices)</div>
              <input
                type="text"
                className="draft-subject"
                value={multiDraft.subject}
                onChange={(e) => setMultiDraft({ ...multiDraft, subject: e.target.value })}
              />
              <textarea
                rows={8}
                value={multiDraft.body}
                onChange={(e) => setMultiDraft({ ...multiDraft, body: e.target.value })}
              />
              <div className="draft-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    navigator.clipboard.writeText(
                      `Subject: ${multiDraft.subject}\n\n${multiDraft.body}`
                    );
                    track("chase_sent", { method: "copy", source: "multi" });
                  }}
                >
                  Copy
                </button>
                <a
                  className="btn-secondary"
                  href={`mailto:?subject=${encodeURIComponent(multiDraft.subject)}&body=${encodeURIComponent(multiDraft.body)}`}
                  onClick={() => track("chase_sent", { method: "mailto", source: "multi" })}
                >
                  Open in email client
                </a>
              </div>
            </div>
          )}
        </section>
      )}

      {pendingImport && (
        <div className="panel cloud-import-panel">
          <h2 className="cloud-import-title">Confirm PDF import</h2>
          <p className="branding-help">
            From {pendingImport.providerLabel}: <code>{pendingImport.file.name}</code>
            {pendingImport.hints.confidence !== "none"
              ? ` · hints confidence: ${pendingImport.hints.confidence}`
              : " · no fields auto-detected — fill them in below"}
          </p>
          <form onSubmit={confirmCloudImport}>
            <div className="field-row">
              <input
                type="text"
                placeholder="Client name"
                value={importClient}
                onChange={(e) => setImportClient(e.target.value)}
              />
              <input
                type="number"
                placeholder="Amount"
                value={importAmount}
                onChange={(e) => setImportAmount(e.target.value)}
                step="0.01"
              />
              <input
                type="date"
                value={importDue}
                onChange={(e) => setImportDue(e.target.value)}
              />
              <button type="submit" className="btn-primary">
                Add invoice
              </button>
              <button type="button" className="btn-secondary" onClick={dismissCloudImport}>
                Dismiss
              </button>
            </div>
          </form>
          {pendingImport.textPreview ? (
            <details className="cloud-import-preview">
              <summary>
                Extracted text preview ({pendingImport.extractedChars} chars) — copy if useful
              </summary>
              <pre>{pendingImport.textPreview}</pre>
            </details>
          ) : (
            <p className="branding-help">
              No extractable text found (scanned PDF?). Enter the fields manually from the filename
              or open the file in {pendingImport.providerLabel}.
            </p>
          )}
        </div>
      )}

      <div className="panel">
        <form onSubmit={handleAddManual}>
          <div className="field-row">
            <input
              type="text"
              placeholder="Client name"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
            />
            <input
              type="number"
              placeholder="Amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              step="0.01"
            />
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            <button type="submit" className="btn-primary">
              Add
            </button>
          </div>
        </form>
        <div className="payment-link-row">
          <label htmlFor="payment-link">
            Payment link <span className="optional-tag">(optional)</span>
          </label>
          <input
            id="payment-link"
            type="url"
            placeholder="https://buy.stripe.com/… or PayPal.me / Wise"
            value={paymentLink}
            onChange={(e) => setPaymentLink(e.target.value)}
          />
          {isPaid ? (
            <Link className="branding-help" to="/branding">
              Set account default
            </Link>
          ) : (
            <span className="branding-help">Saved in this browser · Solo+ for account default</span>
          )}
        </div>
        <label className="btn-secondary" style={{ cursor: "pointer" }}>
          Upload CSV
          <input type="file" accept=".csv" onChange={handleCsvUpload} style={{ display: "none" }} />
        </label>
        {isPaid ? (
          <button
            type="button"
            className="btn-secondary"
            style={{ marginLeft: 8 }}
            onClick={() => void openPdfPicker()}
          >
            Import PDF
          </button>
        ) : (
          <Link className="btn-secondary" style={{ marginLeft: 8 }} to="/connector">
            PDF import (Solo+)
          </Link>
        )}
        {isPaid && invoices.some((inv) => inv.draft) && (
          <button className="btn-secondary" style={{ marginLeft: 8 }} onClick={downloadCsv}>
            Download all as CSV
          </button>
        )}
        {invoices.length > 0 && (
          <button
            type="button"
            className="btn-secondary"
            style={{ marginLeft: 8 }}
            onClick={() => {
              if (confirm("Clear all invoices from this session?")) {
                setInvoices([]);
                setSelectedIds(new Set());
                setMultiDraft(null);
                track("aging_cleared");
              }
            }}
          >
            Clear list
          </button>
        )}
      </div>

      {showPdfPicker && (
        <div className="panel cloud-import-panel">
          <div className="cloud-import-picker-head">
            <h2 className="cloud-import-title">Import PDF from cloud storage</h2>
            <button type="button" className="btn-secondary" onClick={() => setShowPdfPicker(false)}>
              Close
            </button>
          </div>
          {pdfError && <div className="error-msg">{pdfError}</div>}
          {pdfBusy && <p className="page-sub">Loading…</p>}
          {!pdfBusy && pdfProviders.length === 0 && (
            <p className="branding-help">
              No cloud storage connected yet.{" "}
              <Link to="/connector">Connect Dropbox, OneDrive, or Box</Link> first.
            </p>
          )}
          {pdfProviders.length > 1 && (
            <div className="cloud-import-provider-tabs">
              {pdfProviders.map((p) => (
                <button
                  key={p}
                  type="button"
                  className={pdfProvider === p ? "btn-primary" : "btn-secondary"}
                  disabled={pdfBusy}
                  onClick={() => void loadPdfFiles(p)}
                >
                  {CLOUD_LABELS[p]}
                </button>
              ))}
            </div>
          )}
          {pdfProvider && !pdfBusy && pdfFiles.length === 0 && (
            <p className="branding-help">No PDFs found. Try another provider or upload a CSV.</p>
          )}
          {pdfFiles.length > 0 && (
            <ul className="cloud-files-list">
              {pdfFiles.map((f) => (
                <li key={f.id}>
                  <div className="cloud-file-meta">
                    <code>{f.name}</code>
                    {f.modifiedAt && (
                      <span className="connector-key-detail">
                        {new Date(f.modifiedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={pdfBusy}
                    onClick={() => void importPdfFromTool(f)}
                  >
                    Import
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {invoices.map((invoice) => {
        const days = daysOverdue(invoice.dueDate);
        const tone = toneClass(days);
        const busy = invoice.generating || invoice.rewriting !== null;
        return (
          <div key={invoice.id} id={`invoice-${invoice.id}`} className={`invoice-card ${tone}`}>
            <div className="invoice-top">
              <div className="invoice-top-left">
                <label className="invoice-select">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(invoice.id)}
                    onChange={() => toggleSelect(invoice.id)}
                  />
                  <span className="invoice-client">{invoice.clientName}</span>
                </label>
                <div className="invoice-meta">
                  ${invoice.amount.toFixed(2)} · due {invoice.dueDate}
                  {invoice.lastChaseStatus ? ` · last chase: ${invoice.lastChaseStatus}` : ""}
                </div>
              </div>
              <span className="days-badge">
                {toneLabel(days)} · {days} day{days === 1 ? "" : "s"} late
              </span>
            </div>

            <div className="chase-tip">{chaseTip(days)}</div>

            {!invoice.draft && (
              <button
                className="btn-primary"
                disabled={busy || atLimit}
                onClick={() => handleGenerate(invoice.id)}
              >
                {invoice.generating ? "Writing…" : "Generate follow-up"}
              </button>
            )}
            {invoice.error && <div className="error-msg">{invoice.error}</div>}

            {invoice.draft && (
              <>
                <input
                  type="text"
                  className="draft-subject"
                  value={invoice.draft.subject}
                  onChange={(e) => updateDraft(invoice.id, "subject", e.target.value)}
                />
                <textarea
                  rows={6}
                  value={invoice.draft.body}
                  onChange={(e) => updateDraft(invoice.id, "body", e.target.value)}
                />

                <div className={`ai-tools-inline ${isPaid ? "" : "ai-tools-locked"}`}>
                  <div className="ai-tools-label">
                    AI tools {isPaid ? null : <span className="paid-pill">Paid</span>}
                  </div>
                  {isPaid ? (
                    <>
                      <button
                        type="button"
                        className="ai-tool-btn"
                        disabled={busy}
                        onClick={() => handleRewrite(invoice.id, "softer")}
                      >
                        <span className="ai-tool-icon" aria-hidden="true">
                          ↓
                        </span>
                        <span>
                          <strong>
                            {invoice.rewriting === "softer" ? "Softening…" : "Soften"}
                          </strong>
                          <span>Less pressure, still asks</span>
                        </span>
                      </button>
                      <button
                        type="button"
                        className="ai-tool-btn"
                        disabled={busy}
                        onClick={() => handleRewrite(invoice.id, "firmer")}
                      >
                        <span className="ai-tool-icon" aria-hidden="true">
                          ↑
                        </span>
                        <span>
                          <strong>
                            {invoice.rewriting === "firmer" ? "Firming…" : "Firm up"}
                          </strong>
                          <span>Clearer urgency</span>
                        </span>
                      </button>
                      <button
                        type="button"
                        className="ai-tool-btn"
                        disabled={busy}
                        onClick={() => handleRewrite(invoice.id, "shorter")}
                      >
                        <span className="ai-tool-icon" aria-hidden="true">
                          ✂
                        </span>
                        <span>
                          <strong>
                            {invoice.rewriting === "shorter" ? "Shortening…" : "Make shorter"}
                          </strong>
                          <span>Under ~60 words</span>
                        </span>
                      </button>
                      <button
                        type="button"
                        className="ai-tool-btn"
                        disabled={busy}
                        onClick={() => handleThankYou(invoice.id)}
                      >
                        <span className="ai-tool-icon" aria-hidden="true">
                          ✓
                        </span>
                        <span>
                          <strong>
                            {invoice.rewriting === "thankyou" ? "Writing…" : "Thank-you email"}
                          </strong>
                          <span>After they paid</span>
                        </span>
                      </button>
                      {isPro ? (
                        <button
                          type="button"
                          className="ai-tool-btn"
                          disabled={busy}
                          onClick={() => handleSequence(invoice.id)}
                        >
                          <span className="ai-tool-icon" aria-hidden="true">
                            ⏱
                          </span>
                          <span>
                            <strong>
                              {invoice.rewriting === "sequence" ? "Planning…" : "3-step chase plan"}
                            </strong>
                            <span>Pro · recommended cadence</span>
                          </span>
                        </button>
                      ) : (
                        <a className="ai-unlock-link" href="/app/account">
                          Unlock chase plans on Pro ($17/mo) →
                        </a>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="ai-tool-btn ai-tool-teaser" aria-disabled="true">
                        <span className="ai-tool-icon" aria-hidden="true">
                          ↓
                        </span>
                        <span>
                          <strong>Soften</strong>
                          <span>Less pressure, still asks</span>
                        </span>
                      </div>
                      <div className="ai-tool-btn ai-tool-teaser" aria-disabled="true">
                        <span className="ai-tool-icon" aria-hidden="true">
                          ↑
                        </span>
                        <span>
                          <strong>Firm up</strong>
                          <span>Clearer urgency</span>
                        </span>
                      </div>
                      <div className="ai-tool-btn ai-tool-teaser" aria-disabled="true">
                        <span className="ai-tool-icon" aria-hidden="true">
                          ✂
                        </span>
                        <span>
                          <strong>Make shorter</strong>
                          <span>Under ~60 words</span>
                        </span>
                      </div>
                      <a className="ai-unlock-link" href="/app/account">
                        Unlock AI tools from Solo ($7/mo) →
                      </a>
                    </>
                  )}
                </div>

                {isPaid && (
                  <div className="reply-box">
                    <label className="ai-tools-label">Client replied? Paste it — AI drafts your answer</label>
                    <textarea
                      rows={3}
                      placeholder="Paste their email reply here…"
                      value={invoice.clientReply ?? ""}
                      onChange={(e) =>
                        setInvoices((prev) =>
                          prev.map((inv) =>
                            inv.id === invoice.id ? { ...inv, clientReply: e.target.value } : inv
                          )
                        )
                      }
                    />
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={busy || !invoice.clientReply?.trim()}
                      onClick={() => handleReply(invoice.id)}
                    >
                      {invoice.rewriting === "reply" ? "Writing reply…" : "Draft reply"}
                    </button>
                  </div>
                )}

                {invoice.sequence && (
                  <div className="sequence-box">
                    <div className="ai-tools-label">Chase plan calendar</div>
                    <p className="chase-tip">{invoice.sequence.tip}</p>
                    <div className="sequence-steps">
                      {invoice.sequence.steps.map((step, idx) => (
                        <button
                          key={step.step}
                          type="button"
                          className="sequence-step"
                          onClick={() => applySequenceStep(invoice.id, idx)}
                        >
                          <strong>
                            Step {step.step}
                            {step.daysFromNow === 0
                              ? " · send today"
                              : ` · ${sequenceSendDate(step.daysFromNow)}`}
                          </strong>
                          <span>{step.label}</span>
                          <span className="sequence-step-date">
                            {step.daysFromNow === 0
                              ? "Today"
                              : `In ${step.daysFromNow} day${step.daysFromNow === 1 ? "" : "s"}`}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="draft-actions">
                  <button className="btn-secondary" onClick={() => copyDraft(invoice)}>
                    Copy
                  </button>
                  <a
                    className="btn-secondary"
                    href={mailtoLink(invoice)}
                    onClick={() => handleMailtoClick(invoice)}
                  >
                    Open in email client
                  </a>
                  <button
                    className="btn-secondary"
                    disabled={busy || atLimit}
                    onClick={() => handleGenerate(invoice.id)}
                  >
                    {invoice.generating ? "Writing…" : "Regenerate"}
                  </button>
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
