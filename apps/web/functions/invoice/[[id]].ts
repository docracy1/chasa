// Public, printable invoice page. A Pages Function (not an SPA route) so the client just gets a
// link they can open, print to PDF, or forward — no login, no React bundle required.

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatUsDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatMoney(n: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
}

type LineItem = { description: string; quantity: number; unitPrice: number };

type InvoiceResponse = {
  invoice: {
    publicId: string;
    invoiceNumber: string;
    clientName: string;
    clientEmail: string | null;
    issueDate: string;
    dueDate: string;
    currency: string;
    lineItems: LineItem[];
    taxRate: number;
    notes: string | null;
    subtotal: number;
    taxAmount: number;
    total: number;
    status: "draft" | "sent" | "paid";
  };
  from: { name: string; logoDataUrl: string | null; paymentLink: string | null };
};

function renderPage(opts: { title: string; body: string; canonical: string }): string {
  return `<!DOCTYPE html>
<html lang="en-US">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(opts.title)}</title>
<link rel="canonical" href="${escapeHtml(opts.canonical)}">
<meta name="robots" content="noindex">
<style>
  body { font-family: -apple-system, system-ui, "Segoe UI", sans-serif; max-width: 720px; margin: 40px auto; padding: 0 20px; line-height: 1.55; color: #1B3155; }
  .brand { display: flex; align-items: center; gap: 10px; margin-bottom: 24px; }
  .brand img { width: 32px; height: 32px; border-radius: 6px; }
  .head-row { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 16px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .status { display: inline-flex; align-items: center; gap: 6px; font-weight: 600; font-size: 13px; padding: 3px 10px; border-radius: 999px; }
  .status.paid { color: #1a7f37; background: #eaf6ec; }
  .status.sent { color: #b45309; background: #fdf3e3; }
  .status.draft { color: #6b7280; background: #f0f2f5; }
  .meta { color: #556; font-size: 14px; margin-top: 8px; }
  table { width: 100%; border-collapse: collapse; margin: 24px 0; }
  th, td { text-align: left; padding: 8px 6px; border-bottom: 1px solid #e5e7eb; font-size: 14px; }
  th { color: #556; font-weight: 600; font-size: 12.5px; text-transform: uppercase; letter-spacing: 0.02em; }
  td.num, th.num { text-align: right; }
  .totals { margin-left: auto; width: 260px; margin-top: 8px; }
  .totals div { display: flex; justify-content: space-between; padding: 4px 0; font-size: 14px; }
  .totals .grand { font-weight: 700; font-size: 17px; border-top: 1px solid #d8dee8; padding-top: 8px; margin-top: 4px; }
  .notes { margin-top: 24px; padding: 14px; background: #fafbfc; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 14px; }
  .pay-link { display: inline-block; margin-top: 20px; padding: 10px 18px; background: #1B3155; color: #fff; border-radius: 8px; text-decoration: none; font-weight: 600; }
  footer { margin-top: 32px; font-size: 12px; color: #666; }
  a { color: #2e5bdb; }
  @media print { .pay-link { display: none; } }
</style>
</head>
<body>
${opts.body}
</body>
</html>`;
}

export const onRequest: PagesFunction<{ WORKER_URL: string }> = async (context) => {
  const idParam = context.params.id;
  const id = Array.isArray(idParam) ? idParam[0] : idParam || "";
  const url = new URL(context.request.url);
  const workerBase = context.env.WORKER_URL || "https://api.chasa.io";
  const canonical = `${url.origin}/invoice/${encodeURIComponent(id)}`;

  const upstream = await fetch(`${workerBase}/api/invoices/public/${encodeURIComponent(id)}`, {
    headers: { "X-Chasa-App-Origin": url.origin },
  }).catch(() => null);

  if (!upstream || upstream.status === 404) {
    return new Response(
      renderPage({
        title: "Invoice not found — docstoc",
        canonical,
        body: `<h1>Invoice not found</h1><p>This invoice link doesn't match anything on file. Check that you have the full link.</p><p><a href="https://chasa.io/">docstoc</a></p>`,
      }),
      { status: 404, headers: { "Content-Type": "text/html; charset=UTF-8" } }
    );
  }

  if (!upstream.ok) {
    return new Response(
      renderPage({
        title: "Invoice unavailable — docstoc",
        canonical,
        body: `<h1>Invoice temporarily unavailable</h1><p>Try again in a moment.</p>`,
      }),
      { status: 502, headers: { "Content-Type": "text/html; charset=UTF-8" } }
    );
  }

  const { invoice, from } = (await upstream.json()) as InvoiceResponse;
  const title = `Invoice ${invoice.invoiceNumber} — ${from.name}`;

  const rows = invoice.lineItems
    .map(
      (item) => `<tr>
        <td>${escapeHtml(item.description)}</td>
        <td class="num">${item.quantity}</td>
        <td class="num">${formatMoney(item.unitPrice, invoice.currency)}</td>
        <td class="num">${formatMoney(item.quantity * item.unitPrice, invoice.currency)}</td>
      </tr>`
    )
    .join("");

  const body = `
<div class="brand">
  ${from.logoDataUrl ? `<img src="${escapeHtml(from.logoDataUrl)}" alt="">` : `<img src="https://chasa.io/brand/docstoc-icon.png" alt="">`}
  <strong>${escapeHtml(from.name)}</strong>
</div>
<div class="head-row">
  <div>
    <h1>Invoice ${escapeHtml(invoice.invoiceNumber)}</h1>
    <p class="meta">Billed to ${escapeHtml(invoice.clientName)}${invoice.clientEmail ? ` (${escapeHtml(invoice.clientEmail)})` : ""}</p>
    <p class="meta">Issued ${escapeHtml(formatUsDate(invoice.issueDate))} &middot; Due ${escapeHtml(formatUsDate(invoice.dueDate))}</p>
  </div>
  <span class="status ${invoice.status}">${invoice.status === "paid" ? "✓ Paid" : invoice.status === "sent" ? "Sent" : "Draft"}</span>
</div>

<table>
  <thead>
    <tr><th>Description</th><th class="num">Qty</th><th class="num">Rate</th><th class="num">Amount</th></tr>
  </thead>
  <tbody>${rows}</tbody>
</table>

<div class="totals">
  <div><span>Subtotal</span><span>${formatMoney(invoice.subtotal, invoice.currency)}</span></div>
  ${invoice.taxRate > 0 ? `<div><span>Tax (${invoice.taxRate}%)</span><span>${formatMoney(invoice.taxAmount, invoice.currency)}</span></div>` : ""}
  <div class="grand"><span>Total</span><span>${formatMoney(invoice.total, invoice.currency)}</span></div>
</div>

${invoice.notes ? `<div class="notes">${escapeHtml(invoice.notes)}</div>` : ""}
${from.paymentLink ? `<a class="pay-link" href="${escapeHtml(from.paymentLink)}" target="_blank" rel="noopener noreferrer">Pay this invoice</a>` : ""}

<footer>
  Generated via <a href="https://chasa.io/">docstoc</a>.
</footer>`;

  return new Response(renderPage({ title, canonical, body }), {
    status: 200,
    headers: { "Content-Type": "text/html; charset=UTF-8" },
  });
};
