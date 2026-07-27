import type { Env } from "../types";

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSeconds: number };

/**
 * Simple D1-backed fixed-window rate limiter.
 * Cleans up windows older than 2 hours opportunistically.
 */
export async function checkRateLimit(
  env: Env,
  bucketKey: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const now = Math.floor(Date.now() / 1000);
  const windowStart = Math.floor(now / windowSeconds) * windowSeconds;
  const key = bucketKey.slice(0, 120);

  const row = await env.CHASA_DB.prepare(
    `SELECT count FROM rate_limits WHERE bucket_key = ? AND window_start = ?`
  )
    .bind(key, windowStart)
    .first<{ count: number }>();

  const count = row?.count ?? 0;
  if (count >= limit) {
    const retryAfter = windowStart + windowSeconds - now;
    return { ok: false, retryAfterSeconds: Math.max(1, retryAfter) };
  }

  await env.CHASA_DB.prepare(
    `INSERT INTO rate_limits (bucket_key, window_start, count) VALUES (?, ?, 1)
     ON CONFLICT(bucket_key, window_start) DO UPDATE SET count = count + 1`
  )
    .bind(key, windowStart)
    .run();

  if (Math.random() < 0.02) {
    const cutoff = now - 7200;
    env.CHASA_DB.prepare(`DELETE FROM rate_limits WHERE window_start < ?`)
      .bind(cutoff)
      .run()
      .catch(() => {});
  }

  return { ok: true };
}

export function clientIpFromHeaders(headers: {
  get: (name: string) => string | null | undefined;
}): string {
  return (
    headers.get("CF-Connecting-IP") ||
    headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ||
    "unknown"
  );
}
