export { CLOUD_LABELS } from "../../lib/cloudImport";

export const TOOL_STORAGE_KEY = "docstoc.tool.invoices";
export const PAYMENT_LINK_STORAGE_KEY = "docstoc.tool.paymentLink";

// Unified aliases for QBO / FreshBooks / Xero / Wave / Zoho / sevDesk (+ Docstoc). Exact match after normalize.
export const CLIENT_HEADERS = [
  "organization", // FreshBooks
  "customer name", // FreshBooks
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
export const AMOUNT_HEADERS = [
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
export const DUE_DATE_HEADERS = [
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
export const DAYS_HEADERS = [
  "days overdue",
  "days past due",
  "overdue days",
  "aging",
  "days_overdue",
  "tage überfällig",
  "tage uberfallig",
];
