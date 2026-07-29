import { Hono } from "hono";
import { z } from "zod";
import { requirePaidAccount, requireProAccount, type AuthEnv } from "../lib/auth";
import {
  createGmailDraft,
  exportAgingToSheet,
  findLatestClientReply,
  importInvoicesFromSheet,
  isGoogleConnected,
  syncReminderToCalendar,
} from "../lib/googleIntegrations";
import { parseJsonBody } from "../lib/schemas";

const googleRoutes = new Hono<AuthEnv>();

const gmailDraftSchema = z.object({
  to: z.string().min(3).max(200),
  subject: z.string().max(500),
  body: z.string().max(8000),
});

const sheetImportSchema = z.object({
  spreadsheetId: z.string().min(5).max(200),
  range: z.string().max(100).optional(),
});

const sheetExportSchema = z.object({
  title: z.string().max(80).optional(),
  rows: z.array(
    z.object({
      clientName: z.string().min(1).max(200),
      amount: z.number(),
      dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      status: z.string().max(40).optional(),
    })
  ),
});

const calendarSyncSchema = z.object({
  summary: z.string().max(200).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().max(4000).optional(),
  clientName: z.string().max(200).optional(),
});

const gmailReplySearchSchema = z.object({
  clientEmail: z.string().max(200).optional().nullable(),
  clientName: z.string().min(1).max(200),
});

async function requireGoogle(env: AuthEnv["Bindings"], accountId: string) {
  if (!(await isGoogleConnected(env, accountId))) {
    return "Google is not connected. Go to Connectors, connect Google Drive, then try again.";
  }
  return null;
}

googleRoutes.post("/gmail-draft", requirePaidAccount, async (c) => {
  const acc = c.get("account")!;
  const blocked = await requireGoogle(c.env, acc.workspaceId);
  if (blocked) return c.json({ error: blocked }, 400);
  const parsed = await parseJsonBody(c.req, gmailDraftSchema);
  if (!parsed.ok) return c.json({ error: parsed.error }, 400);
  try {
    return c.json(await createGmailDraft(c.env, acc.workspaceId, parsed.data));
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "Gmail draft failed" }, 502);
  }
});

googleRoutes.post("/sheets/import", requirePaidAccount, async (c) => {
  const acc = c.get("account")!;
  const blocked = await requireGoogle(c.env, acc.workspaceId);
  if (blocked) return c.json({ error: blocked }, 400);
  const parsed = await parseJsonBody(c.req, sheetImportSchema);
  if (!parsed.ok) return c.json({ error: parsed.error }, 400);
  try {
    return c.json(
      await importInvoicesFromSheet(
        c.env,
        acc.workspaceId,
        parsed.data.spreadsheetId,
        parsed.data.range
      )
    );
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "Sheets import failed" }, 502);
  }
});

googleRoutes.post("/sheets/export-aging", requirePaidAccount, async (c) => {
  const acc = c.get("account")!;
  const blocked = await requireGoogle(c.env, acc.workspaceId);
  if (blocked) return c.json({ error: blocked }, 400);
  const parsed = await parseJsonBody(c.req, sheetExportSchema);
  if (!parsed.ok) return c.json({ error: parsed.error }, 400);
  if (parsed.data.rows.length === 0) return c.json({ error: "No rows to export." }, 400);
  try {
    return c.json(
      await exportAgingToSheet(c.env, acc.workspaceId, parsed.data.title ?? "Chasa aging", parsed.data.rows)
    );
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "Sheets export failed" }, 502);
  }
});

googleRoutes.post("/calendar/sync-reminder", requirePaidAccount, async (c) => {
  const acc = c.get("account")!;
  const blocked = await requireGoogle(c.env, acc.workspaceId);
  if (blocked) return c.json({ error: blocked }, 400);
  const parsed = await parseJsonBody(c.req, calendarSyncSchema);
  if (!parsed.ok) return c.json({ error: parsed.error }, 400);
  try {
    return c.json(
      await syncReminderToCalendar(c.env, acc.workspaceId, {
        summary: parsed.data.summary ?? "",
        date: parsed.data.date,
        description: parsed.data.description,
        clientName: parsed.data.clientName,
      })
    );
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "Calendar sync failed" }, 502);
  }
});

googleRoutes.post("/gmail/find-reply", requireProAccount, async (c) => {
  const acc = c.get("account")!;
  const blocked = await requireGoogle(c.env, acc.workspaceId);
  if (blocked) return c.json({ error: blocked }, 400);
  const parsed = await parseJsonBody(c.req, gmailReplySearchSchema);
  if (!parsed.ok) return c.json({ error: parsed.error }, 400);
  try {
    return c.json(await findLatestClientReply(c.env, acc.workspaceId, parsed.data));
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "Gmail search failed" }, 502);
  }
});

export default googleRoutes;
