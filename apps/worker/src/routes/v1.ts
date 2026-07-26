import { Hono } from "hono";
import type { AuthEnv } from "../lib/auth";
import { requirePaidApiOrSession } from "../lib/apiKeys";
import { generateFollowUpEmail, getToneBand } from "../lib/ai";
import { dispatchWebhooks } from "../lib/webhooks";

/**
 * Public HTTP API for Zapier / Make / US accounting automation.
 * Auth: Authorization: Bearer chasa_…
 *
 * POST /api/v1/chase/draft
 * { client_name, invoice_amount, days_overdue? | due_date? }
 */
const v1 = new Hono<AuthEnv>();

function daysFromDueDate(dueDate: string): number | null {
  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) return null;
  const now = new Date();
  const ms = now.setHours(0, 0, 0, 0) - due.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)));
}

v1.post("/chase/draft", requirePaidApiOrSession, async (c) => {
  const acc = c.get("account")!;
  const body = (await c.req.json().catch(() => ({}))) as {
    client_name?: unknown;
    customer?: unknown;
    invoice_amount?: unknown;
    amount?: unknown;
    days_overdue?: unknown;
    due_date?: unknown;
    dueDate?: unknown;
  };

  const clientName = String(body.client_name ?? body.customer ?? "").trim();
  const invoiceAmount = Number(body.invoice_amount ?? body.amount);
  let daysOverdue = Number(body.days_overdue);
  if (!Number.isFinite(daysOverdue)) {
    const due = String(body.due_date ?? body.dueDate ?? "").trim();
    const computed = due ? daysFromDueDate(due) : null;
    daysOverdue = computed ?? NaN;
  }

  if (!clientName || !Number.isFinite(invoiceAmount) || !Number.isFinite(daysOverdue)) {
    return c.json(
      {
        error:
          "Required: client_name (or customer), invoice_amount (or amount), and days_overdue or due_date.",
      },
      400
    );
  }

  try {
    const draft = await generateFollowUpEmail(c.env, {
      clientName,
      invoiceAmount,
      daysOverdue: Math.max(0, daysOverdue),
    });
    c.executionCtx.waitUntil(
      dispatchWebhooks(c.env, acc.workspaceId, "chase.drafted", {
        source: "api",
        client_name: clientName,
        invoice_amount: invoiceAmount,
        days_overdue: daysOverdue,
        subject: draft.subject,
      }).catch(() => {})
    );
    return c.json({
      subject: draft.subject,
      body: draft.body,
      tone_band: getToneBand(Math.max(0, daysOverdue)),
      days_overdue: Math.max(0, daysOverdue),
      note: "Draft only — send from your own inbox. Chasa never emails your client.",
    });
  } catch (err) {
    console.error("v1 chase/draft failed", err);
    return c.json({ error: "Could not generate draft" }, 502);
  }
});

v1.get("/health", (c) => c.json({ ok: true, product: "chasa", version: "1" }));

export default v1;
