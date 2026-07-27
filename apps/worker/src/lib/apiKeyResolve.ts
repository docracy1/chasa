import type { Env } from "../types";
import { hashOpaqueTokenLookup } from "./token";
import { isPaidPlan } from "./billing";
import { normalizePlan } from "./plan";
import type { AccountContext } from "./auth";

async function resolveRoleForEmail(
  env: Env,
  workspaceId: string,
  email: string
): Promise<"admin" | "member"> {
  if (email.trim().toLowerCase() === "") return "member";
  const owner = await env.CHASA_DB.prepare(`SELECT email FROM accounts WHERE id = ?`)
    .bind(workspaceId)
    .first<{ email: string }>();
  if (owner && owner.email.toLowerCase() === email.trim().toLowerCase()) return "admin";

  const membership = await env.CHASA_DB.prepare(
    `SELECT role FROM workspace_members WHERE account_id = ? AND email = ? AND status = 'active'`
  )
    .bind(workspaceId, email.trim().toLowerCase())
    .first<{ role: string }>();

  if (membership?.role === "admin") return "admin";
  return "member";
}

async function accountFromApiKeyRow(
  env: Env,
  row: {
    key_id: string;
    id: string;
    email: string;
    is_paid: number;
    plan: string | null;
    workspace_owner_id: string | null;
  }
): Promise<AccountContext> {
  await env.CHASA_DB.prepare(`UPDATE api_keys SET last_used_at = ? WHERE id = ?`)
    .bind(new Date().toISOString(), row.key_id)
    .run();

  let workspaceId = row.id;
  let plan = normalizePlan(row.plan, row.is_paid === 1);
  let role: "admin" | "member" = "admin";

  if (row.workspace_owner_id) {
    const owner = await env.CHASA_DB.prepare(`SELECT id, is_paid, plan FROM accounts WHERE id = ?`)
      .bind(row.workspace_owner_id)
      .first<{ id: string; is_paid: number; plan: string | null }>();
    if (owner) {
      workspaceId = owner.id;
      plan = normalizePlan(owner.plan, owner.is_paid === 1);
      role = await resolveRoleForEmail(env, owner.id, row.email);
    }
  }

  return {
    id: row.id,
    email: row.email,
    plan,
    isPaid: isPaidPlan(plan),
    workspaceId,
    role,
  };
}

export async function resolveAccountFromApiKeyBearer(
  env: Env,
  bearer: string
): Promise<AccountContext | null> {
  if (!bearer.startsWith("chasa_")) return null;
  const [primaryHash, legacyHash] = await hashOpaqueTokenLookup(bearer, env.TOKEN_SECRET, "api-key");
  const sql = `SELECT k.id as key_id, a.id as id, a.email as email, a.is_paid as is_paid, a.plan as plan,
            a.workspace_owner_id as workspace_owner_id
     FROM api_keys k
     JOIN accounts a ON a.id = k.account_id
     WHERE k.token_hash = ?`;
  type Row = {
    key_id: string;
    id: string;
    email: string;
    is_paid: number;
    plan: string | null;
    workspace_owner_id: string | null;
  };
  let row = await env.CHASA_DB.prepare(sql).bind(primaryHash).first<Row>();
  if (!row) row = await env.CHASA_DB.prepare(sql).bind(legacyHash).first<Row>();
  if (!row) return null;
  return accountFromApiKeyRow(env, row);
}
