import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Papa from "papaparse";
import {
  CLOUD_IMPORT_STORAGE_KEY,
  createTrackedCopy,
  generateEmail,
  generateReply,
  generateSequence,
  generateSms,
  generateThankYou,
  getEvidencePack,
  importCloudConnectorFile,
  listCloudConnectorFiles,
  listCloudConnectors,
  listReminders,
  markAgingChase,
  markInvoicePaid,
  notifyWebhook,
  recordChaseEvent,
  generateDemandLetter,
  generateReplySmart,
  getInvoiceTimeline,
  rewriteEmail,
  scheduleFollowUpReminder,
  snoozeReminder,
  syncAging,
  trackingStats,
  updateReminderStatus,
  type Account,
  type ChaseReminder,
  type ChaseSequence,
  type CloudFile,
  type CloudProvider,
  type RewriteAction,
} from "../../lib/api";
import { getUsedCount, incrementUsedCount, isAtLimit } from "../../lib/usage";
import { track } from "../../lib/analytics";
import { daysOverdue } from "../../lib/dates";
import { formatUsWeekday } from "../../lib/locale";
import { CLOUD_LABELS, PAYMENT_LINK_STORAGE_KEY } from "./constants";
import { parseCsvRows } from "./csvImport";
import { loadStoredInvoices, persistInvoices } from "./storage";
import type { Invoice, PendingCloudImport } from "./types";
import { WelcomeBlock } from "./components/WelcomeBlock";
import { UsageBar } from "./components/UsageBar";
import { AgingOverviewPanel } from "./components/AgingOverviewPanel";
import { CloudImportConfirm } from "./components/CloudImportConfirm";
import { InvoiceIntakePanel } from "./components/InvoiceIntakePanel";
import { PdfPickerPanel } from "./components/PdfPickerPanel";
import { InvoiceCard } from "./components/InvoiceCard";
import { DueTodayBanner } from "./components/DueTodayBanner";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysFromToday(isoDate: string): number {
  const target = new Date(isoDate + "T12:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.max(1, Math.ceil((target.getTime() - today.getTime()) / 86400000) + 1);
}

export default function Tool({ account }: { account: Account | null }) {
  const [searchParams] = useSearchParams();
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
  const [dueTodayReminders, setDueTodayReminders] = useState<ChaseReminder[]>([]);
  const [openStatsMap, setOpenStatsMap] = useState<
    Record<string, { openCount: number; clickCount: number; lastOpenAt: string | null }>
  >({});
  const isPaid = account?.plan !== "free" && account?.plan != null;
  const isPro = account?.plan === "pro" || account?.plan === "enterprise";

  async function refreshTimeline(invoiceId: string) {
    if (!isPaid) return;
    try {
      const { events } = await getInvoiceTimeline(invoiceId);
      setInvoices((prev) =>
        prev.map((inv) => (inv.id === invoiceId ? { ...inv, timeline: events } : inv))
      );
    } catch {
      /* ignore */
    }
  }

  async function logChaseEvent(
    invoice: Invoice,
    eventType: "sent" | "copied" | "mailto" | "drafted",
    subject?: string,
    body?: string
  ) {
    if (!isPaid) return;
    try {
      await recordChaseEvent({
        agingInvoiceId: invoice.id,
        clientName: invoice.clientName,
        eventType,
        subject,
        body,
      });
      await refreshTimeline(invoice.id);
    } catch {
      /* ignore */
    }
  }

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

  useEffect(() => {
    if (!isPaid) {
      setDueTodayReminders([]);
      setOpenStatsMap({});
      return;
    }
    const today = todayIso();
    listReminders({ from: today, to: today, status: "planned" })
      .then((res) => setDueTodayReminders(res.reminders))
      .catch(() => setDueTodayReminders([]));
  }, [isPaid, invoices.length]);

  useEffect(() => {
    if (!isPaid || invoices.length === 0) return;
    const ids = invoices.map((i) => i.id);
    trackingStats(ids)
      .then((res) => setOpenStatsMap(res.stats))
      .catch(() => setOpenStatsMap({}));
  }, [isPaid, invoices.length]);

  useEffect(() => {
    const focus = searchParams.get("focus");
    if (!focus) return;
    const el = document.getElementById(`invoice-${focus}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [searchParams, invoices.length]);

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
          status: inv.status ?? "open",
          paidAt: inv.paidAt ?? null,
          lastChaseStatus: inv.lastChaseStatus ?? null,
          lastChaseAt: inv.lastChaseAt ?? null,
        })),
        true
      ).catch(() => {});
    }, 800);
    return () => window.clearTimeout(timer);
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

        const parsed = parseCsvRows(rows);
        if (parsed.length > 0) {
          for (const row of parsed) {
            addInvoice(row.clientName, row.amount, row.dueDate);
          }
          track("invoice_uploaded", { rows: parsed.length });
          track("fields_added", { source: "csv", rows: parsed.length });
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

    let invoice: (typeof invoices)[number] | undefined;
    setInvoices((prev) => {
      invoice = prev.find((inv) => inv.id === invoiceId);
      return prev.map((inv) =>
        inv.id === invoiceId ? { ...inv, generating: true, error: undefined } : inv
      );
    });
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
      if (!isPaid) {
        if (typeof draft.remaining === "number") setUsedCount(5 - draft.remaining);
        else setUsedCount(incrementUsedCount());
      }
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

  async function handleReplySmart(invoiceId: string) {
    if (!isPro) return;
    const invoice = invoices.find((inv) => inv.id === invoiceId);
    if (!invoice?.clientReply?.trim()) return;
    setInvoices((prev) =>
      prev.map((inv) =>
        inv.id === invoiceId ? { ...inv, rewriting: "replySmart", error: undefined } : inv
      )
    );
    try {
      const result = await generateReplySmart({
        client_name: invoice.clientName,
        invoice_amount: invoice.amount,
        days_overdue: daysOverdue(invoice.dueDate),
        client_message: invoice.clientReply.trim(),
        payment_link: paymentLink || account?.paymentLink || undefined,
        aging_invoice_id: invoice.id,
      });
      setInvoices((prev) =>
        prev.map((inv) =>
          inv.id === invoiceId
            ? {
                ...inv,
                draft: { subject: result.subject, body: result.body },
                replyInsight: {
                  classification: result.classification,
                  summary: result.summary,
                  suggestedAction: result.suggestedAction,
                  promisedPayDate: result.promisedPayDate,
                },
                rewriting: null,
              }
            : inv
        )
      );
      void refreshTimeline(invoiceId);
    } catch (err) {
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

  async function handleDemandLetter(invoiceId: string) {
    if (!isPro) return;
    const invoice = invoices.find((inv) => inv.id === invoiceId);
    if (!invoice) return;
    setInvoices((prev) =>
      prev.map((inv) =>
        inv.id === invoiceId ? { ...inv, rewriting: "demandLetter", error: undefined } : inv
      )
    );
    try {
      const result = await generateDemandLetter({
        client_name: invoice.clientName,
        invoice_amount: invoice.amount,
        due_date: invoice.dueDate,
        days_overdue: daysOverdue(invoice.dueDate),
        payment_link: paymentLink || account?.paymentLink || undefined,
        sender_name: account?.workspaceName ?? undefined,
      });
      const blob = new Blob([result.html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setInvoices((prev) =>
        prev.map((inv) => (inv.id === invoiceId ? { ...inv, rewriting: null } : inv))
      );
    } catch (err) {
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

  async function handleMarkSent(invoice: Invoice) {
    const now = new Date().toISOString();
    setInvoices((prev) =>
      prev.map((inv) =>
        inv.id === invoice.id
          ? { ...inv, lastChaseStatus: "sent", lastChaseAt: now }
          : inv
      )
    );
    if (isPaid) {
      await markAgingChase(invoice.id, "sent").catch(() => {});
      await logChaseEvent(
        invoice,
        "sent",
        invoice.draft?.subject,
        invoice.draft?.body
      );
      void notifyWebhook("chase.sent", {
        method: "manual",
        client_name: invoice.clientName,
        invoice_amount: invoice.amount,
      });
    }
  }

  async function handleMarkPaid(invoice: Invoice) {
    const now = new Date().toISOString();
    setInvoices((prev) =>
      prev.map((inv) =>
        inv.id === invoice.id
          ? { ...inv, status: "paid", paidAt: now, lastChaseStatus: "paid", lastChaseAt: now }
          : inv
      )
    );
    if (isPaid) {
      await markInvoicePaid(invoice.id).catch(() => {});
      await refreshTimeline(invoice.id);
    }
  }

  async function handleSequence(invoiceId: string) {
    if (!isPaid) return;
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
        aging_invoice_id: invoice.id,
      });
      const first = sequence.steps[0];
      setInvoices((prev) =>
        prev.map((inv) =>
          inv.id === invoiceId
            ? {
                ...inv,
                sequence,
                reminders: (sequence as ChaseSequence & { reminders?: ChaseReminder[] }).reminders,
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

  async function handleSms(invoiceId: string) {
    if (!isPaid) return;
    const invoice = invoices.find((inv) => inv.id === invoiceId);
    if (!invoice) return;
    setInvoices((prev) =>
      prev.map((inv) =>
        inv.id === invoiceId ? { ...inv, rewriting: "sms", error: undefined } : inv
      )
    );
    try {
      const smsDraft = await generateSms({
        client_name: invoice.clientName,
        invoice_amount: invoice.amount,
        days_overdue: daysOverdue(invoice.dueDate),
      });
      setInvoices((prev) =>
        prev.map((inv) => (inv.id === invoiceId ? { ...inv, smsDraft, rewriting: null } : inv))
      );
    } catch (err) {
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

  async function handleTrackedCopy(invoice: Invoice) {
    if (!isPaid || !invoice.draft) return;
    try {
      const tracked = await createTrackedCopy({
        subject: invoice.draft.subject,
        body: invoice.draft.body,
        clientName: invoice.clientName,
        agingInvoiceId: invoice.id,
      });
      await navigator.clipboard.writeText(tracked.html);
      setInvoices((prev) =>
        prev.map((inv) =>
          inv.id === invoice.id
            ? {
                ...inv,
                trackingNote: tracked.note,
                lastChaseStatus: "tracked_copy",
                lastChaseAt: new Date().toISOString(),
              }
            : inv
        )
      );
      void markAgingChase(invoice.id, "tracked_copy").catch(() => {});
      track("chase_sent", { method: "tracked_html" });
    } catch (err) {
      setInvoices((prev) =>
        prev.map((inv) =>
          inv.id === invoice.id
            ? { ...inv, error: err instanceof Error ? err.message : "Tracked copy failed." }
            : inv
        )
      );
    }
  }

  async function markReminderDone(invoiceId: string, reminderId: string) {
    try {
      await updateReminderStatus(reminderId, "done");
      setInvoices((prev) =>
        prev.map((inv) => {
          if (inv.id !== invoiceId || !inv.reminders) return inv;
          return {
            ...inv,
            reminders: inv.reminders.map((r) =>
              r.id === reminderId ? { ...r, status: "done" as const } : r
            ),
          };
        })
      );
      setDueTodayReminders((prev) => prev.filter((r) => r.id !== reminderId));
    } catch {
      /* ignore */
    }
  }

  async function handleSnoozeReminder(invoiceId: string, reminderId: string, days: number) {
    try {
      const { reminder } = await snoozeReminder(reminderId, days);
      setInvoices((prev) =>
        prev.map((inv) => {
          if (inv.id !== invoiceId || !inv.reminders) return inv;
          return {
            ...inv,
            reminders: inv.reminders.map((r) => (r.id === reminderId ? reminder : r)),
          };
        })
      );
      setDueTodayReminders((prev) => prev.filter((r) => r.id !== reminderId));
    } catch {
      /* ignore */
    }
  }

  async function handleScheduleReplyFollowUp(invoiceId: string) {
    if (!isPro) return;
    const invoice = invoices.find((inv) => inv.id === invoiceId);
    if (!invoice?.draft) return;
    const promised = invoice.replyInsight?.promisedPayDate;
    const daysFromNow = promised ? daysFromToday(promised) : 4;
    try {
      const { reminder } = await scheduleFollowUpReminder({
        agingInvoiceId: invoice.id,
        clientName: invoice.clientName,
        daysFromNow,
        label: promised ? `If unpaid after ${promised}` : "Follow-up after payment promise",
        subject: invoice.draft.subject,
        body: invoice.draft.body,
      });
      setInvoices((prev) =>
        prev.map((inv) =>
          inv.id === invoiceId
            ? { ...inv, reminders: [...(inv.reminders ?? []), reminder] }
            : inv
        )
      );
    } catch {
      /* ignore */
    }
  }

  async function handleEvidencePack(invoiceId: string) {
    if (!isPro) return;
    try {
      const result = await getEvidencePack(invoiceId);
      const blob = new Blob([result.html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      setInvoices((prev) =>
        prev.map((inv) =>
          inv.id === invoiceId
            ? {
                ...inv,
                error: err instanceof Error ? err.message : "Could not export evidence pack.",
              }
            : inv
        )
      );
    }
  }

  function handleOpenDueReminder(reminder: ChaseReminder) {
    if (reminder.agingInvoiceId) {
      const el = document.getElementById(`invoice-${reminder.agingInvoiceId}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      if (reminder.subject && reminder.body) {
        setInvoices((prev) =>
          prev.map((inv) =>
            inv.id === reminder.agingInvoiceId
              ? { ...inv, draft: { subject: reminder.subject!, body: reminder.body! } }
              : inv
          )
        );
      }
    }
  }

  function copyNextReminder(invoice: Invoice) {
    const next = invoice.reminders?.find((r) => r.status === "planned");
    if (!next?.body) return;
    void navigator.clipboard.writeText(`Subject: ${next.subject ?? ""}\n\n${next.body}`);
    setInvoices((prev) =>
      prev.map((inv) =>
        inv.id === invoice.id
          ? { ...inv, draft: { subject: next.subject ?? "", body: next.body ?? "" } }
          : inv
      )
    );
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
      void logChaseEvent(invoice, "copied", invoice.draft.subject, invoice.draft.body);
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
      void logChaseEvent(invoice, "mailto", invoice.draft?.subject, invoice.draft?.body);
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

  function handleClearList() {
    setInvoices([]);
    setSelectedIds(new Set());
    setMultiDraft(null);
  }

  function handleClientReplyChange(invoiceId: string, value: string) {
    setInvoices((prev) =>
      prev.map((inv) => (inv.id === invoiceId ? { ...inv, clientReply: value } : inv))
    );
  }

  const atLimit = !isPaid && isAtLimit();
  const selectedCount = selectedIds.size;

  function sequenceSendDate(daysFromNow: number): string {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + daysFromNow);
    return formatUsWeekday(d);
  }

  const overdueCount = invoices.filter((inv) => daysOverdue(inv.dueDate) > 0).length;
  const draftedCount = invoices.filter((inv) => inv.draft).length;
  const firstName = account?.email?.split("@")[0]?.split(/[._-]/)[0] || null;
  const welcomeName = firstName
    ? firstName.charAt(0).toUpperCase() + firstName.slice(1)
    : null;

  return (
    <div>
      <WelcomeBlock
        welcomeName={welcomeName}
        overdueCount={overdueCount}
        draftedCount={draftedCount}
        invoiceCount={invoices.length}
        isPaid={isPaid}
        account={account}
        usedCount={usedCount}
      />

      <div id="chase-workspace">
        <h2 className="welcome-section-title" style={{ marginTop: 8 }}>
          Chase workspace
        </h2>
        <p className="page-sub">
          Add invoices manually, upload a CSV, or import a PDF from Dropbox / OneDrive / Box (Solo+).
          Chasa writes the follow-up — draft only, never auto-sent.
        </p>
      </div>

      <UsageBar usedCount={usedCount} atLimit={atLimit} isPaid={isPaid} />

      {invoices.length > 0 && (
        <AgingOverviewPanel
          invoices={invoices}
          isPaid={isPaid}
          selectedIds={selectedIds}
          selectedCount={selectedCount}
          multiBusy={multiBusy}
          atLimit={atLimit}
          multiError={multiError}
          multiDraft={multiDraft}
          onSelectAll={selectAllOverdue}
          onClearSelection={clearSelection}
          onMultiDraft={handleMultiDraft}
          onToggleSelect={toggleSelect}
          onScrollToInvoice={scrollToInvoice}
          onGenerate={handleGenerate}
          onMultiDraftChange={setMultiDraft}
        />
      )}

      {pendingImport && (
        <CloudImportConfirm
          pendingImport={pendingImport}
          importClient={importClient}
          importAmount={importAmount}
          importDue={importDue}
          onImportClientChange={setImportClient}
          onImportAmountChange={setImportAmount}
          onImportDueChange={setImportDue}
          onConfirm={confirmCloudImport}
          onDismiss={dismissCloudImport}
        />
      )}

      <InvoiceIntakePanel
        clientName={clientName}
        amount={amount}
        dueDate={dueDate}
        paymentLink={paymentLink}
        isPaid={isPaid}
        invoices={invoices}
        onClientNameChange={setClientName}
        onAmountChange={setAmount}
        onDueDateChange={setDueDate}
        onPaymentLinkChange={setPaymentLink}
        onAddManual={handleAddManual}
        onCsvUpload={handleCsvUpload}
        onOpenPdfPicker={openPdfPicker}
        onDownloadCsv={downloadCsv}
        onClearList={handleClearList}
      />

      {showPdfPicker && (
        <PdfPickerPanel
          pdfError={pdfError}
          pdfBusy={pdfBusy}
          pdfProviders={pdfProviders}
          pdfProvider={pdfProvider}
          pdfFiles={pdfFiles}
          onClose={() => setShowPdfPicker(false)}
          onLoadPdfFiles={loadPdfFiles}
          onImportPdf={importPdfFromTool}
        />
      )}

      {isPaid && (
        <DueTodayBanner reminders={dueTodayReminders} onOpenReminder={handleOpenDueReminder} />
      )}

      {invoices
        .filter((inv) => inv.status !== "paid")
        .map((invoice) => (
        <InvoiceCard
          key={invoice.id}
          invoice={invoice}
          isPaid={isPaid}
          isPro={isPro}
          atLimit={atLimit}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onGenerate={handleGenerate}
          onUpdateDraft={updateDraft}
          onRewrite={handleRewrite}
          onThankYou={handleThankYou}
          onSequence={handleSequence}
          onSms={handleSms}
          onClientReplyChange={handleClientReplyChange}
          onReply={handleReply}
          onReplySmart={handleReplySmart}
          onDemandLetter={handleDemandLetter}
          onMarkSent={handleMarkSent}
          onMarkPaid={handleMarkPaid}
          onApplySequenceStep={applySequenceStep}
          onCopyNextReminder={copyNextReminder}
          onMarkReminderDone={markReminderDone}
          onSnoozeReminder={handleSnoozeReminder}
          onScheduleReplyFollowUp={handleScheduleReplyFollowUp}
          onEvidencePack={handleEvidencePack}
          openStats={openStatsMap[invoice.id]}
          onCopyDraft={copyDraft}
          onTrackedCopy={handleTrackedCopy}
          mailtoLink={mailtoLink}
          onMailtoClick={handleMailtoClick}
          sequenceSendDate={sequenceSendDate}
        />
      ))}
    </div>
  );
}
