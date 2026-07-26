import type { Env } from "../types";
import { generateOpaqueToken, hashOpaqueToken } from "./token";
import { decryptSecret, encryptSecret } from "./secretCrypto";
import {
  extractPdfText,
  isPdfMagic,
  parseInvoiceHints,
  type InvoiceHints,
} from "./pdfInvoiceHints";

export type { InvoiceHints };

const MAX_IMPORT_BYTES = 8 * 1024 * 1024; // 8 MB

export type CloudProvider = "dropbox" | "onedrive" | "box";

export const CLOUD_PROVIDERS: CloudProvider[] = ["dropbox", "onedrive", "box"];

export function isCloudProvider(v: string): v is CloudProvider {
  return (CLOUD_PROVIDERS as string[]).includes(v);
}

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

type ConnectorRow = {
  id: string;
  account_id: string;
  provider: string;
  access_token_enc: string;
  refresh_token_enc: string | null;
  expires_at: string | null;
  external_user_id: string | null;
  external_email: string | null;
  connected_at: string;
};

type TokenBundle = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string | null;
};

function providerConfigured(env: Env, provider: CloudProvider): boolean {
  switch (provider) {
    case "dropbox":
      return !!(env.DROPBOX_CLIENT_ID && env.DROPBOX_CLIENT_SECRET);
    case "onedrive":
      return !!(env.ONEDRIVE_CLIENT_ID && env.ONEDRIVE_CLIENT_SECRET);
    case "box":
      return !!(env.BOX_CLIENT_ID && env.BOX_CLIENT_SECRET);
  }
}

export function redirectUri(env: Env, provider: CloudProvider): string {
  const base = env.PUBLIC_WORKER_URL.replace(/\/$/, "");
  return `${base}/api/account/connectors/${provider}/callback`;
}

export function appConnectorUrl(env: Env, query: Record<string, string>): string {
  const u = new URL("/app/connector", env.PUBLIC_APP_URL);
  for (const [k, v] of Object.entries(query)) u.searchParams.set(k, v);
  return u.toString();
}

/** Signed OAuth state: accountId.expiry.nonce.sig */
export async function createOAuthState(env: Env, accountId: string): Promise<string> {
  const expiry = String(Math.floor(Date.now() / 1000) + 15 * 60);
  const nonce = generateOpaqueToken().slice(0, 16);
  const payload = `${accountId}.${expiry}.${nonce}`;
  const sig = await hashOpaqueToken(payload, env.TOKEN_SECRET);
  return `${payload}.${sig}`;
}

export async function parseOAuthState(
  env: Env,
  state: string
): Promise<{ accountId: string } | null> {
  const parts = state.split(".");
  if (parts.length !== 4) return null;
  const [accountId, expiry, nonce, sig] = parts;
  if (!accountId || !expiry || !nonce || !sig) return null;
  const payload = `${accountId}.${expiry}.${nonce}`;
  const expected = await hashOpaqueToken(payload, env.TOKEN_SECRET);
  if (expected !== sig) return null;
  if (Number(expiry) < Math.floor(Date.now() / 1000)) return null;
  return { accountId };
}

export async function listConnectorStatuses(
  env: Env,
  accountId: string
): Promise<CloudConnectorStatus[]> {
  const rows = await env.CHASA_DB.prepare(
    `SELECT provider, external_email, external_user_id, connected_at
     FROM cloud_connectors WHERE account_id = ?`
  )
    .bind(accountId)
    .all<{
      provider: string;
      external_email: string | null;
      external_user_id: string | null;
      connected_at: string;
    }>();

  const byProvider = new Map((rows.results ?? []).map((r) => [r.provider, r]));

  return CLOUD_PROVIDERS.map((provider) => {
    const row = byProvider.get(provider);
    return {
      provider,
      connected: !!row,
      externalEmail: row?.external_email ?? null,
      externalUserId: row?.external_user_id ?? null,
      connectedAt: row?.connected_at ?? null,
      configured: providerConfigured(env, provider),
    };
  });
}

export function buildAuthorizeUrl(env: Env, provider: CloudProvider, state: string): string | null {
  if (!providerConfigured(env, provider)) return null;
  const redirect = redirectUri(env, provider);

  switch (provider) {
    case "dropbox": {
      const u = new URL("https://www.dropbox.com/oauth2/authorize");
      u.searchParams.set("client_id", env.DROPBOX_CLIENT_ID!);
      u.searchParams.set("response_type", "code");
      u.searchParams.set("redirect_uri", redirect);
      u.searchParams.set("token_access_type", "offline");
      u.searchParams.set("state", state);
      return u.toString();
    }
    case "onedrive": {
      const u = new URL("https://login.microsoftonline.com/common/oauth2/v2.0/authorize");
      u.searchParams.set("client_id", env.ONEDRIVE_CLIENT_ID!);
      u.searchParams.set("response_type", "code");
      u.searchParams.set("redirect_uri", redirect);
      u.searchParams.set("response_mode", "query");
      u.searchParams.set("scope", "offline_access User.Read Files.Read");
      u.searchParams.set("state", state);
      return u.toString();
    }
    case "box": {
      const u = new URL("https://account.box.com/api/oauth2/authorize");
      u.searchParams.set("client_id", env.BOX_CLIENT_ID!);
      u.searchParams.set("response_type", "code");
      u.searchParams.set("redirect_uri", redirect);
      u.searchParams.set("state", state);
      return u.toString();
    }
  }
}

async function exchangeCode(
  env: Env,
  provider: CloudProvider,
  code: string
): Promise<TokenBundle & { externalUserId: string | null; externalEmail: string | null }> {
  const redirect = redirectUri(env, provider);

  if (provider === "dropbox") {
    const body = new URLSearchParams({
      code,
      grant_type: "authorization_code",
      client_id: env.DROPBOX_CLIENT_ID!,
      client_secret: env.DROPBOX_CLIENT_SECRET!,
      redirect_uri: redirect,
    });
    const res = await fetch("https://api.dropboxapi.com/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!res.ok) throw new Error(`Dropbox token exchange failed (${res.status})`);
    const data = (await res.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    };
    const accountRes = await fetch("https://api.dropboxapi.com/2/users/get_current_account", {
      method: "POST",
      headers: { Authorization: `Bearer ${data.access_token}` },
    });
    const account = accountRes.ok
      ? ((await accountRes.json()) as {
          account_id?: string;
          email?: string;
        })
      : null;
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? null,
      expiresAt: data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000).toISOString()
        : null,
      externalUserId: account?.account_id ?? null,
      externalEmail: account?.email ?? null,
    };
  }

  if (provider === "onedrive") {
    const body = new URLSearchParams({
      code,
      grant_type: "authorization_code",
      client_id: env.ONEDRIVE_CLIENT_ID!,
      client_secret: env.ONEDRIVE_CLIENT_SECRET!,
      redirect_uri: redirect,
      scope: "offline_access User.Read Files.Read",
    });
    const res = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!res.ok) throw new Error(`OneDrive token exchange failed (${res.status})`);
    const data = (await res.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    };
    const meRes = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${data.access_token}` },
    });
    const me = meRes.ok
      ? ((await meRes.json()) as { id?: string; mail?: string; userPrincipalName?: string })
      : null;
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? null,
      expiresAt: data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000).toISOString()
        : null,
      externalUserId: me?.id ?? null,
      externalEmail: me?.mail || me?.userPrincipalName || null,
    };
  }

  // box
  const body = new URLSearchParams({
    code,
    grant_type: "authorization_code",
    client_id: env.BOX_CLIENT_ID!,
    client_secret: env.BOX_CLIENT_SECRET!,
    redirect_uri: redirect,
  });
  const res = await fetch("https://api.box.com/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`Box token exchange failed (${res.status})`);
  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };
  const meRes = await fetch("https://api.box.com/2.0/users/me", {
    headers: { Authorization: `Bearer ${data.access_token}` },
  });
  const me = meRes.ok ? ((await meRes.json()) as { id?: string; login?: string }) : null;
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresAt: data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000).toISOString()
      : null,
    externalUserId: me?.id ?? null,
    externalEmail: me?.login ?? null,
  };
}

export async function upsertConnectorFromCode(
  env: Env,
  accountId: string,
  provider: CloudProvider,
  code: string
): Promise<void> {
  const tokens = await exchangeCode(env, provider, code);
  const accessEnc = await encryptSecret(tokens.accessToken, env.TOKEN_SECRET);
  const refreshEnc = tokens.refreshToken
    ? await encryptSecret(tokens.refreshToken, env.TOKEN_SECRET)
    : null;
  const id = crypto.randomUUID();
  const connectedAt = new Date().toISOString();

  await env.CHASA_DB.prepare(
    `INSERT INTO cloud_connectors
      (id, account_id, provider, access_token_enc, refresh_token_enc, expires_at,
       external_user_id, external_email, connected_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(account_id, provider) DO UPDATE SET
       access_token_enc = excluded.access_token_enc,
       refresh_token_enc = excluded.refresh_token_enc,
       expires_at = excluded.expires_at,
       external_user_id = excluded.external_user_id,
       external_email = excluded.external_email,
       connected_at = excluded.connected_at`
  )
    .bind(
      id,
      accountId,
      provider,
      accessEnc,
      refreshEnc,
      tokens.expiresAt,
      tokens.externalUserId,
      tokens.externalEmail,
      connectedAt
    )
    .run();
}

export async function disconnectConnector(
  env: Env,
  accountId: string,
  provider: CloudProvider
): Promise<boolean> {
  const result = await env.CHASA_DB.prepare(
    `DELETE FROM cloud_connectors WHERE account_id = ? AND provider = ?`
  )
    .bind(accountId, provider)
    .run();
  return (result.meta.changes ?? 0) > 0;
}

async function refreshAccessToken(
  env: Env,
  provider: CloudProvider,
  refreshToken: string
): Promise<TokenBundle> {
  if (provider === "dropbox") {
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: env.DROPBOX_CLIENT_ID!,
      client_secret: env.DROPBOX_CLIENT_SECRET!,
    });
    const res = await fetch("https://api.dropboxapi.com/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!res.ok) throw new Error("Dropbox token refresh failed");
    const data = (await res.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    };
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? refreshToken,
      expiresAt: data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000).toISOString()
        : null,
    };
  }

  if (provider === "onedrive") {
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: env.ONEDRIVE_CLIENT_ID!,
      client_secret: env.ONEDRIVE_CLIENT_SECRET!,
      scope: "offline_access User.Read Files.Read",
    });
    const res = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!res.ok) throw new Error("OneDrive token refresh failed");
    const data = (await res.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    };
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? refreshToken,
      expiresAt: data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000).toISOString()
        : null,
    };
  }

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: env.BOX_CLIENT_ID!,
    client_secret: env.BOX_CLIENT_SECRET!,
  });
  const res = await fetch("https://api.box.com/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error("Box token refresh failed");
  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? refreshToken,
    expiresAt: data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000).toISOString()
      : null,
  };
}

async function getValidAccessToken(
  env: Env,
  accountId: string,
  provider: CloudProvider
): Promise<string> {
  const row = await env.CHASA_DB.prepare(
    `SELECT * FROM cloud_connectors WHERE account_id = ? AND provider = ?`
  )
    .bind(accountId, provider)
    .first<ConnectorRow>();

  if (!row) throw new Error("Not connected");

  const accessToken = await decryptSecret(row.access_token_enc, env.TOKEN_SECRET);
  const expiresSoon =
    row.expires_at && new Date(row.expires_at).getTime() < Date.now() + 60_000;

  if (!expiresSoon) return accessToken;
  if (!row.refresh_token_enc) return accessToken;

  const refreshToken = await decryptSecret(row.refresh_token_enc, env.TOKEN_SECRET);
  const refreshed = await refreshAccessToken(env, provider, refreshToken);
  const accessEnc = await encryptSecret(refreshed.accessToken, env.TOKEN_SECRET);
  const refreshEnc = refreshed.refreshToken
    ? await encryptSecret(refreshed.refreshToken, env.TOKEN_SECRET)
    : row.refresh_token_enc;

  await env.CHASA_DB.prepare(
    `UPDATE cloud_connectors
     SET access_token_enc = ?, refresh_token_enc = ?, expires_at = ?
     WHERE account_id = ? AND provider = ?`
  )
    .bind(accessEnc, refreshEnc, refreshed.expiresAt, accountId, provider)
    .run();

  return refreshed.accessToken;
}

function looksLikeInvoicePdf(name: string): boolean {
  const lower = name.toLowerCase();
  return lower.endsWith(".pdf");
}

export async function listRecentFiles(
  env: Env,
  accountId: string,
  provider: CloudProvider
): Promise<CloudFile[]> {
  const accessToken = await getValidAccessToken(env, accountId, provider);

  if (provider === "dropbox") {
    const res = await fetch("https://api.dropboxapi.com/2/files/search_v2", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: ".pdf",
        options: { file_status: "active", max_results: 20, filename_only: true },
      }),
    });
    if (!res.ok) {
      // Fall back to root listing if search isn't available for the app type
      const listRes = await fetch("https://api.dropboxapi.com/2/files/list_folder", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ path: "", limit: 50, recursive: false }),
      });
      if (!listRes.ok) throw new Error("Could not list Dropbox files");
      const listData = (await listRes.json()) as {
        entries?: {
          ".tag"?: string;
          id?: string;
          name?: string;
          path_display?: string;
          size?: number;
          client_modified?: string;
        }[];
      };
      return (listData.entries ?? [])
        .filter((e) => e[".tag"] === "file" && e.name && looksLikeInvoicePdf(e.name))
        .slice(0, 20)
        .map((e) => ({
          id: e.id ?? e.path_display ?? e.name!,
          name: e.name!,
          path: e.path_display ?? null,
          mimeType: "application/pdf",
          size: e.size ?? null,
          modifiedAt: e.client_modified ?? null,
        }));
    }
    const data = (await res.json()) as {
      matches?: {
        metadata?: {
          metadata?: {
            ".tag"?: string;
            id?: string;
            name?: string;
            path_display?: string;
            size?: number;
            client_modified?: string;
          };
        };
      }[];
    };
    return (data.matches ?? [])
      .map((m) => m.metadata?.metadata)
      .filter(
        (m): m is NonNullable<typeof m> =>
          !!m && m[".tag"] === "file" && !!m.name && looksLikeInvoicePdf(m.name)
      )
      .slice(0, 20)
      .map((e) => ({
        id: e.id ?? e.path_display ?? e.name!,
        name: e.name!,
        path: e.path_display ?? null,
        mimeType: "application/pdf",
        size: e.size ?? null,
        modifiedAt: e.client_modified ?? null,
      }));
  }

  if (provider === "onedrive") {
    const res = await fetch(
      "https://graph.microsoft.com/v1.0/me/drive/root/search(q='.pdf')?$top=20&$select=id,name,size,lastModifiedDateTime,file,webUrl",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) throw new Error("Could not list OneDrive files");
    const data = (await res.json()) as {
      value?: {
        id?: string;
        name?: string;
        size?: number;
        lastModifiedDateTime?: string;
        file?: { mimeType?: string };
        webUrl?: string;
      }[];
    };
    return (data.value ?? [])
      .filter((f) => f.name && looksLikeInvoicePdf(f.name))
      .map((f) => ({
        id: f.id ?? f.name!,
        name: f.name!,
        path: f.webUrl ?? null,
        mimeType: f.file?.mimeType ?? "application/pdf",
        size: f.size ?? null,
        modifiedAt: f.lastModifiedDateTime ?? null,
      }));
  }

  // box — root folder items
  const res = await fetch(
    "https://api.box.com/2.0/folders/0/items?limit=50&fields=id,name,size,modified_at,type",
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) throw new Error("Could not list Box files");
  const data = (await res.json()) as {
    entries?: {
      type?: string;
      id?: string;
      name?: string;
      size?: number;
      modified_at?: string;
    }[];
  };
  return (data.entries ?? [])
    .filter((e) => e.type === "file" && e.name && looksLikeInvoicePdf(e.name))
    .slice(0, 20)
    .map((e) => ({
      id: e.id ?? e.name!,
      name: e.name!,
      path: null,
      mimeType: "application/pdf",
      size: e.size ?? null,
      modifiedAt: e.modified_at ?? null,
    }));
}

export type CloudFileImportResult = {
  file: CloudFile;
  hints: InvoiceHints;
  textPreview: string;
  extractedChars: number;
};

async function downloadFileBytes(
  env: Env,
  accountId: string,
  provider: CloudProvider,
  fileId: string,
  path: string | null
): Promise<{ bytes: ArrayBuffer; meta: CloudFile }> {
  const accessToken = await getValidAccessToken(env, accountId, provider);

  if (provider === "dropbox") {
    const dropboxPath = path || fileId;
    if (!dropboxPath) throw new Error("Missing Dropbox file path");
    const res = await fetch("https://content.dropboxapi.com/2/files/download", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Dropbox-API-Arg": JSON.stringify({ path: dropboxPath }),
      },
    });
    if (!res.ok) throw new Error(`Could not download Dropbox file (${res.status})`);
    const apiMeta = res.headers.get("Dropbox-API-Result");
    let name = "invoice.pdf";
    let size: number | null = null;
    let modifiedAt: string | null = null;
    let resolvedPath: string | null = path;
    let resolvedId = fileId;
    if (apiMeta) {
      try {
        const meta = JSON.parse(apiMeta) as {
          name?: string;
          size?: number;
          client_modified?: string;
          path_display?: string;
          id?: string;
        };
        name = meta.name ?? name;
        size = meta.size ?? null;
        modifiedAt = meta.client_modified ?? null;
        resolvedPath = meta.path_display ?? path;
        if (meta.id) resolvedId = meta.id;
      } catch {
        /* ignore malformed header */
      }
    }
    const bytes = await res.arrayBuffer();
    if (bytes.byteLength > MAX_IMPORT_BYTES) {
      throw new Error(`File too large (max ${MAX_IMPORT_BYTES / (1024 * 1024)} MB)`);
    }
    return {
      bytes,
      meta: {
        id: resolvedId,
        name,
        path: resolvedPath,
        mimeType: "application/pdf",
        size: size ?? bytes.byteLength,
        modifiedAt,
      },
    };
  }

  if (provider === "onedrive") {
    const metaRes = await fetch(
      `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(fileId)}?$select=id,name,size,lastModifiedDateTime,file,webUrl`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!metaRes.ok) throw new Error(`Could not read OneDrive file (${metaRes.status})`);
    const meta = (await metaRes.json()) as {
      id?: string;
      name?: string;
      size?: number;
      lastModifiedDateTime?: string;
      file?: { mimeType?: string };
      webUrl?: string;
    };
    if (meta.size != null && meta.size > MAX_IMPORT_BYTES) {
      throw new Error(`File too large (max ${MAX_IMPORT_BYTES / (1024 * 1024)} MB)`);
    }
    const res = await fetch(
      `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(fileId)}/content`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) throw new Error(`Could not download OneDrive file (${res.status})`);
    const bytes = await res.arrayBuffer();
    if (bytes.byteLength > MAX_IMPORT_BYTES) {
      throw new Error(`File too large (max ${MAX_IMPORT_BYTES / (1024 * 1024)} MB)`);
    }
    return {
      bytes,
      meta: {
        id: meta.id ?? fileId,
        name: meta.name ?? "invoice.pdf",
        path: meta.webUrl ?? path,
        mimeType: meta.file?.mimeType ?? "application/pdf",
        size: meta.size ?? bytes.byteLength,
        modifiedAt: meta.lastModifiedDateTime ?? null,
      },
    };
  }

  // box
  const metaRes = await fetch(
    `https://api.box.com/2.0/files/${encodeURIComponent(fileId)}?fields=id,name,size,modified_at`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!metaRes.ok) throw new Error(`Could not read Box file (${metaRes.status})`);
  const meta = (await metaRes.json()) as {
    id?: string;
    name?: string;
    size?: number;
    modified_at?: string;
  };
  if (meta.size != null && meta.size > MAX_IMPORT_BYTES) {
    throw new Error(`File too large (max ${MAX_IMPORT_BYTES / (1024 * 1024)} MB)`);
  }
  const res = await fetch(
    `https://api.box.com/2.0/files/${encodeURIComponent(fileId)}/content`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) throw new Error(`Could not download Box file (${res.status})`);
  const bytes = await res.arrayBuffer();
  if (bytes.byteLength > MAX_IMPORT_BYTES) {
    throw new Error(`File too large (max ${MAX_IMPORT_BYTES / (1024 * 1024)} MB)`);
  }
  return {
    bytes,
    meta: {
      id: meta.id ?? fileId,
      name: meta.name ?? "invoice.pdf",
      path: null,
      mimeType: "application/pdf",
      size: meta.size ?? bytes.byteLength,
      modifiedAt: meta.modified_at ?? null,
    },
  };
}

/**
 * Download a connected PDF, scrape text, and return invoice field hints for the Tool.
 * Never returns raw PDF bytes or OAuth tokens to the client.
 */
export async function importCloudPdf(
  env: Env,
  accountId: string,
  provider: CloudProvider,
  fileId: string,
  path: string | null = null
): Promise<CloudFileImportResult> {
  if (!fileId?.trim()) throw new Error("Missing file id");
  const { bytes, meta } = await downloadFileBytes(env, accountId, provider, fileId.trim(), path);
  if (!looksLikeInvoicePdf(meta.name)) {
    throw new Error("Only PDF files can be imported");
  }
  if (bytes.byteLength === 0) {
    throw new Error("Downloaded file was empty");
  }
  if (!isPdfMagic(bytes)) {
    throw new Error("File does not look like a PDF (corrupt or wrong type)");
  }
  const text = extractPdfText(bytes);
  const hints = parseInvoiceHints(meta.name, text);
  const textPreview = text.slice(0, 2500);
  return {
    file: meta,
    hints,
    textPreview,
    extractedChars: text.length,
  };
}
