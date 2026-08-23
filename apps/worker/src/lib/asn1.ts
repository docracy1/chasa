/** Minimal ASN.1 DER encoder — just enough to build a PKCS#10 CSR (see lib/acme.ts). Workers has
 *  no X.509/ASN.1 library and no Node `crypto` CSR support, so this is hand-rolled against the
 *  DER encoding rules (ITU-T X.690) rather than a general-purpose ASN.1 library. */

function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

/** DER length encoding: short form (<128) is a single byte; long form is 0x80|n-of-length-bytes
 *  followed by the length's big-endian bytes. */
function derLength(len: number): Uint8Array {
  if (len < 0x80) return new Uint8Array([len]);
  const bytes: number[] = [];
  let n = len;
  while (n > 0) {
    bytes.unshift(n & 0xff);
    n = Math.floor(n / 256);
  }
  return new Uint8Array([0x80 | bytes.length, ...bytes]);
}

function derTagged(tag: number, content: Uint8Array): Uint8Array {
  return concat(new Uint8Array([tag]), derLength(content.length), content);
}

export function derSequence(...content: Uint8Array[]): Uint8Array {
  return derTagged(0x30, concat(...content));
}

export function derSet(...content: Uint8Array[]): Uint8Array {
  return derTagged(0x31, concat(...content));
}

/** INTEGER — DER requires a leading 0x00 byte whenever the high bit of the first byte is set
 *  (so the value isn't misread as negative), and no unnecessary leading zero bytes otherwise. */
export function derInteger(bytes: Uint8Array): Uint8Array {
  let b = bytes;
  let start = 0;
  while (start < b.length - 1 && b[start] === 0 && (b[start + 1] & 0x80) === 0) start++;
  b = b.slice(start);
  if (b.length === 0) b = new Uint8Array([0]);
  if (b[0] & 0x80) b = concat(new Uint8Array([0]), b);
  return derTagged(0x02, b);
}

export function derSmallInt(n: number): Uint8Array {
  return derInteger(new Uint8Array([n]));
}

/** BIT STRING with zero unused bits (the only case this module needs — whole-byte payloads). */
export function derBitString(bytes: Uint8Array): Uint8Array {
  return derTagged(0x03, concat(new Uint8Array([0]), bytes));
}

export function derOctetString(bytes: Uint8Array): Uint8Array {
  return derTagged(0x04, bytes);
}

export function derIa5String(text: string): Uint8Array {
  return derTagged(0x16, new TextEncoder().encode(text));
}

/** OBJECT IDENTIFIER — first two arcs are combined as 40*a+b, remaining arcs use base-128
 *  encoding with the high bit set on all but the last byte of each arc. */
export function derOid(oid: string): Uint8Array {
  const parts = oid.split(".").map((p) => parseInt(p, 10));
  const first = parts[0] * 40 + parts[1];
  const arcs = [first, ...parts.slice(2)];
  const bytes: number[] = [];
  for (const arc of arcs) {
    const chunk: number[] = [arc & 0x7f];
    let n = arc >> 7;
    while (n > 0) {
      chunk.unshift((n & 0x7f) | 0x80);
      n >>= 7;
    }
    bytes.push(...chunk);
  }
  return derTagged(0x06, new Uint8Array(bytes));
}

/** Explicit/implicit context-specific constructed tag, e.g. `[0]` in CertificationRequestInfo's
 *  `attributes` field. tagNumber must be 0-30. */
export function derContextConstructed(tagNumber: number, ...content: Uint8Array[]): Uint8Array {
  return derTagged(0xa0 | tagNumber, concat(...content));
}

/** Implicit context-specific primitive tag, e.g. GeneralName's `dNSName [2] IA5String`. */
export function derContextPrimitive(tagNumber: number, content: Uint8Array): Uint8Array {
  return derTagged(0x80 | tagNumber, content);
}

/** Converts a raw fixed-length ECDSA signature (r||s, as returned by WebCrypto's ECDSA sign) into
 *  the DER SEQUENCE{INTEGER r, INTEGER s} that X.509/PKCS#10 signatures require. WebCrypto's JOSE
 *  (JWS) signing uses the raw form directly — never DER — so this conversion is CSR-only. */
export function rawEcdsaSignatureToDer(raw: Uint8Array): Uint8Array {
  const half = raw.length / 2;
  const r = raw.slice(0, half);
  const s = raw.slice(half);
  return derSequence(derInteger(r), derInteger(s));
}

export { concat };
