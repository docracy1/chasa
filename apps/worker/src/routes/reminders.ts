import { Hono } from "hono";
import { requirePaidAccount, type AuthEnv } from "../lib/auth";
import {
  listReminders,
  nextPlannedReminder,
  replaceSequenceReminders,
  updateReminderStatus,
} from "../lib/chaseReminders";
import { parseJsonBody, reminderSequenceSchema, reminderStatusSchema } from "../lib/schemas";

const reminders = new Hono<AuthEnv>();

reminders.get("/", requirePaidAccount, async (c) => {
  const acc = c.get("account")!;
  const from = c.req.query("from") ?? undefined;
  const to = c.req.query("to") ?? undefined;
  const status = c.req.query("status") ?? undefined;
  const remindersList = await listReminders(c.env, acc.workspaceId, { from, to, status });
  return c.json({ reminders: remindersList });
});

reminders.get("/next", requirePaidAccount, async (c) => {
  const acc = c.get("account")!;
  const invoiceId = c.req.query("invoiceId") ?? null;
  const next = await nextPlannedReminder(c.env, acc.workspaceId, invoiceId);
  return c.json({ reminder: next });
});

reminders.post("/sequence", requirePaidAccount, async (c) => {
  const acc = c.get("account")!;
  const parsed = await parseJsonBody(c.req, reminderSequenceSchema);
  if (!parsed.ok) return c.json({ error: parsed.error }, 400);
  const body = parsed.data;
  const normalized = body.steps
    .map((s, i) => ({
      step: Number(s.step) || i + 1,
      daysFromNow: Number(s.daysFromNow) || 0,
      label: (s.label ?? `Step ${i + 1}`).slice(0, 80),
      subject: (s.subject ?? "").slice(0, 200),
      body: (s.body ?? "").slice(0, 4000),
    }))
    .filter((s) => s.body);
  const saved = await replaceSequenceReminders(c.env, acc.workspaceId, {
    agingInvoiceId: body.agingInvoiceId ?? null,
    clientName: body.clientName,
    steps: normalized,
  });
  return c.json({ reminders: saved });
});

reminders.patch("/:id", requirePaidAccount, async (c) => {
  const acc = c.get("account")!;
  const parsed = await parseJsonBody(c.req, reminderStatusSchema);
  if (!parsed.ok) return c.json({ error: parsed.error }, 400);
  const status = parsed.data.status;
  const updated = await updateReminderStatus(c.env, acc.workspaceId, c.req.param("id"), status);
  if (!updated) return c.json({ error: "Reminder not found" }, 404);
  return c.json({ reminder: updated });
});

export default reminders;
