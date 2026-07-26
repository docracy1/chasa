import type { Env } from "../types";
import { decryptSecret, encryptSecret } from "./secretCrypto";
import { createOAuthState, parseOAuthState } from "./cloudConnectors";

export type AccountingProvider = "quickbooks" | "xero";

export const ACCOUNTING_PROVIDERS: AccountingProvider[] = ["quickbooks", "xero"];

export function isAccountingProvider(v: string): v is AccountingProvider {
  return (ACCOUNTING_PROVIDERS as string[]).includes(v);
}

export { createOAuthState as createAccountingOAuthState, parseOAuthState as parseAccountingOAuthState };

export type AccountingConnectorStatus = {
  provider: AccountingProvider;
  connected: boolean;
  externalEmail: string | null;
  realmId: string | null;
  connectedAt: string | null;
  configured: boolean;
};

export type OverdueInvoice = {
  externalId: string;
  clientName: string;
  amount: number;
  dueDate: string;
  currency: string | null;
};

function providerConfigured(env: Env, provider: AccountingProvider): boolean {
  if (provider === "quickbooks") return !!(env.QBO_CLIENT_ID && env.QBO_CLIENT_SECRET);
  return !!(env.XERO_CLIENT_ID && env.XERO_CLIENT_SECRET);
}

export function accountingRedirectUri(env: Env, provider: AccountingProvider): string {
  const base = env.PUBLIC_WORKER_URL.replace(/\/$/, "");
  return `${base}/api/account/connectors/${provider}/callback`;
}

export function appAccountingUrl(env: Env, query: Record<string, string>): string {
  const u = new URL("/app/connector", env.PUBLIC_APP_URL);
  for (const [k, v] of Object.entries(query)) u.searchParams.set(k, v);
  return u.toString();
}

export function buildAccountingAuthorizeUrl(
  env: Env,
  provider: AccountingProvider,
  state: string
): string | null {
  if (!providerConfigured(env, provider)) return null;
  const redirect = accountingRedirectUri(env, provider);
  if (provider === "quickbooks") {
    const u = new URL("https://appcenter.intuit.com/connect/oauth2");
    u.searchParams.set("client_id", env.QBO_CLIENT_ID!);
    u.searchParams.set("redirect_uri", redirect);
    u.searchParams.set("response_type", "code");
    u.searchParams.set("scope", "com.intuit.quickbooks.accounting");
    u.searchParams.set("state", state);
    return u.toString();
  }
  const u = new URL("https://login.xero.com/identity/connect/authorize");
  u.searchParams.set("response_type", "code");
  u.searchParams.set("client_id", env.XERO_CLIENT_ID!);
  u.searchParams.set("redirect_uri", redirect);
  u.searchParams.set("scope", "openid profile email accounting.transactions.read accounting.contacts.read offline_access");
  u.searchParams.set("state", state);
  return u.toString();
}

type ConnectorRow = {
  id: string;
  access_token_enc: string;
  refresh_token_enc: string | null;
  expires_at: string | null;
  realm_id: string | null;
  external_email: string | null;
  connected_at: string;
};

export async function listAccountingStatuses(
  env: Env,
  accountId: string
): Promise<AccountingConnectorStatus[]> {
  const { results } = await env.CHASA_DB.prepare(
    `SELECT provider, external_email, realm_id, connected_at FROM accounting_connectors WHERE account_id = ?`
  )
    .bind(accountId)
    .all<{
      provider: string;
      external_email: string | null;
      realm_id: string | null;
      connected_at: string;
    }>();

  const byProvider = new Map((results ?? []).map((r) => [r.provider, r]));
  return ACCOUNTING_PROVIDERS.map((provider) => {
    const row = byProvider.get(provider);
    return {
      provider,
      connected: !!row,
      externalEmail: row?.external_email ?? null,
      realmId: row?.realm_id ?? null,
      connectedAt: row?.connected_at ?? null,
      configured: providerConfigured(env, provider),
    };
  });
}

export async function upsertAccountingFromCode(
  env: Env,
  accountId: string,
  provider: AccountingProvider,
  code: string,
  realmIdHint?: string | null
): Promise<void> {
  if (!providerConfigured(env, provider)) throw new Error("not_configured");

  if (provider === "quickbooks") {
    const tokenRes = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${env.QBO_CLIENT_ID}:${env.QBO_CLIENT_SECRET}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: accountingRedirectUri(env, provider),
      }),
    });
    if (!tokenRes.ok) throw new Error(`token_exchange:${tokenRes.status}`);
    const tokens = (await tokenRes.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    };
    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : null;
    await saveConnector(env, accountId, provider, {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? null,
      expiresAt,
      realmId: realmIdHint ?? null,
      externalEmail: null,
    });
    return;
  }

  // Xero
  const tokenRes = await fetch("https://identity.xero.com/connect/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${env.XERO_CLIENT_ID}:${env.XERO_CLIENT_SECRET}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: accountingRedirectUri(env, provider),
    }),
  });
  if (!tokenRes.ok) throw new Error(`token_exchange:${tokenRes.status}`);
  const tokens = (await tokenRes.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };

  let tenantId: string | null = null;
  let externalEmail: string | null = null;
  try {
    const connRes = await fetch("https://api.xero.com/connections", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (connRes.ok) {
      const conns = (await connRes.json()) as Array<{ tenantId?: string }>;
      tenantId = conns[0]?.tenantId ?? null;
    }
  } catch {
    /* ignore */
  }

  const expiresAt = tokens.expires_in
    ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
    : null;
  await saveConnector(env, accountId, provider, {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? null,
    expiresAt,
    realmId: tenantId,
    externalEmail,
  });
}

async function saveConnector(
  env: Env,
  accountId: string,
  provider: AccountingProvider,
  data: {
    accessToken: string;
    refreshToken: string | null;
    expiresAt: string | null;
    realmId: string | null;
    externalEmail: string | null;
  }
) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const accessEnc = await encryptSecret(data.accessToken, env.TOKEN_SECRET);
  const refreshEnc = data.refreshToken
    ? await encryptSecret(data.refreshToken, env.TOKEN_SECRET)
    : null;

  await env.CHASA_DB.prepare(
    `INSERT INTO accounting_connectors
       (id, account_id, provider, access_token_enc, refresh_token_enc, expires_at, realm_id, external_email, connected_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(account_id, provider) DO UPDATE SET
       access_token_enc = excluded.access_token_enc,
       refresh_token_enc = excluded.refresh_token_enc,
       expires_at = excluded.expires_at,
       realm_id = COALESCE(excluded.realm_id, accounting_connectors.realm_id),
       external_email = COALESCE(excluded.external_email, accounting_connectors.external_email),
       connected_at = excluded.connected_at`
  )
    .bind(
      id,
      accountId,
      provider,
      accessEnc,
      refreshEnc,
      data.expiresAt,
      data.realmId,
      data.externalEmail,
      now
    )
    .run();
}

async function loadConnector(
  env: Env,
  accountId: string,
  provider: AccountingProvider
): Promise<ConnectorRow | null> {
  return (
    (await env.CHASA_DB.prepare(
      `SELECT id, access_token_enc, refresh_token_enc, expires_at, realm_id, external_email, connected_at
       FROM accounting_connectors WHERE account_id = ? AND provider = ?`
    )
      .bind(accountId, provider)
      .first<ConnectorRow>()) ?? null
  );
}

async function getValidAccessToken(
  env: Env,
  accountId: string,
  provider: AccountingProvider
): Promise<{ accessToken: string; realmId: string | null }> {
  const row = await loadConnector(env, accountId, provider);
  if (!row) throw new Error("not_connected");

  let accessToken = await decryptSecret(row.access_token_enc, env.TOKEN_SECRET);
  const expiresSoon =
    row.expires_at && new Date(row.expires_at).getTime() < Date.now() + 60_000;

  if (expiresSoon && row.refresh_token_enc) {
    const refreshToken = await decryptSecret(row.refresh_token_enc, env.TOKEN_SECRET);
    if (provider === "quickbooks") {
      const tokenRes = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa(`${env.QBO_CLIENT_ID}:${env.QBO_CLIENT_SECRET}`)}`,
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: refreshToken,
        }),
      });
      if (tokenRes.ok) {
        const tokens = (await tokenRes.json()) as {
          access_token: string;
          refresh_token?: string;
          expires_in?: number;
        };
        accessToken = tokens.access_token;
        await saveConnector(env, accountId, provider, {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token ?? refreshToken,
          expiresAt: tokens.expires_in
            ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
            : null,
          realmId: row.realm_id,
          externalEmail: row.external_email,
        });
      }
    } else {
      const tokenRes = await fetch("https://identity.xero.com/connect/token", {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa(`${env.XERO_CLIENT_ID}:${env.XERO_CLIENT_SECRET}`)}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: refreshToken,
        }),
      });
      if (tokenRes.ok) {
        const tokens = (await tokenRes.json()) as {
          access_token: string;
          refresh_token?: string;
          expires_in?: number;
        };
        accessToken = tokens.access_token;
        await saveConnector(env, accountId, provider, {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token ?? refreshToken,
          expiresAt: tokens.expires_in
            ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
            : null,
          realmId: row.realm_id,
          externalEmail: row.external_email,
        });
      }
    }
  }

  return { accessToken, realmId: row.realm_id };
}

export async function disconnectAccounting(
  env: Env,
  accountId: string,
  provider: AccountingProvider
): Promise<boolean> {
  const result = await env.CHASA_DB.prepare(
    `DELETE FROM accounting_connectors WHERE account_id = ? AND provider = ?`
  )
    .bind(accountId, provider)
    .run();
  return (result.meta.changes ?? 0) > 0;
}

export async function fetchOverdueInvoices(
  env: Env,
  accountId: string,
  provider: AccountingProvider
): Promise<OverdueInvoice[]> {
  const { accessToken, realmId } = await getValidAccessToken(env, accountId, provider);
  const today = new Date().toISOString().slice(0, 10);

  if (provider === "quickbooks") {
    if (!realmId) throw new Error("Missing QuickBooks company id — reconnect.");
    const query = encodeURIComponent(
      `SELECT * FROM Invoice WHERE Balance > '0' AND DueDate <= '${today}' MAXRESULTS 50`
    );
    const res = await fetch(
      `https://quickbooks.api.intuit.com/v3/company/${realmId}/query?query=${query}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
      }
    );
    if (!res.ok) throw new Error(`QuickBooks query failed (${res.status})`);
    const data = (await res.json()) as {
      QueryResponse?: {
        Invoice?: Array<{
          Id?: string;
          DocNumber?: string;
          Balance?: number;
          DueDate?: string;
          CustomerRef?: { name?: string };
          CurrencyRef?: { value?: string };
        }>;
      };
    };
    const invoices = data.QueryResponse?.Invoice ?? [];
    const out: OverdueInvoice[] = [];
    for (const inv of invoices) {
      const dueDate = inv.DueDate?.slice(0, 10);
      const amount = Number(inv.Balance);
      const clientName = inv.CustomerRef?.name?.trim();
      if (!dueDate || !Number.isFinite(amount) || amount <= 0 || !clientName) continue;
      out.push({
        externalId: inv.Id || inv.DocNumber || crypto.randomUUID(),
        clientName,
        amount,
        dueDate,
        currency: inv.CurrencyRef?.value ?? null,
      });
    }
    return out;
  }

  // Xero — unpaid invoices past due
  if (!realmId) throw new Error("Missing Xero tenant — reconnect.");
  const res = await fetch(
    `https://api.xero.com/api.xro/2.0/Invoices?Statuses=AUTHORISED&where=${encodeURIComponent(
      `AmountDue>0 AND DueDate<=DateTime(${today.slice(0, 4)},${today.slice(5, 7)},${today.slice(8, 10)})`
    )}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Xero-tenant-id": realmId,
        Accept: "application/json",
      },
    }
  );
  if (!res.ok) {
    // Fallback simpler list if where clause fails
    const fallback = await fetch(
      "https://api.xero.com/api.xro/2.0/Invoices?Statuses=AUTHORISED&page=1",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Xero-tenant-id": realmId,
          Accept: "application/json",
        },
      }
    );
    if (!fallback.ok) throw new Error(`Xero invoices failed (${res.status})`);
    const data = (await fallback.json()) as {
      Invoices?: Array<{
        InvoiceID?: string;
        Contact?: { Name?: string };
        AmountDue?: number;
        DueDateString?: string;
        DueDate?: string;
        CurrencyCode?: string;
      }>;
    };
    return filterXeroOverdue(data.Invoices ?? [], today);
  }
  const data = (await res.json()) as {
    Invoices?: Array<{
      InvoiceID?: string;
      Contact?: { Name?: string };
      AmountDue?: number;
      DueDateString?: string;
      DueDate?: string;
      CurrencyCode?: string;
    }>;
  };
  return filterXeroOverdue(data.Invoices ?? [], today);
}

function filterXeroOverdue(
  invoices: Array<{
    InvoiceID?: string;
    Contact?: { Name?: string };
    AmountDue?: number;
    DueDateString?: string;
    DueDate?: string;
    CurrencyCode?: string;
  }>,
  today: string
): OverdueInvoice[] {
  const out: OverdueInvoice[] = [];
  for (const inv of invoices) {
    const dueDate = (inv.DueDateString || inv.DueDate || "").slice(0, 10);
    const amount = Number(inv.AmountDue);
    const clientName = inv.Contact?.Name?.trim();
    if (!dueDate || dueDate > today || !Number.isFinite(amount) || amount <= 0 || !clientName) {
      continue;
    }
    out.push({
      externalId: inv.InvoiceID || crypto.randomUUID(),
      clientName,
      amount,
      dueDate,
      currency: inv.CurrencyCode ?? null,
    });
  }
  return out.slice(0, 50);
}
