import { describe, expect, it } from "vitest";
import { timingSafeEqual } from "./cryptoUtils";

describe("timingSafeEqual", () => {
  it("matches equal strings", () => {
    expect(timingSafeEqual("abc", "abc")).toBe(true);
  });

  it("rejects different strings", () => {
    expect(timingSafeEqual("abc", "abd")).toBe(false);
    expect(timingSafeEqual("abc", "ab")).toBe(false);
  });
});
