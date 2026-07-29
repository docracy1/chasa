// Opaque bearer tokens: looked up by HMAC hash, never stored raw.
// Per-purpose HKDF labels isolate session, magic-link, API key, etc.

export type TokenPurpose =
  | "session"
  | "magic-link"
  | "admin-session"
  | "invite"
  | "api-key"
  | "oauth-state"
  | "webhook-signing"
  | "google-login-state";

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function importMasterKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    "HKDF",
    false,
    ["deriveKey"]
  );
}

async function purposeHmacKey(secret: string, purpose: TokenPurpose): Promise<CryptoKey> {
  const master = await importMasterKey(secret);
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new Uint8Array(0),
      info: new TextEncoder().encode(`chasa:v1:${purpose}`),
    },
    master,
    { name: "HMAC", hash: "SHA-256", length: 256 },
    false,
    ["sign"]
  );
}

/** Legacy: single HMAC key from raw secret (pre-purpose tokens). */
export async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

async function hmacHex(key: CryptoKey, message: string): Promise<string> {
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function generateOpaqueToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return base64UrlEncode(bytes);
}

/** Hash with HKDF-derived purpose key (new tokens). */
export async function hashOpaqueToken(
  token: string,
  secret: string,
  purpose: TokenPurpose
): Promise<string> {
  const key = await purposeHmacKey(secret, purpose);
  return hmacHex(key, token);
}

/** Legacy hash for tokens created before purpose separation. */
export async function hashOpaqueTokenLegacy(token: string, secret: string): Promise<string> {
  const key = await hmacKey(secret);
  return hmacHex(key, token);
}

/** Lookup: try purpose hash, then legacy. */
export async function hashOpaqueTokenLookup(
  token: string,
  secret: string,
  purpose: TokenPurpose
): Promise<string[]> {
  return [await hashOpaqueToken(token, secret, purpose), await hashOpaqueTokenLegacy(token, secret)];
}
