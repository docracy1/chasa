import { Hono } from "hono";
import {
  requirePaidAccount,
  requireWorkspaceAdmin,
  type AuthEnv,
} from "../lib/auth";
import { seatLimitForPlan } from "../lib/billing";
import {
  acceptInvite,
  countSeatsUsed,
  inviteMember,
  listMembers,
  removeMember,
  sendInviteEmail,
  updateMemberRole,
  type MemberRole,
} from "../lib/team";

const team = new Hono<AuthEnv>();

team.get("/", requirePaidAccount, async (c) => {
  const acc = c.get("account")!;
  const members = await listMembers(c.env, acc.workspaceId);
  const used = await countSeatsUsed(c.env, acc.workspaceId);
  const limit = seatLimitForPlan(acc.plan);
  const owner = await c.env.CHASA_DB.prepare(`SELECT email FROM accounts WHERE id = ?`)
    .bind(acc.workspaceId)
    .first<{ email: string }>();

  return c.json({
    ownerEmail: owner?.email ?? acc.email,
    members,
    seats: { used, limit, remaining: Math.max(0, limit - used) },
    yourRole: acc.role,
    plan: acc.plan,
  });
});

team.post("/invite", requireWorkspaceAdmin, async (c) => {
  const acc = c.get("account")!;
  const body = (await c.req.json().catch(() => ({}))) as { email?: string; role?: string };
  const email = (body.email ?? "").trim();
  const role: MemberRole = body.role === "admin" ? "admin" : "member";
  const result = await inviteMember(c.env, acc.workspaceId, email, role, acc.plan);
  if ("error" in result) return c.json({ error: result.error }, result.status as 400);

  const inviteUrl = `${c.env.PUBLIC_APP_URL.replace(/\/$/, "")}/app/team?invite=${encodeURIComponent(result.inviteToken)}`;
  await sendInviteEmail(c.env, result.member.email, inviteUrl, acc.email);

  return c.json({ member: result.member, ok: true });
});

team.post("/accept", requirePaidAccount, async (c) => {
  const acc = c.get("account")!;
  const body = (await c.req.json().catch(() => ({}))) as { token?: string };
  const token = (body.token ?? "").trim();
  if (!token) return c.json({ error: "token is required." }, 400);
  const result = await acceptInvite(c.env, token, acc.email, acc.id);
  if ("error" in result) return c.json({ error: result.error }, result.status as 400);
  return c.json({ ok: true, workspaceId: result.workspaceId });
});

team.patch("/:id", requireWorkspaceAdmin, async (c) => {
  const acc = c.get("account")!;
  const body = (await c.req.json().catch(() => ({}))) as { role?: string };
  const role: MemberRole | null = body.role === "admin" || body.role === "member" ? body.role : null;
  if (!role) return c.json({ error: "role must be admin or member." }, 400);
  const ok = await updateMemberRole(c.env, acc.workspaceId, c.req.param("id"), role);
  if (!ok) return c.json({ error: "Member not found" }, 404);
  return c.json({ ok: true });
});

team.delete("/:id", requireWorkspaceAdmin, async (c) => {
  const acc = c.get("account")!;
  const ok = await removeMember(c.env, acc.workspaceId, c.req.param("id"));
  if (!ok) return c.json({ error: "Member not found" }, 404);
  return c.json({ ok: true });
});

export default team;
