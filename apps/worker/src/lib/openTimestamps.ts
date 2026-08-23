import type { Env } from "../types";
import { listPendingTimestamps, recordTimestampConfirmed } from "./certificates";

/**
 * Minimal OpenTimestamps client — anchors a document's SHA-256 hash to the Bitcoin blockchain
 * via a public calendar server (https://opentimestamps.org). We never parse the .ots binary
 * format ourselves; we treat both the initial "pending" proof and the later "upgraded" proof as
 * opaque bytes, store them, and re-serve them for independent verification with the `ots` CLI or
 * any OpenTimestamps-compatible verifier. That's a deliberate scope choice: reimplementing the
 * Merkle-proof + Bitcoin-header verification logic ourselves would add real complexity for zero
 * trust benefit — the point of anchoring to Bitcoin is that verification doesn't have to trust us.
 *
 * Protocol (confirmed against the live calendar server):
 *   POST {calendar}/digest        body = raw 32-byte SHA-256 digest → pending proof bytes
 *   GET  {calendar}/timestamp/{hex digest} → 200 + upgraded proof bytes once Bitcoin-confirmed,
 *                                            404 while still pending (can take hours).
 */

const CALENDAR_URL = "https://alice.btc.calendar.opentimestamps.org";
const REQUEST_TIMEOUT_MS = 10_000;

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export type SubmitResult =
  | { ok: true; proofBase64: string; calendarUrl: string }
  | { ok: false; error: string };

/** Submit a document's SHA-256 hex digest for Bitcoin timestamping. Returns the initial
 *  "pending" proof — the calendar batches submissions and only anchors the aggregate root to
 *  Bitcoin periodically, so this does not mean confirmed yet. */
export async function submitTimestamp(sha256HexDigest: string): Promise<SubmitResult> {
  const digest = hexToBytes(sha256HexDigest);
  const res = await fetchWithTimeout(`${CALENDAR_URL}/digest`, {
    method: "POST",
    headers: { "Content-Type": "application/vnd.opentimestamps.v1" },
    body: digest,
  });
  if (!res || !res.ok) {
    return { ok: false, error: res ? `Calendar returned ${res.status}` : "Calendar unreachable" };
  }
  const bytes = new Uint8Array(await res.arrayBuffer());
  return { ok: true, proofBase64: bytesToBase64(bytes), calendarUrl: CALENDAR_URL };
}

export type UpgradeResult =
  | { ok: true; confirmed: true; proofBase64: string }
  | { ok: true; confirmed: false }
  | { ok: false; error: string };

// The OpenTimestamps "BitcoinBlockHeaderAttestation" tag — its presence in the proof bytes is
// what actually distinguishes a Bitcoin-confirmed timestamp from one still sitting in the
// calendar's pending Merkle tree. A 200 response alone doesn't guarantee that: the calendar can
// return an upgraded-but-still-calendar-pending proof, so we check for the real marker rather
// than trusting the HTTP status code.
const BITCOIN_ATTESTATION_TAG = new Uint8Array([0x05, 0x88, 0x96, 0x0d, 0x73, 0xd7, 0x19, 0x01]);

function containsSubsequence(haystack: Uint8Array, needle: Uint8Array): boolean {
  outer: for (let i = 0; i <= haystack.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return true;
  }
  return false;
}

/** Check whether a previously-submitted digest now has a Bitcoin-confirmed proof available.
 *  404 means "not yet" (still aggregating / waiting on confirmations) — normal, not an error. */
export async function checkUpgrade(sha256HexDigest: string, calendarUrl: string): Promise<UpgradeResult> {
  const res = await fetchWithTimeout(`${calendarUrl}/timestamp/${sha256HexDigest}`, { method: "GET" });
  if (!res) return { ok: false, error: "Calendar unreachable" };
  if (res.status === 404) return { ok: true, confirmed: false };
  if (!res.ok) return { ok: false, error: `Calendar returned ${res.status}` };
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (!containsSubsequence(bytes, BITCOIN_ATTESTATION_TAG)) {
    // Calendar aggregated it into a Merkle tree already, but that tree's root hasn't itself
    // been anchored to a confirmed Bitcoin block yet — genuinely still pending.
    return { ok: true, confirmed: false };
  }
  return { ok: true, confirmed: true, proofBase64: bytesToBase64(bytes) };
}

export { base64ToBytes };

export async function sweepPendingTimestamps(env: Env): Promise<{ checked: number; confirmed: number }> {
  const pending = await listPendingTimestamps(env, 100);
  let confirmed = 0;
  for (const row of pending) {
    const result = await checkUpgrade(row.sha256_hash, row.ots_calendar_url);
    if (result.ok && result.confirmed) {
      await recordTimestampConfirmed(env, row.id, result.proofBase64);
      confirmed++;
    } else if (!result.ok) {
      console.error(`OpenTimestamps upgrade check failed for cert ${row.id}:`, result.error);
    }
  }
  return { checked: pending.length, confirmed };
}
