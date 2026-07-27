import type { Env } from "../types";

export async function purgeExpiredSessions(env: Env): Promise<number> {
  const now = new Date().toISOString();
  const results = await Promise.all([
    env.CHASA_DB.prepare(`DELETE FROM sessions WHERE expires_at <= ?`).bind(now).run(),
    env.CHASA_DB.prepare(`DELETE FROM admin_sessions WHERE expires_at <= ?`).bind(now).run(),
    env.CHASA_DB.prepare(
      `DELETE FROM magic_links WHERE expires_at <= ? OR consumed_at IS NOT NULL`
    )
      .bind(now)
      .run(),
    env.CHASA_DB.prepare(
      `DELETE FROM rate_limits WHERE window_start < ?`
    )
      .bind(Math.floor(Date.now() / 1000) - 86400 * 2)
      .run(),
  ]);
  return results.reduce((n, r) => n + (r.meta.changes ?? 0), 0);
}
