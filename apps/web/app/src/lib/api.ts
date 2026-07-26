export interface GeneratedEmail {
  subject: string;
  body: string;
}

export interface Account {
  email: string;
  plan: "free" | "solo" | "pro" | "enterprise";
  workspaceName?: string | null;
  logoDataUrl?: string | null;
}

export type Branding = {
  workspaceName: string | null;
  logoDataUrl: string | null;
  paid: boolean;
};

export function getBranding() {
  return jsonFetch<Branding>("/account/branding");
}

export function updateBranding(input: {
  workspaceName?: string;
  logoDataUrl?: string;
  removeLogo?: boolean;
  removeName?: boolean;
}) {
  return jsonFetch<Branding>("/account/branding", {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

async function jsonFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  }
  return data as T;
}

export function generateEmail(input: { client_name: string; invoice_amount: number; days_overdue: number }) {
  return jsonFetch<GeneratedEmail>("/generate-email", { method: "POST", body: JSON.stringify(input) });
}

export type RewriteAction = "softer" | "firmer" | "shorter";

export function rewriteEmail(input: { subject: string; body: string; action: RewriteAction }) {
  return jsonFetch<GeneratedEmail>("/rewrite-email", { method: "POST", body: JSON.stringify(input) });
}

export function generateThankYou(input: { client_name: string; invoice_amount: number }) {
  return jsonFetch<GeneratedEmail>("/generate-thank-you", { method: "POST", body: JSON.stringify(input) });
}

export function generateReply(input: {
  client_name: string;
  invoice_amount: number;
  days_overdue: number;
  client_message: string;
}) {
  return jsonFetch<GeneratedEmail>("/generate-reply", { method: "POST", body: JSON.stringify(input) });
}

export type ChaseSequence = {
  tip: string;
  steps: { step: number; daysFromNow: number; label: string; subject: string; body: string }[];
};

export function generateSequence(input: {
  client_name: string;
  invoice_amount: number;
  days_overdue: number;
}) {
  return jsonFetch<ChaseSequence>("/generate-sequence", { method: "POST", body: JSON.stringify(input) });
}

export type WebhookItem = { id: string; url: string; createdAt: string };

export function listWebhooks() {
  return jsonFetch<{ webhooks: WebhookItem[] }>("/webhooks");
}

export function createWebhook(url: string) {
  return jsonFetch<WebhookItem>("/webhooks", { method: "POST", body: JSON.stringify({ url }) });
}

export function deleteWebhook(id: string) {
  return jsonFetch<{ ok: true }>(`/webhooks/${id}`, { method: "DELETE" });
}

export type ConnectorKey = {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
};

export function listConnectorKeys() {
  return jsonFetch<{ keys: ConnectorKey[] }>("/connector/keys");
}

export function createConnectorKey(name?: string) {
  return jsonFetch<ConnectorKey & { token: string }>("/connector/keys", {
    method: "POST",
    body: JSON.stringify(name ? { name } : {}),
  });
}

export function revokeConnectorKey(id: string) {
  return jsonFetch<{ ok: true }>(`/connector/keys/${id}`, { method: "DELETE" });
}

export type CloudProvider = "dropbox" | "onedrive" | "box";

export type CloudConnectorStatus = {
  provider: CloudProvider;
  connected: boolean;
  externalEmail: string | null;
  externalUserId: string | null;
  connectedAt: string | null;
  configured: boolean;
};

export type CloudFile = {
  id: string;
  name: string;
  path: string | null;
  mimeType: string | null;
  size: number | null;
  modifiedAt: string | null;
};

export type CloudInvoiceHints = {
  clientName: string | null;
  amount: number | null;
  dueDate: string | null;
  confidence: "none" | "low" | "medium" | "high";
};

export type CloudFileImport = {
  file: CloudFile;
  hints: CloudInvoiceHints;
  textPreview: string;
  extractedChars: number;
};

/** sessionStorage key — Connector writes, Tool reads + clears */
export const CLOUD_IMPORT_STORAGE_KEY = "chasa.cloudImport";

export function listCloudConnectors() {
  return jsonFetch<{ connectors: CloudConnectorStatus[] }>("/account/connectors");
}

export function disconnectCloudConnector(provider: CloudProvider) {
  return jsonFetch<{ ok: true }>(`/account/connectors/${provider}`, { method: "DELETE" });
}

export function listCloudConnectorFiles(provider: CloudProvider) {
  return jsonFetch<{ files: CloudFile[] }>(`/account/connectors/${provider}/files`);
}

export function importCloudConnectorFile(
  provider: CloudProvider,
  file: { id: string; path?: string | null }
) {
  return jsonFetch<CloudFileImport>(`/account/connectors/${provider}/files/import`, {
    method: "POST",
    body: JSON.stringify({ id: file.id, path: file.path ?? null }),
  });
}

/** Start OAuth — full-page navigate so the session cookie is sent. */
export function cloudConnectorConnectUrl(provider: CloudProvider) {
  return `/api/account/connectors/${provider}/connect`;
}

export function notifyWebhook(
  event:
    | "chase.sent"
    | "chase.downloaded"
    | "chase.drafted"
    | "chase.thank_you"
    | "chase.reply_drafted"
    | "chase.sequence_planned",
  data?: Record<string, unknown>
) {
  return jsonFetch<{ ok: true }>("/webhooks/notify", {
    method: "POST",
    body: JSON.stringify({ event, data }),
  }).catch(() => ({ ok: true as const }));
}

export function requestMagicLink(email: string) {
  return jsonFetch<{ ok: true }>("/auth/request", { method: "POST", body: JSON.stringify({ email }) });
}

export function logout() {
  return jsonFetch<{ ok: true }>("/auth/logout", { method: "POST" });
}

export async function getMe(): Promise<Account | null> {
  try {
    return await jsonFetch<Account>("/account/me");
  } catch {
    return null;
  }
}

export function startCheckout(plan: "solo" | "pro" | "enterprise") {
  return jsonFetch<{ url: string }>("/billing/checkout", {
    method: "POST",
    body: JSON.stringify({ plan }),
  });
}

export function openBillingPortal() {
  return jsonFetch<{ url: string }>("/billing/portal", { method: "POST" });
}
