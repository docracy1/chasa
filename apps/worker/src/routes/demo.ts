import { Hono } from "hono";
import type { AuthEnv } from "../lib/auth";
import { generateFollowUpEmail } from "../lib/ai";
import { trackEvent } from "../lib/analytics";
import { checkRateLimit, clientIpFromHeaders } from "../lib/rateLimit";
import { clampOptionalString } from "../lib/validate";
import { clientIp } from "../lib/turnstile";
import { demoDraftSchema, parseJsonBody } from "../lib/schemas";

const demo = new Hono<AuthEnv>();

// Public marketing-site sandbox — no account, no invoice storage. Deliberately a separate rate
// limit bucket from ai_draft:${ip} so trying the demo never eats into someone's real free-tier
// quota before they've even signed up.
demo.post("/draft", async (c) => {
  const parsed = await parseJsonBody(c.req, demoDraftSchema);
  if (!parsed.ok) return c.json({ error: parsed.error }, 400);
  const body = parsed.data;

  const ip = clientIp(c) || clientIpFromHeaders({ get: (n) => c.req.header(n) ?? null });
  const rl = await checkRateLimit(c.env, `demo_draft:${ip}`, 10, 3600);
  if (!rl.ok) {
    return c.json({ error: "Too many tries — sign up free to keep going." }, 429);
  }

  const clientName = clampOptionalString(body.client_name, 80) || "Acme Co";
  const invoiceAmount = body.invoice_amount ?? 450;
  const daysOverdue = Math.max(0, Math.min(120, body.days_overdue));

  try {
    const draft = await generateFollowUpEmail(c.env, {
      clientName,
      invoiceAmount,
      daysOverdue,
    });
    await trackEvent(c.env, {
      name: "demo_draft_generated",
      properties: { daysOverdue },
      path: "/api/demo/draft",
      userAgent: c.req.header("User-Agent") ?? null,
    }).catch(() => {});
    return c.json(draft);
  } catch (err) {
    console.error("[demo] draft generation failed", err);
    return c.json({ error: "Couldn't generate a draft just now. Try again in a moment." }, 502);
  }
});

export default demo;
