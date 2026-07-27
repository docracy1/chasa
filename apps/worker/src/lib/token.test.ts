import { describe, expect, it } from "vitest";
import {
  hashOpaqueToken,
  hashOpaqueTokenLegacy,
  hashOpaqueTokenLookup,
} from "./token";

describe("token purpose hashes", () => {
  const token = "opaque-test-token-value";
  const secret = "test-secret-key-for-hmac";

  it("purpose hashes differ for different purposes", async () => {
    const session = await hashOpaqueToken(token, secret, "session");
    const apiKey = await hashOpaqueToken(token, secret, "api-key");
    const invite = await hashOpaqueToken(token, secret, "invite");
    expect(session).not.toBe(apiKey);
    expect(apiKey).not.toBe(invite);
    expect(session).not.toBe(invite);
  });

  it("legacy lookup includes purpose hash and legacy hash", async () => {
    const legacy = await hashOpaqueTokenLegacy(token, secret);
    const lookup = await hashOpaqueTokenLookup(token, secret, "session");
    expect(lookup).toHaveLength(2);
    expect(lookup[0]).toBe(await hashOpaqueToken(token, secret, "session"));
    expect(lookup[1]).toBe(legacy);
  });
});
