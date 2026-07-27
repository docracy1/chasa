import type { Env } from "../types";

/**
 * Chasa analytics catalog (invoice chase product).
 * Structure: { name, properties?, visitorId?, accountId?, path?, created_at }
 *
 * Priority: Activation > Completion > Templates > Traffic > Email > Errors
 * KPIs: chase_sent (activation), chase_completed (completion, future),
 *       template_completed (templates), landingpage_cta_clicked (traffic),
 *       email_clicked (email)
 */

/** 1. Activation — KPI: chase_sent */
export const ACTIVATION_FUNNEL = [
  "signup_started",
  "signup_completed",
  "dashboard_loaded",
  "upload_started",
  "invoice_uploaded",
  "template_opened",
  "template_used",
  "fields_added",
  "chase_drafted",
  "chase_sent",
  "aging_cleared",
  "client_created",
  "client_updated",
  "client_deleted",
  "client_contact_note",
  "client_chase_drafted",
] as const;

/** 2. Completion — KPI: chase_completed (stub until paid/open tracking) */
export const COMPLETION_FUNNEL = [
  "chase_sent",
  "chase_downloaded",
  "chase_opened", // future: recipient opened follow-up
  "chase_completed", // future: marked paid / resolved
] as const;

/** 3. Templates — KPI: template_completed */
export const TEMPLATE_FUNNEL = [
  "template_category_viewed",
  "template_preview_opened",
  "template_opened",
  "template_started",
  "template_abandoned",
  "template_completed",
] as const;

/** 4. Traffic — KPI: landingpage_cta_clicked */
export const TRAFFIC_FUNNEL = [
  "landingpage_loaded",
  "landingpage_cta_clicked",
  "referral_source_detected",
  "blog_article_loaded",
  "blog_cta_clicked",
  "page_viewed",
  "scroll_depth_reached",
] as const;

/** 5. Email — KPI: email_clicked */
export const EMAIL_FUNNEL = [
  "email_sent",
  "email_opened",
  "email_clicked",
  "email_bounced",
] as const;

/** 6. Errors */
export const ERROR_EVENTS = [
  "upload_failed",
  "field_error",
  "send_failed",
] as const;

const ALLOWED = new Set<string>([
  ...ACTIVATION_FUNNEL,
  ...COMPLETION_FUNNEL,
  ...TEMPLATE_FUNNEL,
  ...TRAFFIC_FUNNEL,
  ...EMAIL_FUNNEL,
  ...ERROR_EVENTS,
]);

export function isAllowedEvent(name: string): boolean {
  return ALLOWED.has(name);
}

export async function trackEvent(
  env: Env,
  input: {
    name: string;
    properties?: Record<string, unknown>;
    visitorId?: string | null;
    accountId?: string | null;
    path?: string | null;
  }
): Promise<void> {
  if (!isAllowedEvent(input.name)) return;

  await env.CHASA_DB.prepare(
    `INSERT INTO analytics_events (id, name, properties, visitor_id, account_id, path, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      crypto.randomUUID(),
      input.name,
      input.properties ? JSON.stringify(input.properties) : null,
      input.visitorId ?? null,
      input.accountId ?? null,
      input.path ?? null,
      new Date().toISOString()
    )
    .run();
}

export type FunnelStep = { name: string; count: number };

async function countsFor(env: Env, names: readonly string[], sinceIso: string): Promise<FunnelStep[]> {
  const out: FunnelStep[] = [];
  for (const name of names) {
    const row = await env.CHASA_DB.prepare(
      `SELECT COUNT(*) as c FROM analytics_events WHERE name = ? AND created_at >= ?`
    )
      .bind(name, sinceIso)
      .first<{ c: number }>();
    out.push({ name, count: Number(row?.c ?? 0) });
  }
  return out;
}

export async function getFunnelStats(env: Env, days = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const [activation, completion, template, traffic, email, errors, totals] = await Promise.all([
    countsFor(env, ACTIVATION_FUNNEL, since),
    countsFor(env, COMPLETION_FUNNEL, since),
    countsFor(env, TEMPLATE_FUNNEL, since),
    countsFor(env, TRAFFIC_FUNNEL, since),
    countsFor(env, EMAIL_FUNNEL, since),
    countsFor(env, ERROR_EVENTS, since),
    env.CHASA_DB.prepare(
      `SELECT
         (SELECT COUNT(*) FROM accounts) as accounts,
         (SELECT COUNT(*) FROM accounts WHERE plan != 'free') as paid_accounts,
         (SELECT COUNT(*) FROM analytics_events WHERE created_at >= ?) as events,
         (SELECT COUNT(*) FROM analytics_events WHERE name = 'chase_sent' AND created_at >= ?) as activation_kpi,
         (SELECT COUNT(*) FROM analytics_events WHERE name = 'chase_completed' AND created_at >= ?) as completion_kpi
       `
    )
      .bind(since, since, since)
      .first<{
        accounts: number;
        paid_accounts: number;
        events: number;
        activation_kpi: number;
        completion_kpi: number;
      }>(),
  ]);

  return {
    days,
    since,
    totals: {
      accounts: Number(totals?.accounts ?? 0),
      paidAccounts: Number(totals?.paid_accounts ?? 0),
      events: Number(totals?.events ?? 0),
      activationKpi: Number(totals?.activation_kpi ?? 0),
      completionKpi: Number(totals?.completion_kpi ?? 0),
    },
    activation,
    completion,
    template,
    traffic,
    email,
    errors,
  };
}

const BOT_PATTERNS: { name: string; re: RegExp }[] = [
  { name: "Googlebot", re: /googlebot/i },
  { name: "Applebot", re: /applebot/i },
  { name: "Bingbot", re: /bingbot/i },
  { name: "GPTBot", re: /gptbot/i },
  { name: "ClaudeBot", re: /claudebot|anthropic/i },
  { name: "Other bot", re: /bot|crawler|spider|slurp/i },
];

export function detectBot(ua: string | null): { isBot: boolean; botName: string | null } {
  if (!ua) return { isBot: false, botName: null };
  for (const p of BOT_PATTERNS) {
    if (p.re.test(ua)) return { isBot: true, botName: p.name };
  }
  return { isBot: false, botName: null };
}

export async function recordPageView(
  env: Env,
  input: { path: string; country?: string | null; userAgent?: string | null }
): Promise<void> {
  const path = input.path.slice(0, 300) || "/";
  const { isBot, botName } = detectBot(input.userAgent ?? null);
  const now = new Date();
  const day = now.toISOString().slice(0, 10);

  await env.CHASA_DB.prepare(
    `INSERT INTO page_views (id, path, day, is_bot, bot_name, country, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      crypto.randomUUID(),
      path,
      day,
      isBot ? 1 : 0,
      botName,
      input.country?.slice(0, 8) || null,
      now.toISOString()
    )
    .run();
}

export async function getTrafficStats(env: Env, days = 30) {
  const sinceDay = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const sinceIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const [totals, byDay, byRoute, byBot, byCountry, kpis] = await Promise.all([
    env.CHASA_DB.prepare(
      `SELECT
         COUNT(*) as total,
         SUM(CASE WHEN is_bot = 1 THEN 1 ELSE 0 END) as bots
       FROM page_views WHERE day >= ?`
    )
      .bind(sinceDay)
      .first<{ total: number; bots: number }>(),
    env.CHASA_DB.prepare(
      `SELECT day,
         SUM(CASE WHEN is_bot = 0 THEN 1 ELSE 0 END) as human,
         SUM(CASE WHEN is_bot = 1 THEN 1 ELSE 0 END) as bot
       FROM page_views WHERE day >= ?
       GROUP BY day ORDER BY day ASC`
    )
      .bind(sinceDay)
      .all<{ day: string; human: number; bot: number }>(),
    env.CHASA_DB.prepare(
      `SELECT path,
         COUNT(*) as total,
         SUM(CASE WHEN is_bot = 0 THEN 1 ELSE 0 END) as human,
         SUM(CASE WHEN is_bot = 1 THEN 1 ELSE 0 END) as bot
       FROM page_views WHERE day >= ?
       GROUP BY path ORDER BY total DESC LIMIT 20`
    )
      .bind(sinceDay)
      .all<{ path: string; total: number; human: number; bot: number }>(),
    env.CHASA_DB.prepare(
      `SELECT COALESCE(bot_name, 'Unknown') as bot, COUNT(*) as c
       FROM page_views WHERE day >= ? AND is_bot = 1
       GROUP BY bot_name ORDER BY c DESC LIMIT 20`
    )
      .bind(sinceDay)
      .all<{ bot: string; c: number }>(),
    env.CHASA_DB.prepare(
      `SELECT COALESCE(country, '??') as country, COUNT(*) as c
       FROM page_views WHERE day >= ?
       GROUP BY country ORDER BY c DESC LIMIT 20`
    )
      .bind(sinceDay)
      .all<{ country: string; c: number }>(),
    env.CHASA_DB.prepare(
      `SELECT
         (SELECT COUNT(*) FROM analytics_events WHERE name = 'chase_sent' AND created_at >= ?) as chases_sent,
         (SELECT COUNT(*) FROM analytics_events WHERE name = 'chase_completed' AND created_at >= ?) as chases_completed
       `
    )
      .bind(sinceIso, sinceIso)
      .first<{ chases_sent: number; chases_completed: number }>(),
  ]);

  const total = Number(totals?.total ?? 0);
  const bots = Number(totals?.bots ?? 0);
  const sent = Number(kpis?.chases_sent ?? 0);
  const completed = Number(kpis?.chases_completed ?? 0);

  return {
    days,
    pageViews: total,
    botPct: total > 0 ? Math.round((bots / total) * 100) : 0,
    chasesSent: sent,
    chasesCompleted: completed,
    conversion:
      sent > 0 ? `${Math.round((completed / sent) * 100)}%` : "—",
    byDay: (byDay.results ?? []).map((r) => ({
      day: r.day,
      human: Number(r.human),
      bot: Number(r.bot),
    })),
    byRoute: (byRoute.results ?? []).map((r) => ({
      path: r.path,
      total: Number(r.total),
      human: Number(r.human),
      bot: Number(r.bot),
    })),
    byBot: (byBot.results ?? []).map((r) => ({ bot: r.bot, count: Number(r.c) })),
    byCountry: (byCountry.results ?? []).map((r) => ({
      country: r.country,
      count: Number(r.c),
    })),
    note: "Aggregate traffic from Chasa (CF country header, UA bot detect). No IPs or visitor IDs stored on page views.",
  };
}
