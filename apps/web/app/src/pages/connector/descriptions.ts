import type { CloudProvider } from "../../lib/api";

/** Short “what you can do” blurbs shown on each connector card. */
export const CLOUD_DESCRIPTIONS: Record<CloudProvider, string> = {
  dropbox:
    "Import invoice PDFs from Dropbox into the Tool. Connect once, then use Recent PDFs → Import.",
  onedrive:
    "Import invoice PDFs from OneDrive / Microsoft 365. Connect with Microsoft, then Recent PDFs → Import.",
  box: "Import invoice PDFs from Box. Connect once, then use Recent PDFs → Import into the Tool.",
  google:
    "Connect Google for Drive PDF import, Gmail drafts, Sheets, Calendar reminders, and Contacts import.",
};

export const ACCOUNTING_DESCRIPTIONS: Record<"quickbooks" | "xero", string> = {
  quickbooks:
    "Pull overdue QuickBooks Online invoices into your aging list. Then draft chase emails in the Tool — Chasa never sends them.",
  xero: "Pull overdue Xero invoices into your aging list. Then draft chase emails in the Tool — Chasa never sends them.",
};
