import { Hono } from "hono";
import type { AuthEnv } from "../lib/auth";
import { trackEvent } from "../lib/analytics";
import { sendTemplatesPackWelcomeEmail, sendContactInquiryEmail } from "../lib/email";
import { detectLocaleFromHeader, normalizeLocale } from "../lib/locale";
import {
  markWelcomeSent,
  unsubscribeByToken,
  upsertTemplatesPackLead,
} from "../lib/leads";
import { checkRateLimit, clientIpFromHeaders } from "../lib/rateLimit";
import { parseJsonBody, templatesPackLeadSchema, contactLeadSchema } from "../lib/schemas";
import { configuredAppOrigin, requestAppOrigin } from "../lib/appUrl";
import { clientIp, turnstileSiteKey, verifyTurnstile } from "../lib/turnstile";

const leads = new Hono<AuthEnv>();

const PDF_PATH = "/free-templates/chasa-polite-invoice-templates.pdf";

leads.get("/config", (c) => {
  return c.json({
    turnstileSiteKey: turnstileSiteKey(c.env),
    turnstileRequired: Boolean(c.env.TURNSTILE_SECRET_KEY?.trim()),
    pdfPath: PDF_PATH,
  });
});

leads.post("/contact", async (c) => {
  const parsed = await parseJsonBody(c.req, contactLeadSchema);
  if (!parsed.ok) return c.json({ error: parsed.error }, 400);

  const ip = clientIp(c) || clientIpFromHeaders(c.req.raw.headers);
  const rl = await checkRateLimit(c.env, `leads:contact:${ip}`, 6, 3600);
  if (!rl.ok) {
    return c.json({ error: "Too many requests. Try again later." }, 429);
  }

  try {
    await sendContactInquiryEmail(c.env, parsed.data.email, parsed.data.message);
  } catch (err) {
    console.error("[leads] contact inquiry failed", err);
    return c.json({ error: "Could not send your message. Try emailing sales@chasa.io." }, 502);
  }

  return c.json({ ok: true });
});

leads.post("/templates-pack", async (c) => {
  const parsed = await parseJsonBody(c.req, templatesPackLeadSchema);
  if (!parsed.ok) return c.json({ error: parsed.error }, 400);

  const ip = clientIp(c) || clientIpFromHeaders(c.req.raw.headers);
  const rl = await checkRateLimit(c.env, `leads:pack:${ip}`, 8, 3600);
  if (!rl.ok) {
    return c.json({ error: "Too many requests. Try again later." }, 429);
  }

  const check = await verifyTurnstile(c.env, parsed.data.turnstileToken, ip);
  if (!check.ok) return c.json({ error: check.error }, 400);

  const { lead, isNew, resubscribed } = await upsertTemplatesPackLead(c.env, parsed.data.email, {
    firstName: parsed.data.firstName,
    role: parsed.data.role,
    invoiceTool: parsed.data.invoiceTool,
  });
  const appOrigin = requestAppOrigin(c) || configuredAppOrigin(c.env);
  const downloadUrl = `${appOrigin.replace(/\/$/, "")}${PDF_PATH}`;
  const workerBase = (c.env.PUBLIC_WORKER_URL || "https://api.chasa.io").replace(/\/$/, "");
  const unsubUrl = `${workerBase}/api/leads/unsubscribe?token=${encodeURIComponent(lead.unsub_token)}`;

  // Welcome on first download, if never sent, or if they re-subscribe after unsubscribing.
  const shouldSend = isNew || !lead.welcome_sent_at || resubscribed;
  if (shouldSend) {
    const locale = parsed.data.lang
      ? normalizeLocale(parsed.data.lang)
      : detectLocaleFromHeader(c.req.header("Accept-Language"));
    c.executionCtx.waitUntil(
      (async () => {
        await sendTemplatesPackWelcomeEmail(
          c.env,
          lead.email,
          {
            downloadUrl,
            unsubUrl,
            firstName: lead.first_name,
          },
          locale
        );
        await markWelcomeSent(c.env, lead.id);
      })().catch((err) => console.error("[leads] welcome email failed", err))
    );
  }

  c.executionCtx.waitUntil(
    trackEvent(c.env, {
      name: "templates_pack_subscribed",
      properties: { source: "templates-pdf", isNew },
      path: "/api/leads/templates-pack",
    }).catch(() => {})
  );

  return c.json({
    ok: true,
    downloadUrl,
    welcomeEmail: shouldSend,
  });
});

leads.get("/unsubscribe", async (c) => {
  const token = c.req.query("token")?.trim();
  const appOrigin = configuredAppOrigin(c.env);
  if (!token) {
    return c.redirect(`${appOrigin}/free-templates/?unsub=missing`);
  }
  const result = await unsubscribeByToken(c.env, token);
  if (result === "missing") {
    return c.redirect(`${appOrigin}/free-templates/?unsub=missing`);
  }
  return c.html(`<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Unsubscribed — Chasa</title>
<link rel="stylesheet" href="${appOrigin}/site.css">
</head><body>
<main class="wrap page-main" style="padding-top:48px">
  <h1>You're unsubscribed</h1>
  <p class="lede">We won't send further template-pack emails to this address. You can still use the free templates on the site anytime.</p>
  <p><a class="nav-cta" href="${appOrigin}/free-templates/">Back to free templates</a></p>
</main>
</body></html>`);
});

export default leads;
