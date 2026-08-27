import type { Env } from "../types";
import type { Plan } from "./billing";

export type OtsStatus = "none" | "pending" | "confirmed" | "failed";

export type Certificate = {
  id: string;
  publicId: string;
  accountId: string | null;
  sha256Hash: string;
  originalFilename: string | null;
  fileSizeBytes: number | null;
  issuerName: string | null;
  planAtCreation: Plan;
  status: "active" | "revoked";
  revokedAt: string | null;
  createdAt: string;
  otsStatus: OtsStatus;
  otsCalendarUrl: string | null;
  otsSubmittedAt: string | null;
  otsConfirmedAt: string | null;
};

type Row = {
  id: string;
  public_id: string;
  account_id: string | null;
  sha256_hash: string;
  original_filename: string | null;
  file_size_bytes: number | null;
  issuer_name: string | null;
  plan_at_creation: string;
  status: string;
  revoked_at: string | null;
  created_at: string;
  ots_status: string;
  ots_proof_base64: string | null;
  ots_calendar_url: string | null;
  ots_submitted_at: string | null;
  ots_confirmed_at: string | null;
};

function rowToCertificate(row: Row): Certificate {
  return {
    id: row.id,
    publicId: row.public_id,
    accountId: row.account_id,
    sha256Hash: row.sha256_hash,
    originalFilename: row.original_filename,
    fileSizeBytes: row.file_size_bytes,
    issuerName: row.issuer_name,
    planAtCreation: row.plan_at_creation as Plan,
    status: row.status as Certificate["status"],
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
    otsStatus: row.ots_status as OtsStatus,
    otsCalendarUrl: row.ots_calendar_url,
    otsSubmittedAt: row.ots_submitted_at,
    otsConfirmedAt: row.ots_confirmed_at,
  };
}

// Crockford-ish base32 (no 0/O/1/I ambiguity) — displayed on a printable certificate, so it
// needs to read cleanly, unlike an internal UUID.
const PUBLIC_ID_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

function generatePublicId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  let code = "";
  for (const b of bytes) code += PUBLIC_ID_ALPHABET[b % PUBLIC_ID_ALPHABET.length];
  return `DOC-${code}`;
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Never store a raw IP — only a salted hash, for abuse tracing on anonymous certs. */
export async function hashIp(env: Env, ip: string): Promise<string> {
  return sha256Hex(`${ip}:${env.TOKEN_SECRET}`);
}

const HEX64 = /^[0-9a-f]{64}$/i;

export function isValidSha256Hex(hash: string): boolean {
  return HEX64.test(hash);
}

export async function createCertificate(
  env: Env,
  input: {
    accountId: string | null;
    sha256Hash: string;
    originalFilename: string | null;
    fileSizeBytes: number | null;
    issuerName: string | null;
    plan: Plan;
    ipHash: string | null;
  }
): Promise<Certificate> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  for (let attempt = 0; attempt < 5; attempt++) {
    const publicId = generatePublicId();
    try {
      await env.CHASA_DB.prepare(
        `INSERT INTO document_certificates
           (id, public_id, account_id, sha256_hash, original_filename, file_size_bytes, issuer_name, plan_at_creation, status, creator_ip_hash, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`
      )
        .bind(
          id,
          publicId,
          input.accountId,
          input.sha256Hash,
          input.originalFilename,
          input.fileSizeBytes,
          input.issuerName,
          input.plan,
          input.ipHash,
          now
        )
        .run();
      return {
        id,
        publicId,
        accountId: input.accountId,
        sha256Hash: input.sha256Hash,
        originalFilename: input.originalFilename,
        fileSizeBytes: input.fileSizeBytes,
        issuerName: input.issuerName,
        planAtCreation: input.plan,
        status: "active",
        revokedAt: null,
        createdAt: now,
        otsStatus: "none",
        otsCalendarUrl: null,
        otsSubmittedAt: null,
        otsConfirmedAt: null,
      };
    } catch (err) {
      // UNIQUE constraint on public_id — vanishingly rare with 8 chars of 32^8 space, but retry
      // rather than fail a lead-magnet request outright.
      if (attempt === 4) throw err;
    }
  }
  throw new Error("Could not allocate a certificate id");
}

export async function getCertificateByPublicId(env: Env, publicId: string): Promise<Certificate | null> {
  const row = await env.CHASA_DB.prepare(`SELECT * FROM document_certificates WHERE public_id = ?`)
    .bind(publicId)
    .first<Row>();
  return row ? rowToCertificate(row) : null;
}

export async function listCertificatesForAccount(env: Env, accountId: string): Promise<Certificate[]> {
  const { results } = await env.CHASA_DB.prepare(
    `SELECT * FROM document_certificates WHERE account_id = ? ORDER BY created_at DESC LIMIT 200`
  )
    .bind(accountId)
    .all<Row>();
  return (results ?? []).map(rowToCertificate);
}

export type HashMatch = {
  publicId: string;
  issuerName: string | null;
  status: Certificate["status"];
  createdAt: string;
};

/** Lookup by hash only — never returns filename/accountId, since a hash match only proves the
 *  searcher already has the exact bytes; it shouldn't leak anything beyond what the certificate's
 *  own public page already shows. */
export async function findCertificatesByHash(env: Env, sha256Hash: string, limit = 5): Promise<HashMatch[]> {
  const { results } = await env.CHASA_DB.prepare(
    `SELECT public_id, issuer_name, status, created_at FROM document_certificates
     WHERE sha256_hash = ? ORDER BY created_at DESC LIMIT ?`
  )
    .bind(sha256Hash, limit)
    .all<{ public_id: string; issuer_name: string | null; status: string; created_at: string }>();
  return (results ?? []).map((r) => ({
    publicId: r.public_id,
    issuerName: r.issuer_name,
    status: r.status as Certificate["status"],
    createdAt: r.created_at,
  }));
}

export async function revokeCertificate(
  env: Env,
  accountId: string,
  id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const now = new Date().toISOString();
  const result = await env.CHASA_DB.prepare(
    `UPDATE document_certificates SET status = 'revoked', revoked_at = ?
     WHERE id = ? AND account_id = ? AND status = 'active'`
  )
    .bind(now, id, accountId)
    .run();
  if (!result.meta.changes) {
    return { ok: false, error: "Not found or already revoked" };
  }
  return { ok: true };
}

export async function recordTimestampSubmitted(
  env: Env,
  id: string,
  opts: { calendarUrl: string; proofBase64: string }
): Promise<void> {
  await env.CHASA_DB.prepare(
    `UPDATE document_certificates
     SET ots_status = 'pending', ots_calendar_url = ?, ots_proof_base64 = ?, ots_submitted_at = ?
     WHERE id = ?`
  )
    .bind(opts.calendarUrl, opts.proofBase64, new Date().toISOString(), id)
    .run();
}

export async function recordTimestampFailed(env: Env, id: string): Promise<void> {
  await env.CHASA_DB.prepare(`UPDATE document_certificates SET ots_status = 'failed' WHERE id = ? AND ots_status = 'none'`)
    .bind(id)
    .run();
}

export async function recordTimestampConfirmed(env: Env, id: string, proofBase64: string): Promise<void> {
  await env.CHASA_DB.prepare(
    `UPDATE document_certificates SET ots_status = 'confirmed', ots_proof_base64 = ?, ots_confirmed_at = ? WHERE id = ?`
  )
    .bind(proofBase64, new Date().toISOString(), id)
    .run();
}

type PendingTimestampRow = {
  id: string;
  sha256_hash: string;
  ots_calendar_url: string;
  ots_submitted_at: string | null;
};

export async function listPendingTimestamps(env: Env, limit = 100): Promise<PendingTimestampRow[]> {
  const { results } = await env.CHASA_DB.prepare(
    `SELECT id, sha256_hash, ots_calendar_url, ots_submitted_at FROM document_certificates
     WHERE ots_status = 'pending' AND ots_calendar_url IS NOT NULL
     ORDER BY ots_submitted_at ASC LIMIT ?`
  )
    .bind(limit)
    .all<PendingTimestampRow>();
  return results ?? [];
}

export async function getTimestampProof(
  env: Env,
  publicId: string
): Promise<{ proofBase64: string; status: OtsStatus } | null> {
  const row = await env.CHASA_DB.prepare(
    `SELECT ots_proof_base64, ots_status FROM document_certificates WHERE public_id = ?`
  )
    .bind(publicId)
    .first<{ ots_proof_base64: string | null; ots_status: string }>();
  if (!row || !row.ots_proof_base64) return null;
  return { proofBase64: row.ots_proof_base64, status: row.ots_status as OtsStatus };
}
