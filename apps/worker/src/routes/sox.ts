import { Hono } from "hono";
import { requireAccount, requirePaidAccount, requireWorkspaceAdmin, type AuthEnv } from "../lib/auth";
import {
  createAuditorPack,
  createSendApproval,
  decideSendApproval,
  generatePeriodEvidenceHtml,
  getAuditorPackHtml,
  getAuditorPackProof,
  getSoxOverview,
  getSoxSettings,
  listAuditorPacks,
  listSendApprovals,
  listSoxAuditEvents,
  updateSoxSettings,
  type SoxActor,
} from "../lib/sox";
import { z } from "zod";
import { parseJsonBody } from "../lib/schemas";

const sox = new Hono<AuthEnv>();

function toActor(acc: { id: string; email: string; role: "admin" | "member" }): SoxActor {
  return { accountId: acc.id, email: acc.email, role: acc.role };
}

function clientIp(c: { req: { header: (n: string) => string | undefined } }): string | null {
  return c.req.header("cf-connecting-ip") ?? c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
}

sox.get("/overview", requirePaidAccount, async (c) => {
  const acc = c.get("account")!;
  const overview = await getSoxOverview(c.env, acc.workspaceId);
  return c.json({ overview });
});

sox.get("/audit-events", requirePaidAccount, async (c) => {
  const acc = c.get("account")!;
  const limit = c.req.query("limit") ? Number(c.req.query("limit")) : 100;
  const action = c.req.query("action") ?? undefined;
  const events = await listSoxAuditEvents(c.env, acc.workspaceId, {
    limit: Number.isFinite(limit) ? limit : 100,
    action,
  });
  return c.json({ events });
});

sox.get("/settings", requirePaidAccount, async (c) => {
  const acc = c.get("account")!;
  const settings = await getSoxSettings(c.env, acc.workspaceId);
  return c.json({ settings });
});

const settingsSchema = z.object({
  sodRequired: z.boolean().optional(),
  retentionDays: z.number().int().min(90).max(3650).optional(),
});

sox.put("/settings", requireWorkspaceAdmin, async (c) => {
  const acc = c.get("account")!;
  const parsed = await parseJsonBody(c.req, settingsSchema);
  if (!parsed.ok) return c.json({ error: parsed.error }, 400);
  const settings = await updateSoxSettings(c.env, acc.workspaceId, toActor(acc), parsed.data, clientIp(c));
  return c.json({ settings });
});

sox.get("/approvals", requirePaidAccount, async (c) => {
  const acc = c.get("account")!;
  const status = c.req.query("status") ?? undefined;
  const approvals = await listSendApprovals(c.env, acc.workspaceId, { status, limit: 100 });
  return c.json({ approvals });
});

const approvalCreateSchema = z.object({
  agingInvoiceId: z.string().min(1).max(80),
  clientName: z.string().min(1).max(120),
  subject: z.string().max(200).optional().nullable(),
  body: z.string().max(20000).optional().nullable(),
});

sox.post("/approvals", requirePaidAccount, async (c) => {
  const acc = c.get("account")!;
  const parsed = await parseJsonBody(c.req, approvalCreateSchema);
  if (!parsed.ok) return c.json({ error: parsed.error }, 400);
  try {
    const approval = await createSendApproval(
      c.env,
      acc.workspaceId,
      toActor(acc),
      {
        agingInvoiceId: parsed.data.agingInvoiceId,
        clientName: parsed.data.clientName,
        subject: parsed.data.subject,
        body: parsed.data.body,
      },
      clientIp(c)
    );
    return c.json({ approval });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "Could not create approval" }, 400);
  }
});

const approvalDecideSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  note: z.string().max(500).optional().nullable(),
});

sox.post("/approvals/:id/decide", requirePaidAccount, async (c) => {
  const acc = c.get("account")!;
  const parsed = await parseJsonBody(c.req, approvalDecideSchema);
  if (!parsed.ok) return c.json({ error: parsed.error }, 400);
  try {
    const approval = await decideSendApproval(
      c.env,
      acc.workspaceId,
      toActor(acc),
      c.req.param("id"),
      parsed.data.decision,
      parsed.data.note,
      clientIp(c)
    );
    return c.json({ approval });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "Could not decide approval" }, 400);
  }
});

const periodSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

sox.get("/period-evidence", requirePaidAccount, async (c) => {
  const acc = c.get("account")!;
  const from = c.req.query("from");
  const to = c.req.query("to");
  const parsed = periodSchema.safeParse({ from, to });
  if (!parsed.success) return c.json({ error: "from and to required as YYYY-MM-DD" }, 400);
  if (parsed.data.from > parsed.data.to) return c.json({ error: "from must be on or before to" }, 400);
  const pack = await generatePeriodEvidenceHtml(c.env, acc.workspaceId, parsed.data.from, parsed.data.to);
  return c.html(pack.html);
});

const createPackSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

sox.get("/auditor-packs", requirePaidAccount, async (c) => {
  const acc = c.get("account")!;
  const packs = await listAuditorPacks(c.env, acc.workspaceId);
  return c.json({ packs });
});

sox.post("/auditor-packs", requirePaidAccount, async (c) => {
  const acc = c.get("account")!;
  const parsed = await parseJsonBody(c.req, createPackSchema);
  if (!parsed.ok) return c.json({ error: parsed.error }, 400);
  if (parsed.data.from > parsed.data.to) return c.json({ error: "from must be on or before to" }, 400);
  try {
    const pack = await createAuditorPack(
      c.env,
      acc.workspaceId,
      toActor(acc),
      parsed.data.from,
      parsed.data.to,
      clientIp(c)
    );
    return c.json({ pack });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "Could not create auditor pack" }, 400);
  }
});

sox.get("/auditor-packs/:id.html", requirePaidAccount, async (c) => {
  const acc = c.get("account")!;
  const id = c.req.param("id");
  if (!id) return c.json({ error: "Pack not found" }, 404);
  const pack = await getAuditorPackHtml(c.env, acc.workspaceId, id);
  if (!pack) return c.json({ error: "Pack not found" }, 404);
  const filename = `sox-auditor-pack-${pack.fromDate}_${pack.toDate}.html`;
  return c.body(pack.html, 200, {
    "Content-Type": "text/html; charset=utf-8",
    "Content-Disposition": `attachment; filename="${filename}"`,
    "X-Content-SHA256": pack.contentSha256,
  });
});

sox.get("/auditor-packs/:id.sha256", requirePaidAccount, async (c) => {
  const acc = c.get("account")!;
  const id = c.req.param("id");
  if (!id) return c.json({ error: "Pack not found" }, 404);
  const pack = await getAuditorPackHtml(c.env, acc.workspaceId, id);
  if (!pack) return c.json({ error: "Pack not found" }, 404);
  const filename = `sox-auditor-pack-${pack.fromDate}_${pack.toDate}.html`;
  const body = `${pack.contentSha256}  ${filename}\n`;
  return c.body(body, 200, {
    "Content-Type": "text/plain; charset=utf-8",
    "Content-Disposition": `attachment; filename="sox-auditor-pack-${pack.fromDate}_${pack.toDate}.sha256"`,
  });
});

sox.get("/auditor-packs/:id.ots", requirePaidAccount, async (c) => {
  const acc = c.get("account")!;
  const id = c.req.param("id");
  if (!id) return c.json({ error: "Pack not found" }, 404);
  const proof = await getAuditorPackProof(c.env, acc.workspaceId, id);
  if (!proof) return c.json({ error: "No timestamp proof available yet" }, 404);
  const bytes = Uint8Array.from(atob(proof.proofBase64), (ch) => ch.charCodeAt(0));
  return c.body(bytes, 200, {
    "Content-Type": "application/octet-stream",
    "Content-Disposition": `attachment; filename="sox-auditor-pack-${id}.ots"`,
    "X-Content-SHA256": proof.contentSha256,
  });
});

sox.get("/status", requireAccount, async (c) => {
  const acc = c.get("account")!;
  if (!acc.isPaid) {
    return c.json({
      paid: false,
      message: "SOX reporting requires Pro or Business",
    });
  }
  const overview = await getSoxOverview(c.env, acc.workspaceId);
  return c.json({ paid: true, overview });
});

export default sox;
