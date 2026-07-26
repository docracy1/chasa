// HMAC-SHA256 primitives. `hmacKey` is the one shared crypto primitive; `generateOpaqueToken` /
// `hashOpaqueToken` layer pure-random opaque bearer tokens (looked up by hash, never by raw value)
// on top of it for magic links and sessions.

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

// 32 bytes of entropy, base64url-encoded — the raw bearer token handed to the user (in a magic
// link URL or a session cookie).
export function generateOpaqueToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return base64UrlEncode(bytes);
}

// Hex-encoded HMAC-SHA256 of an opaque token — magic links and sessions are looked up in D1 by
// this hash, so a stolen database dump doesn't hand out working tokens.
export async function hashOpaqueToken(token: string, secret: string): Promise<string> {
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(token));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
