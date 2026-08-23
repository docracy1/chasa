import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import type { AuthEnv } from "../lib/auth";
import { SESSION_COOKIE_NAME, resolveAccount } from "../lib/auth";
import {
  getApprovedBySlug,
  listApproved,
  submitTemplate,
  type TemplateType,
} from "../lib/marketplaceTemplates";
import { getKitBySlug, listKits } from "../lib/templateKits";
import { checkRateLimit, clientIpFromHeaders } from "../lib/rateLimit";
import { clientIp, verifyTurnstile } from "../lib/turnstile";
import { marketplaceSubmitSchema, parseJsonBody } from "../lib/schemas";

const marketplace = new Hono<AuthEnv>();

/** Public browse — no auth. Optional ?category= filter matches the static catalog's category
 *  names; optional ?type=email|document narrows to one template kind. */
marketplace.get("/", async (c) => {
  const category = c.req.query("category") || null;
  const typeParam = c.req.query("type");
  const templateType: TemplateType | null = typeParam === "email" || typeParam === "document" ? typeParam : null;
  const rows = await listApproved(c.env, category, templateType);
  return c.json({ templates: rows });
});

marketplace.get("/kits", async (c) => {
  const kits = await listKits(c.env);
  return c.json({ kits });
});

marketplace.get("/kits/:slug", async (c) => {
  const result = await getKitBySlug(c.env, c.req.param("slug"));
  if (!result) return c.json({ error: "Not found" }, 404);
  return c.json(result);
});

marketplace.get("/:slug", async (c) => {
  const template = await getApprovedBySlug(c.env, c.req.param("slug"));
  if (!template) return c.json({ error: "Not found" }, 404);
  return c.json({ template });
});

/** Open to signed-in and anonymous submitters alike — the free-templates page itself sets no
 *  signup bar, so the submission form shouldn't either. Every row lands 'pending'; nothing here
 *  can publish without an admin's explicit approve (see routes/admin.ts). */
marketplace.post("/submit", async (c) => {
  const ip = clientIp(c) || clientIpFromHeaders({ get: (n) => c.req.header(n) ?? null });
  const rl = await checkRateLimit(c.env, `marketplace_submit:${ip}`, 3, 3600);
  if (!rl.ok) {
    return c.json({ error: "Too many submissions from this address. Try again later." }, 429);
  }

  const parsed = await parseJsonBody(c.req, marketplaceSubmitSchema);
  if (!parsed.ok) return c.json({ error: parsed.error }, 400);
  const body = parsed.data;

  const check = await verifyTurnstile(c.env, body.turnstileToken, ip);
  if (!check.ok) return c.json({ error: check.error }, 400);

  let accountId: string | null = null;
  const sessionToken = getCookie(c, SESSION_COOKIE_NAME);
  if (sessionToken) {
    const account = await resolveAccount(c.env, sessionToken);
    accountId = account?.id ?? null;
  }

  const result = await submitTemplate(c.env, accountId, {
    name: body.name,
    description: body.description ?? "",
    stage: body.stage ?? "",
    tone: body.tone ?? "",
    category: body.category ?? "",
    templateType: body.templateType,
    subject: body.subject ?? "",
    body: body.body ?? "",
    bodyMarkdown: body.bodyMarkdown ?? null,
    tags: body.tags ?? [],
    submitterName: body.submitterName ?? null,
    submitterUrl: body.submitterUrl ?? null,
    submitterEmail: body.submitterEmail ?? null,
  });

  if (!result.ok) return c.json({ error: result.error }, 400);
  return c.json({ ok: true, slug: result.slug });
});

export default marketplace;
