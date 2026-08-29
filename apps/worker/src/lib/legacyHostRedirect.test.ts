import { describe, expect, it } from "vitest";
import { legacyApiRedirectUrl } from "./legacyHostRedirect";

describe("legacyApiRedirectUrl", () => {
  it("redirects api.chasa.io to api.docstoc.io preserving path and query", () => {
    expect(
      legacyApiRedirectUrl("https://api.chasa.io/api/auth/google/callback?code=x&state=y")
    ).toBe("https://api.docstoc.io/api/auth/google/callback?code=x&state=y");
  });

  it("leaves api.docstoc.io unchanged", () => {
    expect(legacyApiRedirectUrl("https://api.docstoc.io/mcp")).toBeNull();
  });
});
