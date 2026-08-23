import { Hono } from "hono";
import type { AuthEnv } from "../lib/auth";
import { requireAccount } from "../lib/auth";
import { getAuditAnchorProof, listAuditAnchors } from "../lib/auditLog";

const auditLog = new Hono<AuthEnv>();

/** A daily, Bitcoin-anchored hash chain of this account's chase/invoice events (sends, opens,
 *  clicks, replies) — proof of exactly when something happened that doesn't rely on trusting
 *  docstoc's own database. Each day chains to the previous one. */
auditLog.get("/anchors", requireAccount, async (c) => {
  const acc = c.get("account")!;
  const anchors = await listAuditAnchors(c.env, acc.workspaceId);
  return c.json({ anchors });
});

auditLog.get("/anchors/:id/proof.ots", requireAccount, async (c) => {
  const acc = c.get("account")!;
  const proof = await getAuditAnchorProof(c.env, acc.workspaceId, c.req.param("id"));
  if (!proof) return c.json({ error: "No timestamp proof available yet" }, 404);
  const bytes = Uint8Array.from(atob(proof.proofBase64), (ch) => ch.charCodeAt(0));
  return c.body(bytes, 200, {
    "Content-Type": "application/octet-stream",
    "Content-Disposition": `attachment; filename="audit-log-${c.req.param("id")}.ots"`,
  });
});

export default auditLog;
