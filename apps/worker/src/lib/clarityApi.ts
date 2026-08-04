import type { Env } from "../types";

const CLARITY_API_URL = "https://www.clarity.ms/export-data/api/v1/project-live-insights";

/** Clarity's Data Export API caps out around 10 calls/project/day. We only need one (the daily
 *  cron), but leave headroom for a manual refresh from the admin UI without ever risking the cap. */
const MAX_DAILY_CALLS = 8;
const MIN_MANUAL_INTERVAL_MS = 60 * 60 * 1000;

export type ClarityMetric = {
  metricName: string;
  information: Record<string, unknown>[];
};

export type ClaritySnapshot = {
  fetchedAt: string;
  numOfDays: number;
  metrics: ClarityMetric[];
  /** First "Traffic" metric row, whatever fields Clarity returned — kept generic (rather than
   *  hard-mapped to specific field names we can't verify without a live token) so the admin UI can
   *  render it correctly the moment real data lands. */
  traffic: Record<string, unknown> | null;
  error: string | null;
};

type SnapshotRow = {
  fetched_at: string;
  num_of_days: number;
  raw_json: string;
  error: string | null;
  fetch_count_day: string;
  fetch_count: number;
};

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

async function callClarity(env: Env, numOfDays: 1 | 2 | 3): Promise<ClarityMetric[]> {
  const res = await fetch(`${CLARITY_API_URL}?numOfDays=${numOfDays}`, {
    headers: { Authorization: `Bearer ${env.CLARITY_API_TOKEN}` },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Clarity API ${res.status}${body ? `: ${body.slice(0, 200)}` : ""}`);
  }
  const data = (await res.json()) as unknown;
  if (!Array.isArray(data)) throw new Error("Clarity API returned an unexpected response shape");
  return data as ClarityMetric[];
}

async function loadRow(env: Env): Promise<SnapshotRow | null> {
  return (
    (await env.CHASA_DB.prepare(
      `SELECT fetched_at, num_of_days, raw_json, error, fetch_count_day, fetch_count
       FROM clarity_snapshot WHERE id = 1`
    ).first<SnapshotRow>()) ?? null
  );
}

function toSnapshot(row: Pick<SnapshotRow, "fetched_at" | "num_of_days" | "raw_json" | "error"> | null): ClaritySnapshot | null {
  if (!row) return null;
  let metrics: ClarityMetric[] = [];
  try {
    metrics = JSON.parse(row.raw_json);
  } catch {
    metrics = [];
  }
  const traffic = metrics.find((m) => m.metricName === "Traffic")?.information?.[0] ?? null;
  return {
    fetchedAt: row.fetched_at,
    numOfDays: row.num_of_days,
    metrics,
    traffic,
    error: row.error,
  };
}

export async function getCachedClaritySnapshot(env: Env): Promise<ClaritySnapshot | null> {
  return toSnapshot(await loadRow(env));
}

/** Refreshes the cached snapshot from the live Clarity API. `force` (used by the daily cron) skips
 *  the one-refresh-per-hour guard that protects manual admin-UI refreshes; both paths share the same
 *  per-UTC-day counter so neither can push the account over Clarity's daily call cap. */
export async function refreshClaritySnapshot(
  env: Env,
  opts: { numOfDays?: 1 | 2 | 3; force?: boolean } = {}
): Promise<{ ok: true; snapshot: ClaritySnapshot } | { ok: false; error: string }> {
  if (!env.CLARITY_API_TOKEN) return { ok: false, error: "not_configured" };

  const numOfDays = opts.numOfDays ?? 1;
  const now = new Date();
  const day = todayUtc();
  const existing = await loadRow(env);

  const sameDay = existing?.fetch_count_day === day;
  const countToday = sameDay ? existing!.fetch_count : 0;
  if (!opts.force && countToday >= MAX_DAILY_CALLS) {
    return { ok: false, error: "daily_quota_reached" };
  }
  if (!opts.force && existing?.fetched_at) {
    const ageMs = now.getTime() - new Date(existing.fetched_at).getTime();
    if (ageMs < MIN_MANUAL_INTERVAL_MS) return { ok: false, error: "too_soon" };
  }

  let rawJson: string;
  let fetchError: string | null = null;
  try {
    const metrics = await callClarity(env, numOfDays);
    rawJson = JSON.stringify(metrics);
  } catch (err) {
    rawJson = existing?.raw_json ?? "[]";
    fetchError = err instanceof Error ? err.message : "Clarity fetch failed";
  }

  const fetchedAt = now.toISOString();
  const nextCount = sameDay ? countToday + 1 : 1;

  await env.CHASA_DB.prepare(
    `INSERT INTO clarity_snapshot (id, fetched_at, num_of_days, raw_json, error, fetch_count_day, fetch_count)
     VALUES (1, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       fetched_at = excluded.fetched_at,
       num_of_days = excluded.num_of_days,
       raw_json = excluded.raw_json,
       error = excluded.error,
       fetch_count_day = excluded.fetch_count_day,
       fetch_count = excluded.fetch_count`
  )
    .bind(fetchedAt, numOfDays, rawJson, fetchError, day, nextCount)
    .run();

  if (fetchError) return { ok: false, error: fetchError };
  return { ok: true, snapshot: toSnapshot({ fetched_at: fetchedAt, num_of_days: numOfDays, raw_json: rawJson, error: null })! };
}
