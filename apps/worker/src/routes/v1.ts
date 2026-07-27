import { Hono } from "hono";
import type { AuthEnv } from "../lib/auth";
import { requirePaidApiOrSession } from "../lib/apiKeys";
import { generateFollowUpEmail, getToneBand } from "../lib/ai";
import { dispatchWebhooks } from "../lib/webhooks";
import { parseJsonBody, v1ChaseDraftSchema } from "../lib/schemas";

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
  const parsed = await parseJsonBody(c.req, v1ChaseDraftSchema);
  if (!parsed.ok) return c.json({ error: parsed.error }, 400);

  const body = parsed.data;
  const clientName = (body.client_name ?? body.customer ?? "").trim();
  const invoiceAmount = body.invoice_amount ?? body.amount;
  let daysOverdue = body.days_overdue;
  if (daysOverdue == null || !Number.isFinite(daysOverdue)) {
    const due = (body.due_date ?? body.dueDate ?? "").trim();
    const computed = due ? daysFromDueDate(due) : null;
    daysOverdue = computed ?? NaN;
  }

  if (!clientName || invoiceAmount == null || !Number.isFinite(invoiceAmount) || !Number.isFinite(daysOverdue)) {
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

export default v1;
