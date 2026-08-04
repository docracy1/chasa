import { daysOverdue } from "../../lib/dates";
import type { Invoice } from "./types";

export type ChaseView = "overdue" | "waiting" | "paid" | null;

export function parseChaseView(raw: string | null): ChaseView {
  if (raw === "overdue" || raw === "waiting" || raw === "paid") return raw;
  return null;
}

function isPaidInvoice(invoice: Invoice): boolean {
  return invoice.status === "paid";
}

function hasChaseActivity(invoice: Invoice): boolean {
  return !!(invoice.lastChaseStatus || invoice.draft);
}

/** Sidebar Chases filters — maps Docracy-style document buckets onto invoice chase state. */
export function matchesChaseView(invoice: Invoice, view: ChaseView): boolean {
  if (!view) return true;
  const paid = isPaidInvoice(invoice);
  if (view === "paid") return paid;
  if (paid) return false;
  if (view === "overdue") {
    // Needs a chase: past due and not yet followed up
    return daysOverdue(invoice.dueDate) > 0 && !hasChaseActivity(invoice);
  }
  // waiting: follow-up started, still unpaid (awaiting payment)
  return hasChaseActivity(invoice);
}

export function chaseViewTitleKey(view: Exclude<ChaseView, null>): string {
  if (view === "overdue") return "nav.chasesOverdue";
  if (view === "waiting") return "nav.chasesWaiting";
  return "nav.chasesPaid";
}

