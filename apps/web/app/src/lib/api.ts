export interface GeneratedEmail {
  subject: string;
  body: string;
}

export interface Account {
  email: string;
  plan: "free" | "solo" | "pro" | "enterprise";
  workspaceName?: string | null;
  logoDataUrl?: string | null;
  paymentLink?: string | null;
  lateFeeEnabled?: boolean;
  lateFeeHint?: string | null;
  role?: "admin" | "member";
  workspaceId?: string;
}

export type Branding = {
  workspaceName: string | null;
  logoDataUrl: string | null;
  paymentLink: string | null;
  lateFeeEnabled?: boolean;
  lateFeeHint?: string | null;
  paid: boolean;
};

export function getBranding() {
  return jsonFetch<Branding>("/account/branding");
}

export function updateBranding(input: {
  workspaceName?: string;
  logoDataUrl?: string;
  paymentLink?: string;
  lateFeeEnabled?: boolean;
  lateFeeHint?: string;
  removeLogo?: boolean;
  removeName?: boolean;
  removePaymentLink?: boolean;
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

export function generateEmail(input: {
  client_name: string;
  invoice_amount: number;
  days_overdue: number;
  payment_link?: string;
  invoices?: Array<{
    client_name?: string;
    invoice_amount: number;
    days_overdue: number;
    due_date?: string;
  }>;
}) {
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
  aging_invoice_id?: string;
}) {
  return jsonFetch<ChaseSequence>("/generate-sequence", { method: "POST", body: JSON.stringify(input) });
}

export type SmsWhatsAppDraft = {
  sms: string;
  whatsapp: string;
  smsUri: string;
  whatsappUri: string;
};

export function generateSms(input: {
  client_name: string;
  invoice_amount: number;
  days_overdue: number;
  phone?: string;
}) {
  return jsonFetch<SmsWhatsAppDraft>("/generate-sms", { method: "POST", body: JSON.stringify(input) });
}

export type ChaseReminder = {
  id: string;
  agingInvoiceId: string | null;
  clientName: string;
  stepNumber: number;
  plannedDate: string;
  label: string | null;
  subject: string | null;
  body: string | null;
  status: "planned" | "done" | "skipped";
  createdAt: string;
  updatedAt: string;
};

export function listReminders(opts?: { from?: string; to?: string; status?: string }) {
  const q = new URLSearchParams();
  if (opts?.from) q.set("from", opts.from);
  if (opts?.to) q.set("to", opts.to);
  if (opts?.status) q.set("status", opts.status);
  const qs = q.toString();
  return jsonFetch<{ reminders: ChaseReminder[] }>(`/reminders${qs ? `?${qs}` : ""}`);
}

export function updateReminderStatus(id: string, status: "planned" | "done" | "skipped") {
  return jsonFetch<{ reminder: ChaseReminder }>(`/reminders/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export type TrackedChase = {
  chaseId: string;
  html: string;
  plainBody: string;
  pixelUrl: string;
  note: string;
};

export function createTrackedCopy(input: {
  subject?: string;
  body: string;
  clientName?: string;
  agingInvoiceId?: string;
}) {
  return jsonFetch<TrackedChase>("/tracking/create", { method: "POST", body: JSON.stringify(input) });
}

export function listTracking() {
  return jsonFetch<{
    tracking: Array<{
      id: string;
      agingInvoiceId: string | null;
      clientName: string | null;
      subject: string | null;
      createdAt: string;
      openCount: number;
      clickCount: number;
      lastOpenAt: string | null;
      lastClickAt: string | null;
    }>;
    note: string;
  }>("/tracking");
}

export function trackingStats(invoiceIds: string[]) {
  return jsonFetch<{
    stats: Record<string, { openCount: number; clickCount: number; lastOpenAt: string | null }>;
  }>("/tracking/stats", { method: "POST", body: JSON.stringify({ invoiceIds }) });
}

export type AccountingProvider = "quickbooks" | "xero";

export type AccountingConnectorStatus = {
  provider: AccountingProvider;
  connected: boolean;
  externalEmail: string | null;
  realmId: string | null;
  connectedAt: string | null;
  configured: boolean;
};

export function accountingConnectUrl(provider: AccountingProvider) {
  return `/api/account/connectors/${provider}/connect`;
}

export function disconnectAccountingConnector(provider: AccountingProvider) {
  return jsonFetch<{ ok: true }>(`/account/connectors/${provider}`, { method: "DELETE" });
}

export function listAccountingInvoices(provider: AccountingProvider) {
  return jsonFetch<{
    invoices: Array<{ externalId: string; clientName: string; amount: number; dueDate: string }>;
  }>(`/account/connectors/${provider}/invoices`);
}

export function importAccountingInvoices(provider: AccountingProvider) {
  return jsonFetch<{
    imported: number;
    invoices: Array<{ id: string; clientName: string; amount: number; dueDate: string }>;
  }>(`/account/connectors/${provider}/import-invoices`, { method: "POST", body: "{}" });
}

export const ACCOUNTING_REDIRECT_URIS: Record<AccountingProvider, string> = {
  quickbooks: "https://api.chasa.io/api/account/connectors/quickbooks/callback",
  xero: "https://api.chasa.io/api/account/connectors/xero/callback",
};

export type TeamInfo = {
  ownerEmail: string;
  members: Array<{
    id: string;
    email: string;
    role: "admin" | "member";
    status: "pending" | "active";
    invitedAt: string;
    joinedAt: string | null;
  }>;
  seats: { used: number; limit: number; remaining: number };
  yourRole: "admin" | "member";
  plan: string;
};

export function getTeam() {
  return jsonFetch<TeamInfo>("/team");
}

export function inviteTeamMember(email: string, role: "admin" | "member" = "member") {
  return jsonFetch<{ member: TeamInfo["members"][0]; inviteUrl: string }>("/team/invite", {
    method: "POST",
    body: JSON.stringify({ email, role }),
  });
}

export function acceptTeamInvite(token: string) {
  return jsonFetch<{ ok: true; workspaceId: string }>("/team/accept", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

export function removeTeamMember(id: string) {
  return jsonFetch<{ ok: true }>(`/team/${id}`, { method: "DELETE" });
}

export function updateTeamMemberRole(id: string, role: "admin" | "member") {
  return jsonFetch<{ ok: true }>(`/team/${id}`, { method: "PATCH", body: JSON.stringify({ role }) });
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

export type CloudConnectorTestResult = {
  ok: boolean;
  provider: CloudProvider;
  configured: boolean;
  connected: boolean;
  message: string;
  externalEmail: string | null;
  filesFound: number | null;
  hint: string | null;
  explanation?: string;
};

/** sessionStorage key — Connector writes, Tool reads + clears */
export const CLOUD_IMPORT_STORAGE_KEY = "chasa.cloudImport";

export function listCloudConnectors() {
  return jsonFetch<{ connectors: CloudConnectorStatus[]; accounting?: AccountingConnectorStatus[] }>(
    "/account/connectors"
  );
}

export function disconnectCloudConnector(provider: CloudProvider) {
  return jsonFetch<{ ok: true }>(`/account/connectors/${provider}`, { method: "DELETE" });
}

export function listCloudConnectorFiles(provider: CloudProvider) {
  return jsonFetch<{ files: CloudFile[] }>(`/account/connectors/${provider}/files`);
}

export function testCloudConnector(provider: CloudProvider) {
  return jsonFetch<CloudConnectorTestResult>(`/account/connectors/${provider}/test`, {
    method: "POST",
  });
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

/** Exact redirect URIs to register in each provider console. */
export const CLOUD_REDIRECT_URIS: Record<CloudProvider, string> = {
  dropbox: "https://api.chasa.io/api/account/connectors/dropbox/callback",
  onedrive: "https://api.chasa.io/api/account/connectors/onedrive/callback",
  box: "https://api.chasa.io/api/account/connectors/box/callback",
};

export const CLOUD_SECRET_NAMES: Record<CloudProvider, [string, string]> = {
  dropbox: ["DROPBOX_CLIENT_ID", "DROPBOX_CLIENT_SECRET"],
  onedrive: ["ONEDRIVE_CLIENT_ID", "ONEDRIVE_CLIENT_SECRET"],
  box: ["BOX_CLIENT_ID", "BOX_CLIENT_SECRET"],
};

/** Map OAuth / connect query error codes to founder-friendly copy. */
export function explainCloudConnectorError(code: string, description?: string | null): string {
  const c = code.toLowerCase();
  if (description && description.trim()) return description.trim().slice(0, 200);
  if (c === "access_denied" || c === "user_denied") {
    return "You denied access in the provider consent screen. Click Connect and approve again.";
  }
  if (c.includes("redirect") || c === "redirect_uri_mismatch") {
    return "Redirect URI mismatch — register the exact callback URIs under Operator notes.";
  }
  if (c.includes("scope") || c === "invalid_scope" || c === "consent_required") {
    return "Required scopes were not granted. Reconnect and accept file read + offline access.";
  }
  if (c === "token_exchange") {
    return "Token exchange failed — check client ID/secret and that the redirect URI matches exactly.";
  }
  if (c === "missing_code") {
    return "Provider returned no authorization code. Try Connect again.";
  }
  if (c === "invalid_state") {
    return "OAuth state expired or invalid (15 min). Click Connect again from this tab.";
  }
  if (c === "not_configured" || c === "not_configured_yet") {
    return "OAuth secrets are not set on the worker yet. Expand Operator notes for wrangler secret put …";
  }
  return code.slice(0, 160);
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

export function requestMagicLink(email: string, turnstileToken?: string | null) {
  return jsonFetch<{ ok: true }>("/auth/request", {
    method: "POST",
    body: JSON.stringify({ email, turnstileToken: turnstileToken || undefined }),
  });
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

export type ClientRecord = {
  id: string;
  name: string;
  email: string | null;
  notes: string | null;
  lastContactNote: string | null;
  lastContactAt: string | null;
  createdAt: string;
  updatedAt: string;
  outstandingCount: number;
  outstandingTotal: number;
};

export type AgingInvoiceRecord = {
  id: string;
  clientId: string | null;
  clientName: string;
  amount: number;
  dueDate: string;
  lastChaseStatus: string | null;
  lastChaseAt: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export function listClients() {
  return jsonFetch<{ clients: ClientRecord[] }>("/clients");
}

export function getClient(id: string) {
  return jsonFetch<{ client: ClientRecord; invoices: AgingInvoiceRecord[] }>(`/clients/${id}`);
}

export function createClient(input: { name: string; email?: string; notes?: string }) {
  return jsonFetch<ClientRecord>("/clients", { method: "POST", body: JSON.stringify(input) });
}

export function updateClient(
  id: string,
  input: {
    name?: string;
    email?: string;
    notes?: string;
    lastContactNote?: string;
    clearLastContact?: boolean;
  }
) {
  return jsonFetch<ClientRecord>(`/clients/${id}`, { method: "PUT", body: JSON.stringify(input) });
}

export function deleteClient(id: string) {
  return jsonFetch<{ ok: true }>(`/clients/${id}`, { method: "DELETE" });
}

export function listAging() {
  return jsonFetch<{ invoices: AgingInvoiceRecord[] }>("/aging");
}

export function syncAging(
  invoices: Array<{
    id: string;
    clientName: string;
    amount: number;
    dueDate: string;
    lastChaseStatus?: string | null;
    lastChaseAt?: string | null;
  }>,
  replace = false
) {
  return jsonFetch<{ invoices: AgingInvoiceRecord[]; synced: number }>("/aging/sync", {
    method: "PUT",
    body: JSON.stringify({ invoices, replace }),
  });
}

export function markAgingChase(id: string, status: string) {
  return jsonFetch<{ ok: true; lastChaseStatus: string; lastChaseAt: string }>(
    `/aging/${id}/chase`,
    { method: "PATCH", body: JSON.stringify({ status }) }
  );
}

export function deleteAgingInvoice(id: string) {
  return jsonFetch<{ ok: true }>(`/aging/${id}`, { method: "DELETE" });
}
