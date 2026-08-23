import type { CloudProvider } from "../../lib/api";

/** i18n keys for connector card blurbs — resolve with t() at render time. */
export const CLOUD_DESCRIPTION_KEYS: Record<CloudProvider, string> = {
  dropbox: "connector.desc.dropbox",
  onedrive: "connector.desc.onedrive",
  box: "connector.desc.box",
  google: "connector.desc.google",
};

export const ACCOUNTING_DESCRIPTION_KEYS: Record<"quickbooks" | "xero", string> = {
  quickbooks: "connector.desc.quickbooks",
  xero: "connector.desc.xero",
};

/** @deprecated Prefer CLOUD_DESCRIPTION_KEYS + t() */
export const CLOUD_DESCRIPTIONS: Record<CloudProvider, string> = {
  dropbox:
    "Import invoice PDFs from Dropbox into the Tool. Connect once, then use Recent PDFs → Import.",
  onedrive:
    "Import invoice PDFs from OneDrive / Microsoft 365. Connect with Microsoft, then Recent PDFs → Import.",
  box: "Import invoice PDFs from Box. Connect once, then use Recent PDFs → Import into the Tool.",
  google:
    "Drive PDF import plus Gmail: docstoc can save chase drafts into your Gmail Drafts folder and read client replies for smart reply — you still send. Also Sheets, Calendar, and Contacts.",
};

/** @deprecated Prefer ACCOUNTING_DESCRIPTION_KEYS + t() */
export const ACCOUNTING_DESCRIPTIONS: Record<"quickbooks" | "xero", string> = {
  quickbooks:
    "Pull overdue QuickBooks Online invoices into your aging list. Then draft chase emails in the Tool — docstoc never sends them.",
  xero: "Pull overdue Xero invoices into your aging list. Then draft chase emails in the Tool — docstoc never sends them.",
};
