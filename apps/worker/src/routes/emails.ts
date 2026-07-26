import { Hono } from "hono";
import {
  optionalAccount,
  requirePaidAccount,
  requireProAccount,
  type AuthEnv,
} from "../lib/auth";
import {
  generateChaseSequence,
  generateFollowUpEmail,
  generateReplyEmail,
  generateThankYouEmail,
  rewriteFollowUpEmail,
  type RewriteAction,
} from "../lib/ai";
import { dispatchWebhooks } from "../lib/webhooks";

const emails = new Hono<AuthEnv>();

// Public — no auth needed. The free tier's 5/month cap is enforced client-side (localStorage),
// matching the product spec's v1 scope. Logged-in paid accounts just don't hit that cap client-side.
emails.post("/generate-email", optionalAccount, async (c) => {
  const body = await c.req.json<{
    client_name?: string;
    invoice_amount?: number;
    days_overdue?: number;
    payment_link?: string;
    invoices?: Array<{
      client_name?: string;
      invoice_amount?: number;
      amount?: number;
      days_overdue?: number;
      due_date?: string;
    }>;
  }>();

  const lineItems = Array.isArray(body.invoices)
    ? body.invoices
        .map((row) => {
          const amount = Number(row.invoice_amount ?? row.amount);
          const daysOverdue = Number(row.days_overdue);
          if (!Number.isFinite(amount) || !Number.isFinite(daysOverdue)) return null;
          return {
            clientName: typeof row.client_name === "string" ? row.client_name.trim() : undefined,
            amount,
            daysOverdue: Math.max(0, daysOverdue),
            dueDate: typeof row.due_date === "string" ? row.due_date.trim() : undefined,
          };
        })
        .filter((x): x is NonNullable<typeof x> => x != null)
    : [];

  const clientName =
    (body.client_name ?? "").trim() ||
    (lineItems.length === 1 ? lineItems[0].clientName ?? "" : "") ||
    (lineItems.length > 1 ? "your team" : "");

  const invoiceAmount =
    lineItems.length > 0
      ? lineItems.reduce((s, l) => s + l.amount, 0)
      : Number(body.invoice_amount);
  const daysOverdue =
    lineItems.length > 0
      ? Math.max(...lineItems.map((l) => l.daysOverdue))
      : Number(body.days_overdue);
  const paymentLink =
    typeof body.payment_link === "string" && body.payment_link.trim()
      ? body.payment_link.trim().slice(0, 500)
      : undefined;

  if (!clientName || !Number.isFinite(invoiceAmount) || !Number.isFinite(daysOverdue)) {
    return c.json(
      {
        error:
          "client_name, invoice_amount, and days_overdue are required (or a non-empty invoices array).",
      },
      400
    );
  }

  if (paymentLink && !/^https?:\/\//i.test(paymentLink)) {
    return c.json({ error: "payment_link must be an http(s) URL." }, 400);
  }

  try {
    const draft = await generateFollowUpEmail(c.env, {
      clientName,
      invoiceAmount,
      daysOverdue: Math.max(0, daysOverdue),
      invoices: lineItems.length > 0 ? lineItems : undefined,
      paymentLink,
    });
    const acc = c.get("account");
    if (acc?.isPaid) {
      c.executionCtx.waitUntil(
        dispatchWebhooks(c.env, acc.id, "chase.drafted", {
          client_name: clientName,
          invoice_amount: invoiceAmount,
          days_overdue: daysOverdue,
          invoice_count: lineItems.length || 1,
          subject: draft.subject,
        }).catch(() => {})
      );
    }
    return c.json(draft);
  } catch (err) {
    console.error("generateFollowUpEmail failed", err);
    return c.json({ error: "Could not generate a draft right now. Please try again." }, 502);
  }
});

const REWRITE_ACTIONS = new Set<RewriteAction>(["softer", "firmer", "shorter"]);

// Soften / firm up / shorten — paid only (enforced server-side).
emails.post("/rewrite-email", requirePaidAccount, async (c) => {
  const body = await c.req.json<{ subject?: string; body?: string; action?: string }>();
  const subject = (body.subject ?? "").trim();
  const emailBody = (body.body ?? "").trim();
  const action = body.action as RewriteAction | undefined;

  if (!subject || !emailBody || !action || !REWRITE_ACTIONS.has(action)) {
    return c.json({ error: "subject, body, and action (softer|firmer|shorter) are required." }, 400);
  }

  try {
    const draft = await rewriteFollowUpEmail(c.env, { subject, body: emailBody, action });
    return c.json(draft);
  } catch (err) {
    console.error("rewriteFollowUpEmail failed", err);
    return c.json({ error: "Could not rewrite the draft right now. Please try again." }, 502);
  }
});

// Thank-you after payment — Solo+
emails.post("/generate-thank-you", requirePaidAccount, async (c) => {
  const acc = c.get("account")!;
  const body = await c.req.json<{ client_name?: string; invoice_amount?: number }>();
  const clientName = (body.client_name ?? "").trim();
  const invoiceAmount = Number(body.invoice_amount);
  if (!clientName || !Number.isFinite(invoiceAmount)) {
    return c.json({ error: "client_name and invoice_amount are required." }, 400);
  }
  try {
    const draft = await generateThankYouEmail(c.env, { clientName, invoiceAmount });
    c.executionCtx.waitUntil(
      dispatchWebhooks(c.env, acc.id, "chase.thank_you", {
        client_name: clientName,
        invoice_amount: invoiceAmount,
        subject: draft.subject,
      }).catch(() => {})
    );
    return c.json(draft);
  } catch (err) {
    console.error("generateThankYouEmail failed", err);
    return c.json({ error: "Could not generate a thank-you draft right now." }, 502);
  }
});

// Reply to a client message — Solo+
emails.post("/generate-reply", requirePaidAccount, async (c) => {
  const acc = c.get("account")!;
  const body = await c.req.json<{
    client_name?: string;
    invoice_amount?: number;
    days_overdue?: number;
    client_message?: string;
  }>();
  const clientName = (body.client_name ?? "").trim();
  const invoiceAmount = Number(body.invoice_amount);
  const daysOverdue = Number(body.days_overdue);
  const clientMessage = (body.client_message ?? "").trim();
  if (!clientName || !Number.isFinite(invoiceAmount) || !Number.isFinite(daysOverdue) || !clientMessage) {
    return c.json(
      { error: "client_name, invoice_amount, days_overdue, and client_message are required." },
      400
    );
  }
  try {
    const draft = await generateReplyEmail(c.env, {
      clientName,
      invoiceAmount,
      daysOverdue,
      clientMessage,
    });
    c.executionCtx.waitUntil(
      dispatchWebhooks(c.env, acc.id, "chase.reply_drafted", {
        client_name: clientName,
        invoice_amount: invoiceAmount,
        days_overdue: daysOverdue,
        subject: draft.subject,
      }).catch(() => {})
    );
    return c.json(draft);
  } catch (err) {
    console.error("generateReplyEmail failed", err);
    return c.json({ error: "Could not generate a reply draft right now." }, 502);
  }
});

// 3-step chase sequence — Pro / Enterprise
emails.post("/generate-sequence", requireProAccount, async (c) => {
  const acc = c.get("account")!;
  const body = await c.req.json<{ client_name?: string; invoice_amount?: number; days_overdue?: number }>();
  const clientName = (body.client_name ?? "").trim();
  const invoiceAmount = Number(body.invoice_amount);
  const daysOverdue = Number(body.days_overdue);
  if (!clientName || !Number.isFinite(invoiceAmount) || !Number.isFinite(daysOverdue)) {
    return c.json({ error: "client_name, invoice_amount, and days_overdue are required." }, 400);
  }
  try {
    const sequence = await generateChaseSequence(c.env, { clientName, invoiceAmount, daysOverdue });
    c.executionCtx.waitUntil(
      dispatchWebhooks(c.env, acc.id, "chase.sequence_planned", {
        client_name: clientName,
        invoice_amount: invoiceAmount,
        days_overdue: daysOverdue,
        steps: sequence.steps.length,
      }).catch(() => {})
    );
    return c.json(sequence);
  } catch (err) {
    console.error("generateChaseSequence failed", err);
    return c.json({ error: "Could not generate a chase sequence right now." }, 502);
  }
});

export default emails;
