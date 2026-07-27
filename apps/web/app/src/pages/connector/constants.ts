import { CLOUD_REDIRECT_URIS, type AccountingProvider, type CloudProvider } from "../../lib/api";

export const DRAFT_URL = "https://api.chasa.io/api/v1/chase/draft";
export const PROVIDERS: CloudProvider[] = ["dropbox", "onedrive", "box"];
export const ACCOUNTING_PROVIDERS: AccountingProvider[] = ["quickbooks", "xero"];
export const TEST_OK_STORAGE_KEY = "chasa.connectorTestOk";
export const API_KEY_TEST_OK_STORAGE_KEY = "chasa.apiKeyTestOk";
export const ONEDRIVE_REDIRECT = CLOUD_REDIRECT_URIS.onedrive;

export const ACCOUNTING_LABELS: Record<AccountingProvider, string> = {
  quickbooks: "QuickBooks Online",
  xero: "Xero",
};

export const ACCOUNTING_CONSOLE: Record<AccountingProvider, { label: string; href: string }> = {
  quickbooks: {
    label: "Intuit Developer",
    href: "https://developer.intuit.com/",
  },
  xero: {
    label: "Xero Developer",
    href: "https://developer.xero.com/",
  },
};
