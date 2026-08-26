import type { Env } from "../types";
import { sendCertExpiryReminderEmail } from "./email";

export type Dns01ChallengeStored = {
  identifier: string;
  recordName: string;
  txtValue: string;
  token: string;
  challengeUrl: string;
  authorizationUrl: string;
};

export type CustomerCertificate = {
  id: string;
  accountId: string;
  domain: string;
  hostnames: string[];
  status: "pending_dns" | "verifying" | "issued" | "expiring" | "expired" | "failed";
  dns01Token: string | null;
  dns01TxtValue: string | null;
  dns01Challenges: Dns01ChallengeStored[];
  lastError: string | null;
  issuedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
};

type Row = {
  id: string;
  account_id: string;
  domain: string;
  hostnames_json: string | null;
  status: string;
  order_url: string | null;
  dns01_token: string | null;
  dns01_txt_value: string | null;
  dns01_challenges_json: string | null;
  cert_key_enc: string | null;
  cert_pem: string | null;
  chain_pem: string | null;
  last_error: string | null;
  issued_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
};

function parseHostnames(row: Row): string[] {
  if (row.hostnames_json) {
    try {
      const parsed = JSON.parse(row.hostnames_json) as unknown;
      if (Array.isArray(parsed) && parsed.every((x) => typeof x === "string")) {
        return parsed.map((x) => x.toLowerCase());
      }
    } catch {
      /* fall through */
    }
  }
  return [row.domain];
}

function parseChallenges(row: Row): Dns01ChallengeStored[] {
  if (row.dns01_challenges_json) {
    try {
      const parsed = JSON.parse(row.dns01_challenges_json) as unknown;
      if (Array.isArray(parsed)) return parsed as Dns01ChallengeStored[];
    } catch {
      /* fall through */
    }
  }
  if (row.dns01_token && row.dns01_txt_value) {
    const host = row.domain.startsWith("*.") ? row.domain.slice(2) : row.domain;
    return [
      {
        identifier: row.domain,
        recordName: `_acme-challenge.${host}`,
        txtValue: row.dns01_txt_value,
        token: row.dns01_token,
        challengeUrl: "",
        authorizationUrl: "",
      },
    ];
  }
  return [];
}

function rowToPublic(row: Row): CustomerCertificate {
  return {
    id: row.id,
    accountId: row.account_id,
    domain: row.domain,
    hostnames: parseHostnames(row),
    status: row.status as CustomerCertificate["status"],
    dns01Token: row.dns01_token,
    dns01TxtValue: row.dns01_txt_value,
    dns01Challenges: parseChallenges(row),
    lastError: row.last_error,
    issuedAt: row.issued_at,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

export async function listCertificatesForAccount(env: Env, accountId: string): Promise<CustomerCertificate[]> {
  const { results } = await env.CHASA_DB.prepare(
    `SELECT * FROM customer_certificates WHERE account_id = ? ORDER BY created_at DESC`
  )
    .bind(accountId)
    .all<Row>();
  return (results ?? []).map(rowToPublic);
}

export async function getCertificateRow(env: Env, accountId: string, id: string): Promise<Row | null> {
  return env.CHASA_DB.prepare(`SELECT * FROM customer_certificates WHERE id = ? AND account_id = ?`)
    .bind(id, accountId)
    .first<Row>();
}

export function hostnamesFromRow(row: Row): string[] {
  return parseHostnames(row);
}

export function challengesFromRow(row: Row): Dns01ChallengeStored[] {
  return parseChallenges(row);
}

export async function createCertificateRow(
  env: Env,
  accountId: string,
  hostnames: string[]
): Promise<CustomerCertificate> {
  const names = hostnames.map((h) => h.toLowerCase());
  const domain = names[0]!;
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await env.CHASA_DB.prepare(
    `INSERT INTO customer_certificates (id, account_id, domain, hostnames_json, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'pending_dns', ?, ?)`
  )
    .bind(id, accountId, domain, JSON.stringify(names), now, now)
    .run();
  return {
    id,
    accountId,
    domain,
    hostnames: names,
    status: "pending_dns",
    dns01Token: null,
    dns01TxtValue: null,
    dns01Challenges: [],
    lastError: null,
    issuedAt: null,
    expiresAt: null,
    createdAt: now,
  };
}

export async function setOrderDetails(
  env: Env,
  id: string,
  fields: {
    orderUrl: string;
    dns01Token: string;
    dns01TxtValue: string;
    dns01Challenges: Dns01ChallengeStored[];
  }
): Promise<void> {
  await env.CHASA_DB.prepare(
    `UPDATE customer_certificates SET order_url = ?, dns01_token = ?, dns01_txt_value = ?, dns01_challenges_json = ?, status = 'pending_dns', updated_at = ? WHERE id = ?`
  )
    .bind(
      fields.orderUrl,
      fields.dns01Token,
      fields.dns01TxtValue,
      JSON.stringify(fields.dns01Challenges),
      new Date().toISOString(),
      id
    )
    .run();
}

export async function setVerifying(env: Env, id: string): Promise<void> {
  await env.CHASA_DB.prepare(`UPDATE customer_certificates SET status = 'verifying', updated_at = ? WHERE id = ?`)
    .bind(new Date().toISOString(), id)
    .run();
}

export async function setIssued(
  env: Env,
  id: string,
  fields: { certKeyEnc: string; certPem: string; expiresAt: string }
): Promise<void> {
  await env.CHASA_DB.prepare(
    `UPDATE customer_certificates
     SET status = 'issued', cert_key_enc = ?, cert_pem = ?, issued_at = ?, expires_at = ?, last_error = NULL, updated_at = ?
     WHERE id = ?`
  )
    .bind(fields.certKeyEnc, fields.certPem, new Date().toISOString(), fields.expiresAt, new Date().toISOString(), id)
    .run();
}

export async function setFailed(env: Env, id: string, error: string): Promise<void> {
  await env.CHASA_DB.prepare(`UPDATE customer_certificates SET status = 'failed', last_error = ?, updated_at = ? WHERE id = ?`)
    .bind(error, new Date().toISOString(), id)
    .run();
}

export async function deleteCertificateRow(env: Env, accountId: string, id: string): Promise<boolean> {
  const result = await env.CHASA_DB.prepare(`DELETE FROM customer_certificates WHERE id = ? AND account_id = ?`)
    .bind(id, accountId)
    .run();
  return !!result.meta.changes;
}

/** Certificates expiring within `withinDays`, for the renewal-reminder cron branch — Let's
 *  Encrypt certs are 90 days, and there is no per-registrar DNS API to renew unattended, so this
 *  is a reminder to re-verify, not a silent auto-renewal. */
async function listExpiringSoon(env: Env, withinDays: number): Promise<Row[]> {
  const cutoff = new Date(Date.now() + withinDays * 24 * 60 * 60 * 1000).toISOString();
  const { results } = await env.CHASA_DB.prepare(
    `SELECT * FROM customer_certificates WHERE status = 'issued' AND expires_at IS NOT NULL AND expires_at < ?`
  )
    .bind(cutoff)
    .all<Row>();
  return results ?? [];
}

/** Called from the daily cron branch in index.ts. Marks each reminded certificate 'expiring' so
 *  it isn't emailed again every day until it's actually renewed or expires. */
export async function sendCertExpiryReminders(env: Env): Promise<void> {
  const rows = await listExpiringSoon(env, 30);
  for (const row of rows) {
    const account = await env.CHASA_DB.prepare(`SELECT email FROM accounts WHERE id = ?`)
      .bind(row.account_id)
      .first<{ email: string }>();
    if (!account) continue;
    await sendCertExpiryReminderEmail(env, account.email, row.domain).catch((err) =>
      console.error("[customerCertificates] expiry reminder email failed", err)
    );
    await env.CHASA_DB.prepare(`UPDATE customer_certificates SET status = 'expiring', updated_at = ? WHERE id = ?`)
      .bind(new Date().toISOString(), row.id)
      .run();
  }
}
