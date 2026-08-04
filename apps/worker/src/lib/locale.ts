import type { Env } from "../types";

export type Locale = "en" | "es";

/** Best-effort locale guess from a request's Accept-Language header. Used only to seed an
 *  account's stored preference the first time we see them — never authoritative on its own. */
export function detectLocaleFromHeader(acceptLanguage: string | null | undefined): Locale {
  return acceptLanguage && /^\s*es/i.test(acceptLanguage) ? "es" : "en";
}

export function normalizeLocale(raw: string | null | undefined): Locale {
  return raw === "es" ? "es" : "en";
}

export async function getAccountLocale(env: Env, accountId: string): Promise<Locale> {
  const row = await env.CHASA_DB.prepare(`SELECT locale FROM accounts WHERE id = ?`)
    .bind(accountId)
    .first<{ locale: string | null }>();
  return normalizeLocale(row?.locale);
}

/** Set-once, same pattern as setStripeCustomerId — a later guess (e.g. a browser with different
 *  Accept-Language) shouldn't override a preference we already recorded. */
export async function setAccountLocale(env: Env, accountId: string, locale: Locale): Promise<void> {
  await env.CHASA_DB.prepare(`UPDATE accounts SET locale = ? WHERE id = ? AND locale IS NULL`)
    .bind(locale, accountId)
    .run();
}
