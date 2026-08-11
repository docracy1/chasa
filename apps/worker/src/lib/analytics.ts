import type { Env } from "../types";

/**
 * Chasa analytics catalog (invoice chase product).
 * Structure: { name, properties?, visitorId?, accountId?, path?, created_at }
 *
 * Priority: Activation > Growth > Completion > Templates > Traffic > Email > Errors
 * KPIs: chase_sent (activation), checkout_completed (growth),
 *       chase_completed (completion), template_completed (templates),
 *       landingpage_cta_clicked (traffic), email_clicked (email)
 */

/** Growth / revenue — KPI: checkout_completed (same steps as Docracy) */
export const GROWTH_FUNNEL = [
  "upgrade_clicked",
  "checkout_started",
  "checkout_completed",
] as const;

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

/** 2. Completion — KPI: chase_completed. chase_opened fires from the tracked-email open pixel
 *  (chaseTracking.ts recordOpen, first open only); chase_completed fires when an invoice is marked
 *  paid (routes/aging.ts mark-paid) — neither requires the recipient to do anything Chasa-specific,
 *  so this funnel only reflects traffic that used the HTML tracked-chase feature. */
export const COMPLETION_FUNNEL = [
  "chase_sent",
  "chase_downloaded",
  "chase_opened",
  "chase_completed",
] as const;

/** 3. Templates — KPI: template_completed */
export const TEMPLATE_FUNNEL = [
  "template_category_viewed",
  "template_preview_opened",
  "template_opened",
  "template_started",
  "template_abandoned",
  "template_completed",
  "templates_pack_subscribed",
] as const;

/** 4. Traffic — KPI: landingpage_cta_clicked */
export const TRAFFIC_FUNNEL = [
  "landingpage_loaded",
  "landingpage_cta_clicked",
  "referral_source_detected",
  "outreach_link_opened",
  "blog_article_loaded",
  "blog_cta_clicked",
  "page_viewed",
  "scroll_depth_reached",
  "demo_draft_generated",
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
  ...GROWTH_FUNNEL,
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
  const [activation, growth, completion, template, traffic, email, errors, totals] = await Promise.all([
    countsFor(env, ACTIVATION_FUNNEL, since, humansOnly),
    countsFor(env, GROWTH_FUNNEL, since, humansOnly),
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
         (SELECT COUNT(*) FROM analytics_events WHERE name = 'chase_completed' AND created_at >= ?${humanFilter}) as completion_kpi,
         (SELECT COUNT(*) FROM analytics_events WHERE name = 'checkout_completed' AND created_at >= ?${humanFilter}) as growth_kpi
       `
    )
      .bind(since, since, since, since)
      .first<{
        accounts: number;
        paid_accounts: number;
        events: number;
        activation_kpi: number;
        completion_kpi: number;
        growth_kpi: number;
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
      growthKpi: Number(totals?.growth_kpi ?? 0),
    },
    activation,
    growth,
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

export async function getTrafficStats(env: Env, days = 30, day?: string | null) {
  const sinceDay = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const sinceIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const dayFilter =
    typeof day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
  // Breakdown tables can pin to one day; the day chart always keeps the full window so you can
  // click another bar without losing the series.
  const breakdownWhere = dayFilter ? `day = ?` : `day >= ?`;
  const breakdownBind = dayFilter ?? sinceDay;
  // The KPI cards need to respect the same day pin as the breakdown tables — without an
  // upper bound, picking a single day still summed chases across the whole `days` window.
  const kpiSinceIso = dayFilter ? `${dayFilter}T00:00:00.000Z` : sinceIso;
  const kpiUntilIso = dayFilter
    ? new Date(new Date(`${dayFilter}T00:00:00.000Z`).getTime() + 24 * 60 * 60 * 1000).toISOString()
    : null;
  const kpiWhere = kpiUntilIso ? `created_at >= ? AND created_at < ?` : `created_at >= ?`;
  const kpiBind = kpiUntilIso ? [kpiSinceIso, kpiUntilIso] : [kpiSinceIso];

  const [totals, byDay, byRoute, byBot, byCountry, kpis] = await Promise.all([
    env.CHASA_DB.prepare(
      `SELECT
         COUNT(*) as total,
         SUM(CASE WHEN is_bot = 1 THEN 1 ELSE 0 END) as bots
       FROM page_views WHERE ${breakdownWhere}`
    )
      .bind(breakdownBind)
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
       FROM page_views WHERE ${breakdownWhere}
       GROUP BY path ORDER BY total DESC LIMIT 20`
    )
      .bind(breakdownBind)
      .all<{ path: string; total: number; human: number; bot: number }>(),
    env.CHASA_DB.prepare(
      `SELECT COALESCE(bot_name, 'Unknown') as bot, COUNT(*) as c
       FROM page_views WHERE ${breakdownWhere} AND is_bot = 1
       GROUP BY bot_name ORDER BY c DESC LIMIT 20`
    )
      .bind(breakdownBind)
      .all<{ bot: string; c: number }>(),
    env.CHASA_DB.prepare(
      `SELECT COALESCE(country, '??') as country, COUNT(*) as c
       FROM page_views WHERE ${breakdownWhere}
       GROUP BY country ORDER BY c DESC LIMIT 20`
    )
      .bind(breakdownBind)
      .all<{ country: string; c: number }>(),
    env.CHASA_DB.prepare(
      `SELECT
         (SELECT COUNT(*) FROM analytics_events WHERE name = 'chase_sent' AND ${kpiWhere}) as chases_sent,
         (SELECT COUNT(*) FROM analytics_events WHERE name = 'chase_completed' AND ${kpiWhere}) as chases_completed
       `
    )
      .bind(...kpiBind, ...kpiBind)
      .first<{ chases_sent: number; chases_completed: number }>(),
  ]);

  const total = Number(totals?.total ?? 0);
  const bots = Number(totals?.bots ?? 0);
  const sent = Number(kpis?.chases_sent ?? 0);
  const completed = Number(kpis?.chases_completed ?? 0);

  return {
    days,
    day: dayFilter,
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

export type TrafficSourceRow = {
  event: "referral_source_detected" | "campaign_click";
  source: string;
  attribution: string;
  day: string;
  count: number;
};

function hostnameFromReferrer(referrer: string): string | null {
  try {
    const host = new URL(referrer).hostname.toLowerCase();
    return host || null;
  } catch {
    return null;
  }
}

function attributionTag(utmSource: string, utmCampaign: string): string {
  const source = utmSource.trim().toLowerCase().replace(/[^a-z0-9._/-]+/g, "-").slice(0, 40);
  const campaign = utmCampaign.trim().toLowerCase().replace(/[^a-z0-9._/-]+/g, "-").slice(0, 40);
  if (!source) return "";
  return campaign ? `${source}/${campaign}` : source;
}

/** Docracy-style external discovery rows for the Admin overview. */
export async function getTrafficSources(env: Env, days = 30, humansOnly = false) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const humanFilter = humansOnly ? ` AND COALESCE(is_bot, 0) = 0` : "";
  const { results } = await env.CHASA_DB.prepare(
    `SELECT name, properties, created_at
     FROM analytics_events
     WHERE created_at >= ?
       AND name IN ('referral_source_detected', 'outreach_link_opened')
       ${humanFilter}
     ORDER BY created_at DESC
     LIMIT 2000`
  )
    .bind(since)
    .all<{ name: string; properties: string | null; created_at: string }>();

  const buckets = new Map<string, TrafficSourceRow>();

  for (const row of results ?? []) {
    let props: Record<string, unknown> = {};
    try {
      props = row.properties ? (JSON.parse(row.properties) as Record<string, unknown>) : {};
    } catch {
      props = {};
    }
    const day = row.created_at.slice(0, 10);

    if (row.name === "referral_source_detected") {
      const sourceHint = String(props.source ?? "").toLowerCase();
      const referrer = String(props.referrer ?? "");
      const host =
        hostnameFromReferrer(referrer) ||
        (sourceHint && !["direct", "internal", "referral"].includes(sourceHint) ? sourceHint : "");

      if (host) {
        const key = `ref:${day}:${host}`;
        const prev = buckets.get(key);
        if (prev) prev.count += 1;
        else
          buckets.set(key, {
            event: "referral_source_detected",
            source: host,
            attribution: "",
            day,
            count: 1,
          });
      }

      const tag = attributionTag(String(props.utm_source ?? ""), String(props.utm_campaign ?? ""));
      if (tag) {
        const key = `camp:${day}:${tag}`;
        const prev = buckets.get(key);
        if (prev) prev.count += 1;
        else
          buckets.set(key, {
            event: "campaign_click",
            source: "",
            attribution: tag,
            day,
            count: 1,
          });
      }
    } else if (row.name === "outreach_link_opened") {
      const source = String(props.source ?? "outreach");
      const campaign = String(props.campaign ?? props.code ?? "dm");
      const tag = attributionTag(source, campaign);
      if (!tag) continue;
      const key = `camp:${day}:${tag}`;
      const prev = buckets.get(key);
      if (prev) prev.count += 1;
      else
        buckets.set(key, {
          event: "campaign_click",
          source: "",
          attribution: tag,
          day,
          count: 1,
        });
    }
  }

  return {
    days,
    humansOnly,
    rows: [...buckets.values()].sort((a, b) => b.day.localeCompare(a.day) || b.count - a.count),
  };
}

/** Opens of /go/* outreach short links (server-logged, including optional ?who=). */
export async function getOutreachStats(env: Env, days = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const { results } = await env.CHASA_DB.prepare(
    `SELECT properties, created_at, is_bot
     FROM analytics_events
     WHERE name = 'outreach_link_opened' AND created_at >= ?
     ORDER BY created_at DESC
     LIMIT 500`
  )
    .bind(since)
    .all<{ properties: string | null; created_at: string; is_bot: number | null }>();

  const byCampaign = new Map<string, number>();
  const byWho = new Map<string, number>();
  const recent: {
    at: string;
    code: string;
    label: string;
    who: string | null;
    isBot: boolean;
  }[] = [];

  let humanOpens = 0;
  let botOpens = 0;

  for (const row of results ?? []) {
    let props: Record<string, unknown> = {};
    try {
      props = row.properties ? (JSON.parse(row.properties) as Record<string, unknown>) : {};
    } catch {
      props = {};
    }
    const code = String(props.code ?? "dm");
    const source = String(props.source ?? "outreach");
    const campaign = String(props.campaign ?? code);
    const who = props.who ? String(props.who) : null;
    const label = String(props.label ?? (who ? `${source}/${campaign}/${who}` : `${source}/${campaign}`));
    const isBot = Number(row.is_bot) === 1;

    recent.push({ at: row.created_at, code, label, who, isBot });

    if (isBot) {
      botOpens++;
      continue;
    }
    humanOpens++;
    const campKey = `${source}/${campaign}`;
    byCampaign.set(campKey, (byCampaign.get(campKey) ?? 0) + 1);
    if (who) byWho.set(who, (byWho.get(who) ?? 0) + 1);
  }

  const sortCount = (a: [string, number], b: [string, number]) => b[1] - a[1];
  return {
    days,
    since,
    humanOpens,
    botOpens,
    byCampaign: [...byCampaign.entries()].sort(sortCount).slice(0, 40).map(([label, count]) => ({ label, count })),
    byWho: [...byWho.entries()].sort(sortCount).slice(0, 40).map(([who, count]) => ({ who, count })),
    recent: recent.slice(0, 50),
    links: [
      { path: "/go/dm", use: "Cold email / DM outreach (add ?who=name)" },
      { path: "/go/li", use: "LinkedIn posts & comments" },
      { path: "/go/x", use: "X / Twitter" },
      { path: "/go/try", use: "Generic try CTA → /app/" },
      { path: "/go/templates", use: "Free templates" },
    ],
  };
}

