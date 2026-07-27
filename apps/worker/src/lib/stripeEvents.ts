import type { Env } from "../types";

/** Returns true if this event was newly recorded (process side effects). False if duplicate. */
export async function claimStripeEvent(env: Env, eventId: string): Promise<boolean> {
  if (!eventId.trim()) return true;
  try {
    const res = await env.CHASA_DB.prepare(
      `INSERT INTO stripe_events (id, processed_at) VALUES (?, ?)`
    )
      .bind(eventId, new Date().toISOString())
      .run();
    return (res.meta?.changes ?? 0) > 0;
  } catch {
    return false;
  }
}

export function parseStripeEventId(rawBody: string): string | null {
  try {
    const event = JSON.parse(rawBody) as { id?: unknown };
    return typeof event.id === "string" ? event.id : null;
  } catch {
    return null;
  }
}
