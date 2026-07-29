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
  // The free-draft cap is the highest-intent moment in the product — someone has used the thing
  // five times and wants a sixth. Measured separately from the generic CTA events so the wall's
  // pull can be read on its own.
  "quota_wall_shown",
  "quota_wall_upgrade_clicked",
  "quota_wall_signin_clicked",
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

/** `userAgent` is classified on write (same detectBot patterns as page_views) so the admin funnels
 *  can measure both halves of a load → click ratio against the same audience. Callers with no
 *  request behind them (Resend sends, cron) pass nothing and are recorded as human. */
export async function trackEvent(
  env: Env,
  input: {
    name: string;
    properties?: Record<string, unknown>;
    visitorId?: string | null;
    accountId?: string | null;
    path?: string | null;
    userAgent?: string | null;
  }
): Promise<void> {
  if (!isAllowedEvent(input.name)) return;

  const { isBot } = detectBot(input.userAgent ?? null);

  await env.CHASA_DB.prepare(
    `INSERT INTO analytics_events (id, name, properties, visitor_id, account_id, path, is_bot, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      crypto.randomUUID(),
      input.name,
      input.properties ? JSON.stringify(input.properties) : null,
      input.visitorId ?? null,
      input.accountId ?? null,
      input.path ?? null,
      isBot ? 1 : 0,
      new Date().toISOString()
    )
    .run();
}

export type FunnelStep = { name: string; count: number };

/** Rows predating migration 0013 have is_bot NULL, so COALESCE keeps them in the human count
 *  rather than making every historical event disappear the moment the filter is switched on. */
const HUMANS_ONLY_SQL = `AND COALESCE(is_bot, 0) = 0`;

async function countsFor(
  env: Env,
  names: readonly string[],
  sinceIso: string,
  humansOnly = false
): Promise<FunnelStep[]> {
  if (names.length === 0) return [];
  const placeholders = names.map(() => "?").join(", ");
  const humanFilter = humansOnly ? ` ${HUMANS_ONLY_SQL}` : "";
  const { results } = await env.CHASA_DB.prepare(
    `SELECT name, COUNT(*) as c FROM analytics_events
     WHERE created_at >= ? AND name IN (${placeholders})${humanFilter}
     GROUP BY name`
  )
    .bind(sinceIso, ...names)
    .all<{ name: string; c: number }>();

  const byName = new Map((results ?? []).map((r) => [r.name, Number(r.c)]));
  return names.map((name) => ({ name, count: byName.get(name) ?? 0 }));
}

/** `humansOnly` drops classified crawlers from every event count in one go. It applies to the KPI
 *  totals as well as the step rows on purpose — a funnel whose steps and headline KPI came from
 *  different audiences is worse than either reading alone.
 *
 *  getTrafficStats deliberately keeps its own unfiltered view: it reads page_views, whose whole
 *  job on the dashboard is to show the human/bot split. */
export async function getFunnelStats(env: Env, days = 30, humansOnly = false) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const humanFilter = humansOnly ? ` ${HUMANS_ONLY_SQL}` : "";
  const [activation, completion, template, traffic, email, errors, totals] = await Promise.all([
    countsFor(env, ACTIVATION_FUNNEL, since, humansOnly),
    countsFor(env, COMPLETION_FUNNEL, since, humansOnly),
    countsFor(env, TEMPLATE_FUNNEL, since, humansOnly),
    countsFor(env, TRAFFIC_FUNNEL, since, humansOnly),
    countsFor(env, EMAIL_FUNNEL, since, humansOnly),
    countsFor(env, ERROR_EVENTS, since, humansOnly),
    env.CHASA_DB.prepare(
      `SELECT
         (SELECT COUNT(*) FROM accounts) as accounts,
         (SELECT COUNT(*) FROM accounts WHERE plan != 'free') as paid_accounts,
         (SELECT COUNT(*) FROM analytics_events WHERE created_at >= ?${humanFilter}) as events,
         (SELECT COUNT(*) FROM analytics_events WHERE name = 'chase_sent' AND created_at >= ?${humanFilter}) as activation_kpi,
         (SELECT COUNT(*) FROM analytics_events WHERE name = 'chase_completed' AND created_at >= ?${humanFilter}) as completion_kpi
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
    humansOnly,
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
  { name: "GPTBot", re: /gptbot|oai-searchbot|chatgpt-user/i },
  { name: "ClaudeBot", re: /claudebot|anthropic|claude-user/i },
  { name: "PerplexityBot", re: /perplexity/i },
  { name: "facebookexternalhit", re: /facebookexternalhit|facebot/i },
  { name: "Twitterbot", re: /twitterbot/i },
  { name: "LinkedInBot", re: /linkedinbot/i },
  { name: "Slackbot", re: /slackbot|slack-imgproxy/i },
  { name: "Discordbot", re: /discordbot/i },
  { name: "WhatsApp", re: /whatsapp/i },
  { name: "AhrefsBot", re: /ahrefsbot/i },
  { name: "SemrushBot", re: /semrushbot/i },
  { name: "HeadlessChrome", re: /headlesschrome/i },
  { name: "curl", re: /\bcurl\//i },
  { name: "python-requests", re: /python-requests|python-urllib|aiohttp/i },
  // Catch-all last — LinkedInBot/Twitterbot already matched above; this covers misc SEO scrapers.
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
    humanPageViews: Math.max(0, total - bots),
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
