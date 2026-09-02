import type { Env } from "../types";
import { detectBot } from "./analytics";

const CF_API = "https://api.cloudflare.com/client/v4";
const GRAPHQL_URL = `${CF_API}/graphql`;
/** Legacy fallback if zone lookup fails (chasa.io). */
const LEGACY_CHASA_ZONE_ID = "b270fd325fb601987a9f5fd3e406530b";

/** Public marketing zones to aggregate — docstoc is primary post-cutover; chasa still redirects. */
const DEFAULT_ZONE_NAMES = ["docstoc.io", "chasa.io"];

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

/** Resolve zone IDs from env override or live zone lookup (docstoc.io + chasa.io). */
export async function resolveAnalyticsZoneIds(env: Env): Promise<{ ids: string[]; labels: string[] }> {
  const override = env.CF_ANALYTICS_ZONE_IDS?.trim();
  if (override) {
    const ids = override.split(",").map((s) => s.trim()).filter(Boolean);
    return { ids: [...new Set(ids)], labels: ids.map((id) => id.slice(0, 8)) };
  }

  if (!env.CF_ANALYTICS_TOKEN) return { ids: [], labels: [] };

  const ids: string[] = [];
  const labels: string[] = [];
  for (const name of DEFAULT_ZONE_NAMES) {
    try {
      const res = await fetch(`${CF_API}/zones?name=${encodeURIComponent(name)}&status=active`, {
        headers: { Authorization: `Bearer ${env.CF_ANALYTICS_TOKEN}` },
      });
      if (!res.ok) continue;
      const json = (await res.json()) as { result?: { id: string; name: string }[] };
      const zone = json.result?.[0];
      if (zone?.id) {
        ids.push(zone.id);
        labels.push(zone.name);
      }
    } catch {
      /* try next zone */
    }
  }

  if (ids.length === 0) {
    return { ids: [LEGACY_CHASA_ZONE_ID], labels: ["chasa.io (fallback)"] };
  }
  return { ids: [...new Set(ids)], labels };
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

async function fetchDailyTotalsForZone(
  env: Env,
  zoneId: string,
  sinceDay: string,
  untilDay: string
): Promise<CfDayTotal[]> {
  const query = `query {
    viewer {
      zones(filter: { zoneTag: "${zoneId}" }) {
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
  return rows.map((r) => ({
    day: r.dimensions.date,
    requests: Number(r.sum.requests),
    pageViews: Number(r.sum.pageViews),
    uniques: Number(r.uniq.uniques),
  }));
}

function mergeDailyTotals(all: CfDayTotal[]): CfDayTotal[] {
  const byDay = new Map<string, CfDayTotal>();
  for (const row of all) {
    const prev = byDay.get(row.day);
    if (!prev) byDay.set(row.day, { ...row });
    else {
      prev.requests += row.requests;
      prev.pageViews += row.pageViews;
      prev.uniques += row.uniques;
    }
  }
  return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
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

async function fetchDayBreakdownForZone(env: Env, zoneId: string, day: string): Promise<CfBreakdown> {
  const geq = `${day}T00:00:00Z`;
  const lt = new Date(new Date(`${day}T00:00:00Z`).getTime() + 24 * 60 * 60 * 1000).toISOString();
  const filter = `filter: { datetime_geq: "${geq}", datetime_lt: "${lt}", requestSource: "eyeball" }`;
  const query = `query {
    viewer {
      zones(filter: { zoneTag: "${zoneId}" }) {
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

function mergeBreakdowns(parts: CfBreakdown[]): CfBreakdown {
  if (parts.length === 0) {
    return {
      day: "",
      eyeballRequests: 0,
      botCount: 0,
      humanCount: 0,
      botPct: 0,
      byBot: [],
      byRoute: [],
      byCountry: [],
      byDevice: [],
    };
  }
  const day = parts[0].day;
  let eyeballRequests = 0;
  let botCount = 0;
  const byBotMap = new Map<string, number>();
  const byRouteMap = new Map<string, number>();
  const byCountryMap = new Map<string, number>();
  const byDeviceMap = new Map<string, number>();

  for (const p of parts) {
    eyeballRequests += p.eyeballRequests;
    botCount += p.botCount;
    for (const r of p.byBot) byBotMap.set(r.bot, (byBotMap.get(r.bot) ?? 0) + r.count);
    for (const r of p.byRoute) byRouteMap.set(r.path, (byRouteMap.get(r.path) ?? 0) + r.count);
    for (const r of p.byCountry) byCountryMap.set(r.country, (byCountryMap.get(r.country) ?? 0) + r.count);
    for (const r of p.byDevice) byDeviceMap.set(r.device, (byDeviceMap.get(r.device) ?? 0) + r.count);
  }

  const top = (map: Map<string, number>, limit: number) =>
    [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([k, count]) => count);

  return {
    day,
    eyeballRequests,
    botCount,
    humanCount: Math.max(0, eyeballRequests - botCount),
    botPct: eyeballRequests > 0 ? Math.round((botCount / eyeballRequests) * 100) : 0,
    byBot: [...byBotMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([bot, count]) => ({ bot, count })),
    byRoute: [...byRouteMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([path, count]) => ({ path, count })),
    byCountry: [...byCountryMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([country, count]) => ({ country, count })),
    byDevice: [...byDeviceMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([device, count]) => ({ device, count })),
  };
}

export type CfTrafficStats =
  | { configured: false }
  | { configured: true; ok: false; error: string }
  | ({
      configured: true;
      ok: true;
      days: number;
      zones: string[];
      byDay: CfDayTotal[];
      totals: { requests: number; pageViews: number; uniques: number };
    } & CfBreakdown);

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
    const { ids, labels } = await resolveAnalyticsZoneIds(env);
    const [dailyParts, breakdownParts] = await Promise.all([
      Promise.all(ids.map((id) => fetchDailyTotalsForZone(env, id, sinceDay, untilDay))),
      Promise.all(ids.map((id) => fetchDayBreakdownForZone(env, id, breakdownDay))),
    ]);

    const byDay = mergeDailyTotals(dailyParts.flat());
    const breakdown = mergeBreakdowns(breakdownParts);
    const totals = byDay.reduce(
      (acc, r) => ({
        requests: acc.requests + r.requests,
        pageViews: acc.pageViews + r.pageViews,
        uniques: acc.uniques + r.uniques,
      }),
      { requests: 0, pageViews: 0, uniques: 0 }
    );
    return { configured: true, ok: true, days, zones: labels, byDay, totals, ...breakdown };
  } catch (err) {
    return {
      configured: true,
      ok: false,
      error: err instanceof Error ? err.message : "Cloudflare Analytics fetch failed",
    };
  }
}
