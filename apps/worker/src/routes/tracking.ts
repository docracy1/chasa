import { Hono } from "hono";
import { requirePaidAccount, type AuthEnv } from "../lib/auth";
import {
  createTrackedChase,
  listTrackingForAccount,
  recordClick,
  recordOpen,
  trackingPixelBytes,
  trackingStatsForInvoices,
  isAllowedTrackingUrl,
} from "../lib/chaseTracking";
import { parseJsonBody, trackingCreateSchema, trackingStatsSchema } from "../lib/schemas";

const tracking = new Hono<AuthEnv>();

/** Public pixel — no auth. */
tracking.get("/o/:chaseId.gif", async (c) => {
  const chaseId = (c.req.param("chaseId") ?? "").replace(/\.gif$/i, "");
  if (!chaseId) return c.text("Not found", 404);
  await recordOpen(c.env, chaseId).catch(() => false);
  return new Response(trackingPixelBytes(), {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      "Access-Control-Allow-Origin": "*",
    },
  });
});

/** Public click redirect — no auth. */
tracking.get("/c/:chaseId", async (c) => {
  const chaseId = c.req.param("chaseId");
  const u = c.req.query("u") || "";
  let target = u;
  try {
    const parsed = new URL(u);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return c.text("Invalid link", 400);
    }
    target = parsed.toString();
  } catch {
    return c.text("Invalid link", 400);
  }
  const allowed = await isAllowedTrackingUrl(c.env, chaseId, target);
  if (!allowed) return c.text("Link not found for this tracked email", 404);
  await recordClick(c.env, chaseId, target).catch(() => null);
  return c.redirect(target, 302);
});

tracking.post("/create", requirePaidAccount, async (c) => {
  const acc = c.get("account")!;
  const parsed = await parseJsonBody(c.req, trackingCreateSchema);
  if (!parsed.ok) return c.json({ error: parsed.error }, 400);
  const body = parsed.data;

  const tracked = await createTrackedChase(c.env, acc.workspaceId, {
    subject: body.subject ?? null,
    body: body.body,
    clientName: body.clientName ?? null,
    agingInvoiceId: body.agingInvoiceId ?? null,
    wrapLinks: body.wrapLinks !== false,
  });
  return c.json(tracked);
});

tracking.get("/", requirePaidAccount, async (c) => {
  const acc = c.get("account")!;
  const items = await listTrackingForAccount(c.env, acc.workspaceId);
  return c.json({
    tracking: items,
    note: "Opens only register when the recipient loads images in HTML email you copied from Chasa. Plain mailto text does not track.",
  });
});

tracking.post("/stats", requirePaidAccount, async (c) => {
  const acc = c.get("account")!;
  const parsed = await parseJsonBody(c.req, trackingStatsSchema);
  if (!parsed.ok) return c.json({ error: parsed.error }, 400);
  const ids = parsed.data.invoiceIds ?? [];
  const stats = await trackingStatsForInvoices(c.env, acc.workspaceId, ids);
  return c.json({ stats });
});

export default tracking;
