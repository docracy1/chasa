import { describe, expect, it } from "vitest";
import { APP_ORIGIN_HEADER, configuredAppOrigin, isAllowedAppOrigin, requestAppOrigin } from "./appUrl";
import type { Env } from "../types";

function mockEnv(publicAppUrl: string): Env {
  return { PUBLIC_APP_URL: publicAppUrl } as unknown as Env;
}

function mockRequest(env: Env, headers: Record<string, string>) {
  const lookup = new Map(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return { env, req: { header: (name: string) => lookup.get(name.toLowerCase()) } };
}

const prod = mockEnv("https://chasa.io");

describe("configuredAppOrigin", () => {
  it("normalises away a trailing slash", () => {
    expect(configuredAppOrigin(mockEnv("https://chasa.io/"))).toBe("https://chasa.io");
  });

  it("returns empty string when unset or unparseable", () => {
    expect(configuredAppOrigin(mockEnv(""))).toBe("");
    expect(configuredAppOrigin(mockEnv("not-a-url"))).toBe("");
  });
});

describe("isAllowedAppOrigin", () => {
  it("allows the configured origin and Pages hosts", () => {
    expect(isAllowedAppOrigin("https://chasa.io", prod)).toBe(true);
    expect(isAllowedAppOrigin("https://chasa-71s.pages.dev", prod)).toBe(true);
    expect(isAllowedAppOrigin("https://abc123.chasa-71s.pages.dev", prod)).toBe(true);
    expect(isAllowedAppOrigin("http://localhost:5173", prod)).toBe(true);
    expect(isAllowedAppOrigin("http://127.0.0.1:8788", prod)).toBe(true);
  });

  it("rejects lookalike and unrelated origins", () => {
    expect(isAllowedAppOrigin("https://chasa.io.evil.com", prod)).toBe(false);
    expect(isAllowedAppOrigin("https://evil.com", prod)).toBe(false);
    expect(isAllowedAppOrigin("https://evil-chasa.pages.dev", prod)).toBe(false);
    expect(isAllowedAppOrigin("https://chasa.pages.dev.evil.com", prod)).toBe(false);
    expect(isAllowedAppOrigin("", prod)).toBe(false);
  });

  it("trusts the brand domain in both cutover directions", () => {
    const preview = mockEnv("https://chasa-71s.pages.dev");
    expect(isAllowedAppOrigin("https://chasa.io", preview)).toBe(true);
    expect(isAllowedAppOrigin("https://www.chasa.io", preview)).toBe(true);
    expect(isAllowedAppOrigin("https://chasa-71s.pages.dev", prod)).toBe(true);
  });
});

describe("requestAppOrigin", () => {
  it("prefers the origin forwarded by the Pages proxy", () => {
    const c = mockRequest(prod, { [APP_ORIGIN_HEADER]: "https://chasa-71s.pages.dev" });
    expect(requestAppOrigin(c)).toBe("https://chasa-71s.pages.dev");
  });

  it("falls back to a trusted Origin header, then to PUBLIC_APP_URL", () => {
    expect(requestAppOrigin(mockRequest(prod, { Origin: "http://localhost:5173" }))).toBe("http://localhost:5173");
    expect(requestAppOrigin(mockRequest(prod, {}))).toBe("https://chasa.io");
  });

  it("ignores a spoofed forwarded origin", () => {
    const c = mockRequest(prod, { [APP_ORIGIN_HEADER]: "https://evil.com" });
    expect(requestAppOrigin(c)).toBe("https://chasa.io");
  });

  it("strips any path from a forwarded origin", () => {
    const c = mockRequest(prod, { [APP_ORIGIN_HEADER]: "https://chasa-71s.pages.dev/app/login" });
    expect(requestAppOrigin(c)).toBe("https://chasa-71s.pages.dev");
  });
});
