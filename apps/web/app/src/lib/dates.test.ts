import { describe, expect, it } from "vitest";
import { daysOverdue } from "./dates";

describe("daysOverdue", () => {
  it("returns 0 for future due dates", () => {
    const future = new Date();
    future.setDate(future.getDate() + 5);
    const iso = future.toISOString().slice(0, 10);
    expect(daysOverdue(iso)).toBe(0);
  });

  it("returns positive for past due dates", () => {
    expect(daysOverdue("2020-01-01")).toBeGreaterThan(100);
  });
});
