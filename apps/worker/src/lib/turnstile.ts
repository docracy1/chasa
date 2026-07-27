import type { Env } from "../types";
import { isProductionHttps, isLocalDev } from "./env";

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export type TurnstileResult = { ok: true } | { ok: false; error: string };

/**
 * Verify a Cloudflare Turnstile token.
 * - Production HTTPS: fail closed if secret unset.
 * - Local dev: bypass with warning when secret unset.
 */
export async function verifyTurnstile(
  env: Env,
  token: string | undefined | null,
  remoteIp?: string | null
): Promise<TurnstileResult> {
  const secret = env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) {
    if (isProductionHttps(env)) {
      console.error("[turnstile] TURNSTILE_SECRET_KEY unset in production — blocking request");
      return { ok: false, error: "Security check unavailable. Contact support." };
    }
    if (!isLocalDev(env)) {
      console.error("[turnstile] TURNSTILE_SECRET_KEY unset — blocking non-local request");
      return { ok: false, error: "Security check unavailable." };
    }
    console.warn("[turnstile] bypassing verification (local dev only)");
    return { ok: true };
  }

  if (!token || !token.trim()) {
    return { ok: false, error: "Complete the security check and try again." };
  }

  const body = new URLSearchParams();
  body.set("secret", secret);
  body.set("response", token.trim());
  if (remoteIp) body.set("remoteip", remoteIp);

  try {
    const res = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const data = (await res.json()) as { success?: boolean; "error-codes"?: string[] };
    if (!data.success) {
      console.warn("[turnstile] siteverify failed", data["error-codes"] ?? []);
      return { ok: false, error: "Security check failed. Refresh and try again." };
    }
    return { ok: true };
  } catch (err) {
    console.error("[turnstile] siteverify error", err);
    return { ok: false, error: "Security check unavailable. Try again in a moment." };
  }
}

export function turnstileSiteKey(env: Env): string | null {
  const key = env.TURNSTILE_SITE_KEY?.trim();
  return key || null;
}

export function clientIp(c: { req: { header: (name: string) => string | undefined } }): string | undefined {
  return c.req.header("CF-Connecting-IP") || c.req.header("X-Forwarded-For")?.split(",")[0]?.trim();
}
