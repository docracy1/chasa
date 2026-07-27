import { Hono } from "hono";
import { requirePaidAccount, type AuthEnv } from "../lib/auth";
import { listChaseEvents, recordChaseEvent } from "../lib/chaseEvents";
import { chaseEventSchema, parseJsonBody } from "../lib/schemas";

const chase = new Hono<AuthEnv>();

chase.get("/events", requirePaidAccount, async (c) => {
  const acc = c.get("account")!;
  const agingInvoiceId = c.req.query("invoiceId") ?? undefined;
  const clientName = c.req.query("clientName") ?? undefined;
  const limit = c.req.query("limit") ? Number(c.req.query("limit")) : 50;
  const events = await listChaseEvents(c.env, acc.workspaceId, {
    agingInvoiceId,
    clientName,
    limit: Number.isFinite(limit) ? limit : 50,
  });
  return c.json({ events });
});

chase.post("/events", requirePaidAccount, async (c) => {
  const acc = c.get("account")!;
  const parsed = await parseJsonBody(c.req, chaseEventSchema);
  if (!parsed.ok) return c.json({ error: parsed.error }, 400);
  const body = parsed.data;
  const event = await recordChaseEvent(c.env, acc.workspaceId, {
    agingInvoiceId: body.agingInvoiceId,
    clientName: body.clientName,
    eventType: body.eventType,
    channel: body.channel,
    subject: body.subject,
    body: body.body,
    metadata: body.metadata,
  });
  return c.json({ event });
});

export default chase;
