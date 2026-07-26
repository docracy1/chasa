import { Hono } from "hono";
import { requirePaidAccount, type AuthEnv } from "../lib/auth";
import {
  listReminders,
  nextPlannedReminder,
  replaceSequenceReminders,
  updateReminderStatus,
  type ReminderStatus,
} from "../lib/chaseReminders";

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
  const body = (await c.req.json().catch(() => ({}))) as {
    agingInvoiceId?: string;
    clientName?: string;
    steps?: Array<{
      step?: number;
      daysFromNow?: number;
      label?: string;
      subject?: string;
      body?: string;
    }>;
  };
  const clientName = (body.clientName ?? "").trim();
  const steps = Array.isArray(body.steps) ? body.steps : [];
  if (!clientName || steps.length === 0) {
    return c.json({ error: "clientName and steps are required." }, 400);
  }
  const normalized = steps
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
    clientName,
    steps: normalized,
  });
  return c.json({ reminders: saved });
});

reminders.patch("/:id", requirePaidAccount, async (c) => {
  const acc = c.get("account")!;
  const body = (await c.req.json().catch(() => ({}))) as { status?: string };
  const status = body.status as ReminderStatus | undefined;
  if (status !== "planned" && status !== "done" && status !== "skipped") {
    return c.json({ error: "status must be planned, done, or skipped." }, 400);
  }
  const updated = await updateReminderStatus(c.env, acc.workspaceId, c.req.param("id"), status);
  if (!updated) return c.json({ error: "Reminder not found" }, 404);
  return c.json({ reminder: updated });
});

export default reminders;
