import { Hono, type Context } from "hono";
import { requirePaidAccount, type AuthEnv } from "../lib/auth";
import {
  appConnectorUrl,
  buildAuthorizeUrl,
  createOAuthState,
  disconnectConnector,
  importCloudPdf,
  isCloudProvider,
  listConnectorStatuses,
  listRecentFiles,
  parseOAuthState,
  upsertConnectorFromCode,
  type CloudProvider,
} from "../lib/cloudConnectors";

/**
 * Cloud storage OAuth connectors (Dropbox / OneDrive / Box).
 *
 * Redirect URIs (register these in each provider console — Chasa's apps, not end-user apps):
 *   https://api.chasa.io/api/account/connectors/dropbox/callback
 *   https://api.chasa.io/api/account/connectors/onedrive/callback
 *   https://api.chasa.io/api/account/connectors/box/callback
 *
 * Secrets (wrangler secret put …):
 *   DROPBOX_CLIENT_ID, DROPBOX_CLIENT_SECRET
 *   ONEDRIVE_CLIENT_ID, ONEDRIVE_CLIENT_SECRET
 *   BOX_CLIENT_ID, BOX_CLIENT_SECRET
 * OAuth state + token encryption reuse TOKEN_SECRET.
 */
const cloudConnectors = new Hono<AuthEnv>();

async function handleCallback(c: Context<AuthEnv>, provider: CloudProvider) {
  const err = c.req.query("error");
  if (err) {
    return c.redirect(
      appConnectorUrl(c.env, { cloud: provider, error: err.slice(0, 80) }),
      302
    );
  }
  const code = c.req.query("code");
  const state = c.req.query("state");
  if (!code || !state) {
    return c.redirect(appConnectorUrl(c.env, { cloud: provider, error: "missing_code" }), 302);
  }
  const parsed = await parseOAuthState(c.env, state);
  if (!parsed) {
    return c.redirect(appConnectorUrl(c.env, { cloud: provider, error: "invalid_state" }), 302);
  }
  try {
    await upsertConnectorFromCode(c.env, parsed.accountId, provider, code);
  } catch {
    return c.redirect(appConnectorUrl(c.env, { cloud: provider, error: "token_exchange" }), 302);
  }
  return c.redirect(appConnectorUrl(c.env, { cloud: provider, connected: "1" }), 302);
}

cloudConnectors.get("/", requirePaidAccount, async (c) => {
  const acc = c.get("account")!;
  const connectors = await listConnectorStatuses(c.env, acc.id);
  return c.json({ connectors });
});

// Register callbacks before parameterized routes
cloudConnectors.get("/dropbox/callback", (c) => handleCallback(c, "dropbox"));
cloudConnectors.get("/onedrive/callback", (c) => handleCallback(c, "onedrive"));
cloudConnectors.get("/box/callback", (c) => handleCallback(c, "box"));

cloudConnectors.get("/:provider/connect", requirePaidAccount, async (c) => {
  const providerParam = c.req.param("provider");
  if (!isCloudProvider(providerParam)) {
    return c.json({ error: "Unknown provider" }, 404);
  }
  const provider = providerParam as CloudProvider;
  const acc = c.get("account")!;
  const authorizeUrl = buildAuthorizeUrl(c.env, provider, await createOAuthState(c.env, acc.id));
  if (!authorizeUrl) {
    return c.json(
      {
        error: `${provider} is not configured yet. Set the client ID/secret secrets on the worker.`,
      },
      503
    );
  }
  return c.redirect(authorizeUrl, 302);
});

cloudConnectors.delete("/:provider", requirePaidAccount, async (c) => {
  const providerParam = c.req.param("provider");
  if (!isCloudProvider(providerParam)) {
    return c.json({ error: "Unknown provider" }, 404);
  }
  const acc = c.get("account")!;
  const ok = await disconnectConnector(c.env, acc.id, providerParam);
  if (!ok) return c.json({ error: "Not connected" }, 404);
  return c.json({ ok: true });
});

/** List recent PDF files from connected cloud storage. */
cloudConnectors.get("/:provider/files", requirePaidAccount, async (c) => {
  const providerParam = c.req.param("provider");
  if (!isCloudProvider(providerParam)) {
    return c.json({ error: "Unknown provider" }, 404);
  }
  try {
    const files = await listRecentFiles(c.env, c.get("account")!.id, providerParam);
    return c.json({ files });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not list files";
    if (msg === "Not connected") return c.json({ error: msg }, 404);
    return c.json({ error: msg }, 502);
  }
});

/**
 * Download a PDF via stored OAuth tokens, scrape text, return invoice hints for the Tool.
 * Body: { id: string, path?: string | null }
 * Does not return raw PDF bytes or tokens.
 */
cloudConnectors.post("/:provider/files/import", requirePaidAccount, async (c) => {
  const providerParam = c.req.param("provider");
  if (!isCloudProvider(providerParam)) {
    return c.json({ error: "Unknown provider" }, 404);
  }
  let body: { id?: string; path?: string | null };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  if (!body?.id || typeof body.id !== "string") {
    return c.json({ error: "id is required" }, 400);
  }
  const path = typeof body.path === "string" ? body.path : null;
  try {
    const result = await importCloudPdf(
      c.env,
      c.get("account")!.id,
      providerParam,
      body.id,
      path
    );
    return c.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not import file";
    if (msg === "Not connected") return c.json({ error: msg }, 404);
    if (msg.startsWith("File too large") || msg.startsWith("Only PDF") || msg.startsWith("Missing")) {
      return c.json({ error: msg }, 400);
    }
    return c.json({ error: msg }, 502);
  }
});

export default cloudConnectors;
