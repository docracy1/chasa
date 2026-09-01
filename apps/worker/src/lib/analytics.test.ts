import { describe, expect, it } from "vitest";
import { campaignTagFromReferralProps, getFunnelStats, trackEvent } from "./analytics";
import type { Env } from "../types";

type Query = { sql: string; args: unknown[] };

function mockEnv(): { env: Env; queries: Query[] } {
  const queries: Query[] = [];
  const db = {
    prepare(sql: string) {
      return {
        bind: (...args: unknown[]) => {
          queries.push({ sql, args });
          return {
            all: async () => ({ results: [] }),
            first: async () => null,
            run: async () => ({ meta: { changes: 1 } }),
          };
        },
      };
    },
  };
  return { env: { CHASA_DB: db } as unknown as Env, queries };
}

const CHROME_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";

/** Column order of the analytics_events insert. */
const IS_BOT_ARG = 6;

describe("trackEvent", () => {
  it("flags a classified crawler", async () => {
    const { env, queries } = mockEnv();
    await trackEvent(env, { name: "landingpage_loaded", userAgent: "Mozilla/5.0 (compatible; GPTBot/1.2)" });
    expect(queries[0].args[IS_BOT_ARG]).toBe(1);
  });

  it("records a browser user agent as human", async () => {
    const { env, queries } = mockEnv();
    await trackEvent(env, { name: "landingpage_loaded", userAgent: CHROME_UA });
    expect(queries[0].args[IS_BOT_ARG]).toBe(0);
  });

  // Cron sweeps and Resend sends have no request behind them; they must not be filed as crawlers.
  it("records an event with no user agent as human", async () => {
    const { env, queries } = mockEnv();
    await trackEvent(env, { name: "email_sent" });
    expect(queries[0].args[IS_BOT_ARG]).toBe(0);
  });

  it("ignores events outside the allowlist", async () => {
    const { env, queries } = mockEnv();
    await trackEvent(env, { name: "not_a_real_event" });
    expect(queries).toHaveLength(0);
  });
});

describe("getFunnelStats", () => {
  it("filters every event read when humansOnly is set", async () => {
    const { env, queries } = mockEnv();
    await getFunnelStats(env, 30, true);

    const eventQueries = queries.filter((q) => q.sql.includes("analytics_events"));
    expect(eventQueries.length).toBeGreaterThan(0);
    // Both the step rows and the KPI totals, or the funnel would compare two audiences.
    for (const q of eventQueries) {
      expect(q.sql).toContain("COALESCE(is_bot, 0) = 0");
    }
  });

  it("counts crawlers too when the filter is off", async () => {
    const { env, queries } = mockEnv();
    await getFunnelStats(env, 30);

    expect(queries.some((q) => q.sql.includes("analytics_events"))).toBe(true);
    expect(queries.some((q) => q.sql.includes("is_bot"))).toBe(false);
  });

  it("reports which audience the counts describe", async () => {
    const { env } = mockEnv();
    expect((await getFunnelStats(env, 7, true)).humansOnly).toBe(true);
    expect((await getFunnelStats(env, 7)).humansOnly).toBe(false);
  });
});

describe("campaignTagFromReferralProps", () => {
  it("reads seo CTA utm_source token", () => {
    expect(
      campaignTagFromReferralProps({ utm_source: "seo-daycare-registration-form" })
    ).toBe("seo-daycare-registration-form");
  });

  it("reads utm source/campaign pairs", () => {
    expect(
      campaignTagFromReferralProps({ utm_source: "outreach", utm_campaign: "dm" })
    ).toBe("outreach/dm");
  });

  it("reads seo-* ref param", () => {
    expect(campaignTagFromReferralProps({ ref: "seo-digicert-alternative" })).toBe(
      "seo-digicert-alternative"
    );
  });

  it("ignores generic ref like producthunt", () => {
    expect(campaignTagFromReferralProps({ ref: "producthunt" })).toBe("");
  });
});
