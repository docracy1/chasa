import { describe, expect, it } from "vitest";
import { purgeExpiredSessions } from "./sessionCleanup";
import type { Env } from "../types";

function mockEnv(): Env {
  const calls: string[] = [];
  const db = {
    prepare(sql: string) {
      calls.push(sql);
      return {
        bind: (..._args: unknown[]) => ({
          run: async () => ({ meta: { changes: 1 } }),
        }),
      };
    },
  };
  return { CHASA_DB: db, calls } as unknown as Env & { calls: string[] };
}

describe("purgeExpiredSessions", () => {
  it("deletes expired sessions, admin sessions, magic links, and old rate limits", async () => {
    const env = mockEnv();
    const envWithCalls = env as Env & { calls: string[] };
    const deleted = await purgeExpiredSessions(env);
    expect(deleted).toBe(4);
    expect(envWithCalls.calls.some((s) => s.includes("sessions"))).toBe(true);
    expect(envWithCalls.calls.some((s) => s.includes("admin_sessions"))).toBe(true);
    expect(envWithCalls.calls.some((s) => s.includes("magic_links"))).toBe(true);
    expect(envWithCalls.calls.some((s) => s.includes("rate_limits"))).toBe(true);
  });
});
