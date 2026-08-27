import type { Env } from "../types";
import { checkUpgrade, OTS_STALE_MS, submitTimestamp } from "./openTimestamps";

type ChaseEventRow = {
  id: string;
  aging_invoice_id: string | null;
  client_name: string;
  event_type: string;
  channel: string;
  created_at: string;
};

export type AuditAnchor = {
  id: string;
  accountId: string;
  periodDate: string;
  eventCount: number;
  eventsHash: string;
  prevChainHash: string | null;
  chainHash: string;
  otsStatus: "none" | "pending" | "confirmed" | "failed";
  otsConfirmedAt: string | null;
  createdAt: string;
};

type Row = {
  id: string;
  account_id: string;
  period_date: string;
  event_count: number;
  events_hash: string;
  prev_chain_hash: string | null;
  chain_hash: string;
  ots_status: string;
  ots_confirmed_at: string | null;
  created_at: string;
};

function rowToAnchor(row: Row): AuditAnchor {
  return {
    id: row.id,
    accountId: row.account_id,
    periodDate: row.period_date,
    eventCount: row.event_count,
    eventsHash: row.events_hash,
    prevChainHash: row.prev_chain_hash,
    chainHash: row.chain_hash,
    otsStatus: row.ots_status as AuditAnchor["otsStatus"],
    otsConfirmedAt: row.ots_confirmed_at,
    createdAt: row.created_at,
  };
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Canonical, order-independent representation of a day's events for one account — sorted by id
 *  (not created_at, so two events with the same timestamp still hash deterministically). */
function canonicalizeEvents(events: ChaseEventRow[]): string {
  const sorted = [...events].sort((a, b) => a.id.localeCompare(b.id));
  return sorted
    .map((e) => `${e.id}|${e.aging_invoice_id ?? ""}|${e.client_name}|${e.event_type}|${e.channel}|${e.created_at}`)
    .join("\n");
}

/** Create (or return the existing) anchor for one account's events on one UTC calendar day.
 *  Chains to the previous day's anchor so altering or deleting a past day's events would break
 *  every chain_hash after it — not just that one row. */
export async function createDailyAnchor(env: Env, accountId: string, periodDate: string): Promise<AuditAnchor | null> {
  const existing = await env.CHASA_DB.prepare(
    `SELECT * FROM audit_log_anchors WHERE account_id = ? AND period_date = ?`
  )
    .bind(accountId, periodDate)
    .first<Row>();
  if (existing) return rowToAnchor(existing);

  const { results } = await env.CHASA_DB.prepare(
    `SELECT id, aging_invoice_id, client_name, event_type, channel, created_at FROM chase_events
     WHERE account_id = ? AND created_at >= ? AND created_at < ?`
  )
    .bind(accountId, `${periodDate}T00:00:00.000Z`, `${periodDate}T23:59:59.999Z`)
    .all<ChaseEventRow>();
  const events = results ?? [];
  if (events.length === 0) return null; // nothing to anchor for this account that day

  const prev = await env.CHASA_DB.prepare(
    `SELECT chain_hash FROM audit_log_anchors WHERE account_id = ? AND period_date < ? ORDER BY period_date DESC LIMIT 1`
  )
    .bind(accountId, periodDate)
    .first<{ chain_hash: string }>();
  const prevChainHash = prev?.chain_hash ?? null;

  const eventsHash = await sha256Hex(canonicalizeEvents(events));
  const chainHash = await sha256Hex(`${prevChainHash ?? "genesis"}|${eventsHash}`);

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await env.CHASA_DB.prepare(
    `INSERT INTO audit_log_anchors (id, account_id, period_date, event_count, events_hash, prev_chain_hash, chain_hash, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(id, accountId, periodDate, events.length, eventsHash, prevChainHash, chainHash, now)
    .run();

  return {
    id,
    accountId,
    periodDate,
    eventCount: events.length,
    eventsHash,
    prevChainHash,
    chainHash,
    otsStatus: "none",
    otsConfirmedAt: null,
    createdAt: now,
  };
}

/** Anchor yesterday's events for every account that had chase activity — called once daily.
 *  Yesterday (not today) so the day is fully closed before we hash and chain it. */
export async function runDailyAuditAnchors(env: Env): Promise<{ anchored: number }> {
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const { results } = await env.CHASA_DB.prepare(
    `SELECT DISTINCT account_id FROM chase_events WHERE created_at >= ? AND created_at < ?`
  )
    .bind(`${yesterday}T00:00:00.000Z`, `${yesterday}T23:59:59.999Z`)
    .all<{ account_id: string }>();

  let anchored = 0;
  for (const row of results ?? []) {
    const anchor = await createDailyAnchor(env, row.account_id, yesterday);
    if (!anchor || anchor.otsStatus !== "none") continue;
    const result = await submitTimestamp(anchor.chainHash);
    if (result.ok) {
      await env.CHASA_DB.prepare(
        `UPDATE audit_log_anchors SET ots_status = 'pending', ots_calendar_url = ?, ots_proof_base64 = ?, ots_submitted_at = ? WHERE id = ?`
      )
        .bind(result.calendarUrl, result.proofBase64, new Date().toISOString(), anchor.id)
        .run();
      anchored++;
    } else {
      await env.CHASA_DB.prepare(`UPDATE audit_log_anchors SET ots_status = 'failed' WHERE id = ?`).bind(anchor.id).run();
      console.error(`Audit anchor OpenTimestamps submission failed for ${anchor.id}:`, result.error);
    }
  }
  return { anchored };
}

/** Same upgrade / stale-resubmit sweep as document certificates, applied to audit anchors. */
export async function sweepPendingAuditAnchors(env: Env): Promise<{
  checked: number;
  confirmed: number;
  resubmitted: number;
}> {
  const { results } = await env.CHASA_DB.prepare(
    `SELECT id, chain_hash, ots_calendar_url, ots_submitted_at FROM audit_log_anchors
     WHERE ots_status = 'pending' AND ots_calendar_url IS NOT NULL
     ORDER BY ots_submitted_at ASC LIMIT 100`
  ).all<{ id: string; chain_hash: string; ots_calendar_url: string; ots_submitted_at: string | null }>();
  const pending = results ?? [];

  let confirmed = 0;
  let resubmitted = 0;
  const now = Date.now();

  for (const row of pending) {
    const result = await checkUpgrade(row.chain_hash, row.ots_calendar_url);
    if (result.ok && result.confirmed) {
      await env.CHASA_DB.prepare(
        `UPDATE audit_log_anchors SET ots_status = 'confirmed', ots_proof_base64 = ?, ots_confirmed_at = ?, ots_calendar_url = ? WHERE id = ?`
      )
        .bind(result.proofBase64, new Date().toISOString(), result.calendarUrl, row.id)
        .run();
      confirmed++;
      continue;
    }
    if (!result.ok) {
      console.error(`OpenTimestamps upgrade check failed for audit anchor ${row.id}:`, result.error);
      continue;
    }

    const submittedMs = row.ots_submitted_at ? Date.parse(row.ots_submitted_at) : 0;
    if (!submittedMs || now - submittedMs < OTS_STALE_MS) continue;

    const fresh = await submitTimestamp(row.chain_hash);
    if (fresh.ok) {
      await env.CHASA_DB.prepare(
        `UPDATE audit_log_anchors SET ots_status = 'pending', ots_calendar_url = ?, ots_proof_base64 = ?, ots_submitted_at = ? WHERE id = ?`
      )
        .bind(fresh.calendarUrl, fresh.proofBase64, new Date().toISOString(), row.id)
        .run();
      resubmitted++;
    } else {
      console.error(`OpenTimestamps resubmit failed for audit anchor ${row.id}:`, fresh.error);
    }
  }
  return { checked: pending.length, confirmed, resubmitted };
}

export async function listAuditAnchors(env: Env, accountId: string, limit = 90): Promise<AuditAnchor[]> {
  const { results } = await env.CHASA_DB.prepare(
    `SELECT * FROM audit_log_anchors WHERE account_id = ? ORDER BY period_date DESC LIMIT ?`
  )
    .bind(accountId, limit)
    .all<Row>();
  return (results ?? []).map(rowToAnchor);
}

export async function getAuditAnchorProof(
  env: Env,
  accountId: string,
  anchorId: string
): Promise<{ proofBase64: string } | null> {
  const row = await env.CHASA_DB.prepare(
    `SELECT ots_proof_base64 FROM audit_log_anchors WHERE id = ? AND account_id = ?`
  )
    .bind(anchorId, accountId)
    .first<{ ots_proof_base64: string | null }>();
  if (!row || !row.ots_proof_base64) return null;
  return { proofBase64: row.ots_proof_base64 };
}
