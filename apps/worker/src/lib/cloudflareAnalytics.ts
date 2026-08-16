import type { Env } from "../types";
import { detectBot } from "./analytics";

/** chasa.io zone tag — not sensitive, same value returned by `GET /zones?name=chasa.io`. */
const CF_ZONE_ID = "b270fd325fb601987a9f5fd3e406530b";
const GRAPHQL_URL = "https://api.cloudflare.com/client/v4/graphql";

/** Cloudflare's own edge sees every request (crawlers, scrapers, asset fetches) regardless of
 *  whether the client executes JavaScript. Our self-tracked page_views table only ever hears from
 *  clients that ran analytics.js's beacon — most non-JS bots (SEO crawlers, AI scrapers, curl/
 *  python-requests) never trigger it at all, so they're invisible there no matter how good the UA
 *  regex is. This module reads the real edge dataset instead, so the dashboard's bot/traffic
 *  numbers can actually match what shows up in the Cloudflare dashboard itself. */

type GraphqlResponse<T> = { data?: T; errors?: { message: string }[] };

async function cfGraphql<T>(env: Env, query: string): Promise<T> {
  const res = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.CF_ANALYTICS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Cloudflare GraphQL API ${res.status}${body ? `: ${body.slice(0, 300)}` : ""}`);
  }
  const json = (await res.json()) as GraphqlResponse<T>;
  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join("; "));
  }
  if (!json.data) throw new Error("Cloudflare GraphQL API returned no data");
  return json.data;
}

type DailyTotalsData = {
  viewer: {
    zones: {
      httpRequests1dGroups: {
        dimensions: { date: string };
        sum: { requests: number; pageViews: number; cachedRequests: number };
        uniq: { uniques: number };
      }[];
    }[];
  };
};

export type CfDayTotal = { day: string; requests: number; pageViews: number; uniques: number };

/** Pre-aggregated per-day totals — cheap, one row per day, no query-window limit like the
 *  row-level adaptive dataset below. Safe for the full 7/30/90-day windows the dashboard offers. */
async function fetchDailyTotals(env: Env, sinceDay: string, untilDay: string): Promise<CfDayTotal[]> {
  const query = `query {
    viewer {
      zones(filter: { zoneTag: "${CF_ZONE_ID}" }) {
        httpRequests1dGroups(
          limit: 100
          filter: { date_geq: "${sinceDay}", date_leq: "${untilDay}" }
        ) {
          dimensions { date }
          sum { requests pageViews cachedRequests }
          uniq { uniques }
        }
      }
    }
  }`;
  const data = await cfGraphql<DailyTotalsData>(env, query);
  const rows = data.viewer.zones[0]?.httpRequests1dGroups ?? [];
  return rows
    .map((r) => ({
      day: r.dimensions.date,
      requests: Number(r.sum.requests),
      pageViews: Number(r.sum.pageViews),
      uniques: Number(r.uniq.uniques),
    }))
    .sort((a, b) => a.day.localeCompare(b.day));
}

type DayBreakdownData = {
  viewer: {
    zones: {
      botGroups: { dimensions: { userAgent: string; verifiedBotCategory: string }; count: number }[];
      pathGroups: { dimensions: { clientRequestPath: string }; count: number }[];
      countryGroups: { dimensions: { clientCountryName: string }; count: number }[];
      deviceGroups: { dimensions: { clientDeviceType: string }; count: number }[];
    }[];
  };
};

export type CfBreakdown = {
  day: string;
  eyeballRequests: number;
  botCount: number;
  humanCount: number;
  botPct: number;
  byBot: { bot: string; count: number }[];
  byRoute: { path: string; count: number }[];
  byCountry: { country: string; count: number }[];
  byDevice: { device: string; count: number }[];
};

/** `requestSource: "eyeball"` excludes Cloudflare's own internal traffic (early-hints cache fills,
 *  edge-worker-to-worker subrequests) that shows up in the raw request log but was never an actual
 *  visitor hitting the site — without this filter the "real requests" figure includes noise the
 *  self-tracked page_views table never had in the first place. */
async function fetchDayBreakdown(env: Env, day: string): Promise<CfBreakdown> {
  const geq = `${day}T00:00:00Z`;
  const lt = new Date(new Date(`${day}T00:00:00Z`).getTime() + 24 * 60 * 60 * 1000).toISOString();
  const filter = `filter: { datetime_geq: "${geq}", datetime_lt: "${lt}", requestSource: "eyeball" }`;
  const query = `query {
    viewer {
      zones(filter: { zoneTag: "${CF_ZONE_ID}" }) {
        botGroups: httpRequestsAdaptiveGroups(limit: 9999, ${filter}) {
          dimensions { userAgent verifiedBotCategory }
          count
        }
        pathGroups: httpRequestsAdaptiveGroups(limit: 2000, ${filter}) {
          dimensions { clientRequestPath }
          count
        }
        countryGroups: httpRequestsAdaptiveGroups(limit: 2000, ${filter}) {
          dimensions { clientCountryName }
          count
        }
        deviceGroups: httpRequestsAdaptiveGroups(limit: 100, ${filter}) {
          dimensions { clientDeviceType }
          count
        }
      }
    }
  }`;
  const data = await cfGraphql<DayBreakdownData>(env, query);
  const zone = data.viewer.zones[0];

  let eyeballRequests = 0;
  let botCount = 0;
  const byBotMap = new Map<string, number>();

  for (const row of zone?.botGroups ?? []) {
    const count = Number(row.count);
    eyeballRequests += count;
    const verified = row.dimensions.verifiedBotCategory?.trim();
    if (verified) {
      botCount += count;
      byBotMap.set(verified, (byBotMap.get(verified) ?? 0) + count);
      continue;
    }
    // Cloudflare only tags known/verified bots this way — everything else (including scrapers
    // spoofing a browser UA) falls through to the same UA regex the self-tracked path already uses.
    const { isBot, botName } = detectBot(row.dimensions.userAgent || null);
    if (isBot) {
      botCount += count;
      const label = botName ?? "Other bot";
      byBotMap.set(label, (byBotMap.get(label) ?? 0) + count);
    }
  }

  const sumTop = <T extends { count: number }>(rows: T[], keyOf: (r: T) => string, limit: number) => {
    const map = new Map<string, number>();
    for (const r of rows) {
      const key = keyOf(r) || "??";
      map.set(key, (map.get(key) ?? 0) + Number(r.count));
    }
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([k, count]) => ({ key: k, count }));
  };

  const byRoute = sumTop(zone?.pathGroups ?? [], (r) => r.dimensions.clientRequestPath, 20).map((r) => ({
    path: r.key,
    count: r.count,
  }));
  const byCountry = sumTop(zone?.countryGroups ?? [], (r) => r.dimensions.clientCountryName, 20).map((r) => ({
    country: r.key,
    count: r.count,
  }));
  const byDevice = sumTop(zone?.deviceGroups ?? [], (r) => r.dimensions.clientDeviceType, 10).map((r) => ({
    device: r.key,
    count: r.count,
  }));
  const byBot = [...byBotMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([bot, count]) => ({ bot, count }));

  return {
    day,
    eyeballRequests,
    botCount,
    humanCount: Math.max(0, eyeballRequests - botCount),
    botPct: eyeballRequests > 0 ? Math.round((botCount / eyeballRequests) * 100) : 0,
    byBot,
    byRoute,
    byCountry,
    byDevice,
  };
}

export type CfTrafficStats =
  | { configured: false }
  | { configured: true; ok: false; error: string }
  | ({
      configured: true;
      ok: true;
      days: number;
      byDay: CfDayTotal[];
      totals: { requests: number; pageViews: number; uniques: number };
    } & CfBreakdown);

/** `day` pins the bot/route/country/device breakdown to one UTC day (Cloudflare's row-level
 *  dataset caps queries at a 1-day range) — defaults to today-so-far if not given. The `days`
 *  window only affects the cheap pre-aggregated daily-totals chart, which has no such cap. */
export async function getCloudflareTrafficStats(
  env: Env,
  days: number,
  day?: string | null
): Promise<CfTrafficStats> {
  if (!env.CF_ANALYTICS_TOKEN) return { configured: false };

  const untilDay = new Date().toISOString().slice(0, 10);
  const sinceDay = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const breakdownDay = day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : untilDay;

  try {
    const [byDay, breakdown] = await Promise.all([
      fetchDailyTotals(env, sinceDay, untilDay),
      fetchDayBreakdown(env, breakdownDay),
    ]);
    const totals = byDay.reduce(
      (acc, r) => ({
        requests: acc.requests + r.requests,
        pageViews: acc.pageViews + r.pageViews,
        uniques: acc.uniques + r.uniques,
      }),
      { requests: 0, pageViews: 0, uniques: 0 }
    );
    return { configured: true, ok: true, days, byDay, totals, ...breakdown };
  } catch (err) {
    return {
      configured: true,
      ok: false,
      error: err instanceof Error ? err.message : "Cloudflare Analytics fetch failed",
    };
  }
}
