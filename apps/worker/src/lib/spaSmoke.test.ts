import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  extractMainModuleSrc,
  isJavascriptContentType,
  looksLikeHtmlFallback,
  runSpaSmokeAndAlert,
  runSpaSmokeChecks,
} from "./spaSmoke";
import * as email from "./email";
import type { Env } from "../types";

const HTML_OK = `<!doctype html><html><head>
<script type="module" crossorigin src="/assets/app-abc.js"></script>
</head><body><div id="root"></div></body></html>`;
const JS_OK = "import{x}from\"./chunk.js\";";

/** checkAuthConfig calls app.request() in-process (no real fetch) — see spaSmoke.ts for why. A
 *  fake app is enough since these tests only care about the page/asset checks, which still go
 *  through real fetch() mocks below. */
function fakeApp(): { request: () => Promise<Response> } {
  return {
    request: async () =>
      new Response(JSON.stringify({ turnstileSiteKey: "0x" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
  };
}

type Query = { sql: string; args: unknown[] };

function mockEnv(overrides: Partial<Env> = {}): { env: Env; queries: Query[] } {
  const store = new Map<string, string>();
  const queries: Query[] = [];
  const db = {
    prepare(sql: string) {
      return {
        bind: (...args: unknown[]) => {
          queries.push({ sql, args });
          return {
            all: async () => ({ results: [] }),
            first: async () => {
              if (sql.includes("SELECT value") && args[0] === "spa-smoke") {
                const v = store.get("spa-smoke");
                return v ? { value: v } : null;
              }
              return null;
            },
            run: async () => {
              if (sql.includes("INSERT INTO smoke_alert_state")) {
                store.set(String(args[0]), String(args[1]));
              }
              if (sql.includes("DELETE FROM smoke_alert_state")) {
                store.delete(String(args[0]));
              }
              return { meta: { changes: 1 } };
            },
          };
        },
        run: async () => ({ meta: { changes: 1 } }),
        first: async () => null,
      };
    },
  };
  return {
    env: {
      CHASA_DB: db,
      PUBLIC_APP_URL: "https://chasa.io",
      PUBLIC_WORKER_URL: "https://api.chasa.io",
      FEEDBACK_EMAIL: "founder@chasa.io",
      TOKEN_SECRET: "x",
      ...overrides,
    } as unknown as Env,
    queries,
  };
}

beforeEach(() => {
  vi.spyOn(email, "sendSpaSmokeAlert").mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("helpers", () => {
  it("extracts module script", () => {
    expect(extractMainModuleSrc(HTML_OK)).toBe("/assets/app-abc.js");
  });
  it("detects js content-type and html fallback", () => {
    expect(isJavascriptContentType("application/javascript")).toBe(true);
    expect(isJavascriptContentType("text/html")).toBe(false);
    expect(looksLikeHtmlFallback("<!DOCTYPE html>")).toBe(true);
    expect(looksLikeHtmlFallback(JS_OK)).toBe(false);
  });
});

describe("runSpaSmokeChecks", () => {
  it("fails when /assets/*.js returns text/html", async () => {
    vi.spyOn(global, "fetch").mockImplementation(async () => {
      return new Response(HTML_OK, { status: 200, headers: { "Content-Type": "text/html" } });
    });
    const { env } = mockEnv();
    const failures = await runSpaSmokeChecks(env, fakeApp() as never);
    expect(failures.some((f) => f.detail.includes("text/html"))).toBe(true);
  });
});

describe("runSpaSmokeAndAlert", () => {
  function mockBroken() {
    vi.spyOn(global, "fetch").mockImplementation(async () => {
      return new Response(HTML_OK, { status: 200, headers: { "Content-Type": "text/html" } });
    });
  }

  it("does not alert on a single failing run (needs 2 consecutive to confirm)", async () => {
    mockBroken();
    const { env } = mockEnv();
    await runSpaSmokeAndAlert(env, fakeApp() as never);
    expect(email.sendSpaSmokeAlert).not.toHaveBeenCalled();
  });

  it("emails founder@chasa.io once the same failure is confirmed on a second run, then dedupes", async () => {
    mockBroken();
    const { env } = mockEnv();
    await runSpaSmokeAndAlert(env, fakeApp() as never);
    await runSpaSmokeAndAlert(env, fakeApp() as never);
    await runSpaSmokeAndAlert(env, fakeApp() as never);
    expect(email.sendSpaSmokeAlert).toHaveBeenCalledTimes(1);
    expect(vi.mocked(email.sendSpaSmokeAlert).mock.calls[0][1]).toBe("founder@chasa.io");
  });
});
