import type { Env } from "../types";
import { isAdminEmail } from "./adminAuth";
import { sendOnboardingNudgeEmail } from "./email";
import { normalizeLocale, type Locale } from "./locale";

/** Analytics events that mean the user tried the core product (not just browsing settings). */
export const ACTIVATION_EVENT_NAMES = [
  "chase_drafted",
  "chase_sent",
  "client_chase_drafted",
  "invoice_uploaded",
  "upload_started",
  "client_created",
  "fields_added",
  "template_opened",
  "template_completed",
  "template_started",
  "demo_draft_generated",
] as const;

const ACTIVATION_EVENT_SQL = ACTIVATION_EVENT_NAMES.map(() => "?").join(", ");

export function cutoffIsoDaysAgo(days: number, now = new Date()): string {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

/** True when the account has meaningful product usage on server or in analytics. */
export async function isAccountActivated(env: Env, accountId: string): Promise<boolean> {
  const eventRow = await env.CHASA_DB.prepare(
    `SELECT 1 AS hit FROM analytics_events
     WHERE account_id = ? AND name IN (${ACTIVATION_EVENT_SQL})
     LIMIT 1`
  )
    .bind(accountId, ...ACTIVATION_EVENT_NAMES)
    .first<{ hit: number }>();
  if (eventRow?.hit) return true;

  const usageRow = await env.CHASA_DB.prepare(
    `SELECT
       (SELECT COUNT(*) FROM aging_invoices WHERE account_id = ?) +
       (SELECT COUNT(*) FROM clients WHERE account_id = ?) +
       (SELECT COUNT(*) FROM cloud_connectors WHERE account_id = ?) +
       (SELECT COUNT(*) FROM generated_invoices WHERE account_id = ?) +
       (SELECT COUNT(*) FROM document_certificates WHERE account_id = ?) +
       (SELECT COUNT(*) FROM customer_certificates WHERE account_id = ?) +
       (SELECT COUNT(*) FROM marketplace_templates WHERE account_id = ?) AS total`
  )
    .bind(accountId, accountId, accountId, accountId, accountId, accountId, accountId)
    .first<{ total: number }>();

  return (usageRow?.total ?? 0) > 0;
}

type CandidateRow = {
  id: string;
  email: string;
  locale: string | null;
};

async function listInactiveFreeSignupCandidates(
  env: Env,
  signupCutoffIso: string
): Promise<CandidateRow[]> {
  const { results } = await env.CHASA_DB.prepare(
    `SELECT id, email, locale FROM accounts
     WHERE is_paid = 0
       AND onboarding_nudge_sent_at IS NULL
       AND created_at <= ?
     ORDER BY created_at ASC
     LIMIT 50`
  )
    .bind(signupCutoffIso)
    .all<CandidateRow>();

  return (results ?? []).filter((row) => !isAdminEmail(env, row.email));
}

/** Daily cron: nudge free signups who haven't activated any product after ~2 days. Sends at most once per account. */
export async function sendOnboardingNudges(env: Env, opts?: { daysAfterSignup?: number }): Promise<void> {
  const days = opts?.daysAfterSignup ?? 2;
  const cutoff = cutoffIsoDaysAgo(days);
  const candidates = await listInactiveFreeSignupCandidates(env, cutoff);

  for (const row of candidates) {
    if (await isAccountActivated(env, row.id)) continue;

    const locale: Locale = normalizeLocale(row.locale);
    const sent = await sendOnboardingNudgeEmail(env, row.email, locale);
    if (!sent.ok) {
      console.error(`[onboarding-nudge] failed for ${row.email}`);
      continue;
    }

    await env.CHASA_DB.prepare(`UPDATE accounts SET onboarding_nudge_sent_at = ? WHERE id = ?`)
      .bind(new Date().toISOString(), row.id)
      .run();
  }
}
