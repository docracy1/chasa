import { TOOL_STORAGE_KEY } from "./constants";
import type { Invoice, StoredInvoice } from "./types";

export function loadStoredInvoices(): Invoice[] {
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

export function persistInvoices(invoices: Invoice[]) {
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
