/**
 * Lightweight PDF text scrape + invoice field heuristics for Cloudflare Workers.
 * Not a full PDF parser — good enough to prefill Tool fields from many invoice PDFs.
 */

const MAX_EXTRACT_CHARS = 12_000;

export type InvoiceHints = {
  clientName: string | null;
  amount: number | null;
  dueDate: string | null;
  confidence: "none" | "low" | "medium" | "high";
};

/** Pull printable strings from PDF bytes (literal strings + readable runs). */
export function extractPdfText(bytes: ArrayBuffer): string {
  // Cap work — invoice text is almost always in the first few MB
  const u8 = new Uint8Array(bytes, 0, Math.min(bytes.byteLength, 2_000_000));
  const raw = new TextDecoder("latin1").decode(u8);

  const parts: string[] = [];

  // PDF literal strings: (....) with basic escape handling
  const literalRe = /\((?:\\.|[^\\)])*\)/g;
  let m: RegExpExecArray | null;
  while ((m = literalRe.exec(raw)) !== null) {
    const inner = m[0].slice(1, -1);
    const decoded = inner
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "\r")
      .replace(/\\t/g, "\t")
      .replace(/\\\(/g, "(")
      .replace(/\\\)/g, ")")
      .replace(/\\\\/g, "\\")
      .replace(/\\\d{1,3}/g, "");
    if (decoded.replace(/\s+/g, "").length >= 2) parts.push(decoded);
    if (parts.join(" ").length > MAX_EXTRACT_CHARS) break;
  }

  // Hex strings <...> that decode to printable ASCII
  const hexRe = /<([0-9A-Fa-f\s]+)>/g;
  while ((m = hexRe.exec(raw)) !== null) {
    const hex = m[1].replace(/\s+/g, "");
    if (hex.length < 4 || hex.length % 2 !== 0) continue;
    let s = "";
    for (let i = 0; i < hex.length; i += 2) {
      const code = parseInt(hex.slice(i, i + 2), 16);
      if (code >= 32 && code < 127) s += String.fromCharCode(code);
      else if (code === 10 || code === 13) s += " ";
    }
    if (s.trim().length >= 3) parts.push(s);
    if (parts.join(" ").length > MAX_EXTRACT_CHARS) break;
  }

  // Fallback: long printable ASCII runs (catches some compressed-adjacent leftovers)
  if (parts.length < 5) {
    const runRe = /[\x20-\x7E]{6,}/g;
    while ((m = runRe.exec(raw)) !== null) {
      const s = m[0].trim();
      if (/[A-Za-z]/.test(s) && !/^\/[A-Za-z]+$/.test(s)) parts.push(s);
      if (parts.join(" ").length > MAX_EXTRACT_CHARS) break;
    }
  }

  return parts.join(" ").replace(/\s+/g, " ").trim().slice(0, MAX_EXTRACT_CHARS);
}

function parseLooseAmount(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  // European: 1.250,50 or 1250,50
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(s) || /^\d+,\d{2}$/.test(s)) {
    const n = Number(s.replace(/\./g, "").replace(",", "."));
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  // US: 1,250.50 or 1250.50
  const us = Number(s.replace(/,/g, ""));
  return Number.isFinite(us) && us > 0 ? us : null;
}

function toIsoDate(y: number, mo: number, d: number): string | null {
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return dt.toISOString().slice(0, 10);
}

function parseLooseDate(raw: string): string | null {
  const s = raw.trim();
  // YYYY-MM-DD
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return toIsoDate(+m[1], +m[2], +m[3]);
  // DD.MM.YYYY or DD/MM/YYYY or DD-MM-YYYY
  m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (m) {
    const a = +m[1];
    const b = +m[2];
    const y = +m[3];
    // Prefer D/M/Y when first > 12, else assume D/M/Y (EU-leaning for Chasa)
    if (a > 12) return toIsoDate(y, b, a);
    if (b > 12) return toIsoDate(y, a, b);
    return toIsoDate(y, b, a);
  }
  // Month name
  m = s.match(
    /^(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2}),?\s+(\d{4})$/i
  );
  if (m) {
    const months: Record<string, number> = {
      jan: 1,
      feb: 2,
      mar: 3,
      apr: 4,
      may: 5,
      jun: 6,
      jul: 7,
      aug: 8,
      sep: 9,
      oct: 10,
      nov: 11,
      dec: 12,
    };
    const mo = months[m[1].slice(0, 3).toLowerCase()];
    return mo ? toIsoDate(+m[3], mo, +m[2]) : null;
  }
  return null;
}

function hintsFromFilename(name: string): Partial<InvoiceHints> {
  const base = name.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").trim();
  const out: Partial<InvoiceHints> = {};

  const amountMatch = base.match(
    /(?:\$|€|£)?\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?|\d+(?:[.,]\d{2})?)/
  );
  if (amountMatch) {
    const amt = parseLooseAmount(amountMatch[1]);
    if (amt && amt >= 1 && amt < 1_000_000) out.amount = amt;
  }

  const dateMatch = base.match(
    /(\d{4}-\d{2}-\d{2}|\d{1,2}[./-]\d{1,2}[./-]\d{2,4})/
  );
  if (dateMatch) {
    const d = parseLooseDate(dateMatch[1]);
    if (d) out.dueDate = d;
  }

  let client = base
    .replace(/\b(invoice|rechnung|inv|bill|statement|quote|angebot)\b/gi, " ")
    .replace(/(?:\$|€|£)\s*\d[\d.,]*/g, " ")
    .replace(/\d{4}-\d{2}-\d{2}/g, " ")
    .replace(/\d{1,2}[./-]\d{1,2}[./-]\d{2,4}/g, " ")
    .replace(/\b\d+([.,]\d+)?\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (client.length >= 2 && client.length <= 80) out.clientName = client;

  return out;
}

function hintsFromText(text: string): Partial<InvoiceHints> {
  const out: Partial<InvoiceHints> = {};
  const t = text;

  const amountPatterns = [
    /(?:amount\s*due|balance\s*due|total\s*due|open\s*balance|outstanding|gesamtbetrag|offener\s*betrag|rechnungsbetrag|fälliger\s*betrag)\s*[:#]?\s*(?:USD|EUR|GBP|\$|€|£)?\s*([\d.,]+)/i,
    /(?:total|summe|betrag)\s*[:#]?\s*(?:USD|EUR|GBP|\$|€|£)?\s*([\d.,]+)/i,
    /(?:\$|€|£)\s*([\d,]+\.\d{2})/,
    /(?:€|EUR)\s*([\d.]+,\d{2})/i,
  ];
  for (const re of amountPatterns) {
    const m = t.match(re);
    if (!m) continue;
    const amt = parseLooseAmount(m[1]);
    if (amt && amt >= 1 && amt < 1_000_000) {
      out.amount = amt;
      break;
    }
  }

  const datePatterns = [
    /(?:due\s*date|payment\s*due|fällig(?:keitsdatum)?|zahlbar\s*bis|pay\s*by)\s*[:#]?\s*([A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4}|\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[./-]\d{1,2}[./-]\d{2,4})/i,
    /(?:invoice\s*date|rechnungsdatum)\s*[:#]?\s*([A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4}|\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[./-]\d{1,2}[./-]\d{2,4})/i,
  ];
  for (const re of datePatterns) {
    const m = t.match(re);
    if (!m) continue;
    const d = parseLooseDate(m[1]);
    if (d) {
      out.dueDate = d;
      break;
    }
  }

  const clientPatterns = [
    /(?:bill\s*to|billed\s*to|invoice\s*to|customer|client|kunde|kundenname|empfänger)\s*[:#]\s*([A-Za-z0-9][A-Za-z0-9 .,&'\-]{0,60}?)(?=\s{2,}|\s*(?:amount|total|due|invoice|balance|date|zahl|betrag|fäll|rechnungs)|$)/i,
  ];
  for (const re of clientPatterns) {
    const m = t.match(re);
    if (!m) continue;
    const name = m[1].replace(/\s+/g, " ").trim();
    if (name.length >= 2 && name.length <= 80) {
      out.clientName = name;
      break;
    }
  }

  return out;
}

function scoreHints(h: InvoiceHints): InvoiceHints["confidence"] {
  const n = [h.clientName, h.amount, h.dueDate].filter((v) => v != null && v !== "").length;
  if (n === 0) return "none";
  if (n === 1) return "low";
  if (n === 2) return "medium";
  return "high";
}

export function parseInvoiceHints(filename: string, text: string): InvoiceHints {
  const fromFile = hintsFromFilename(filename);
  const fromText = text ? hintsFromText(text) : {};

  const hints: InvoiceHints = {
    clientName: fromText.clientName ?? fromFile.clientName ?? null,
    amount: fromText.amount ?? fromFile.amount ?? null,
    dueDate: fromText.dueDate ?? fromFile.dueDate ?? null,
    confidence: "none",
  };
  hints.confidence = scoreHints(hints);
  return hints;
}
