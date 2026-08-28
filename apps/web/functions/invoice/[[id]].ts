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
    clientAddress?: string | null;
    clientState?: string | null;
    clientPostal?: string | null;
    clientCountry?: string | null;
    clientVat?: string | null;
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
    certificatePublicId: string | null;
  };
  certificateStatus:
    | { certified: false }
    | { certified: true; matches: true; otsStatus: "none" | "pending" | "confirmed" | "failed" }
    | { certified: true; matches: false };
  from: {
    name: string;
    address?: string | null;
    state?: string | null;
    postal?: string | null;
    country?: string | null;
    vat?: string | null;
    logoDataUrl: string | null;
    paymentLink: string | null;
  };
};

function partyBlock(party: {
  name?: string | null;
  email?: string | null;
  address?: string | null;
  state?: string | null;
  postal?: string | null;
  country?: string | null;
  vat?: string | null;
}): string {
  const lines: string[] = [];
  if (party.name?.trim()) lines.push(escapeHtml(party.name.trim()));
  if (party.email?.trim()) lines.push(escapeHtml(party.email.trim()));
  if (party.address?.trim()) lines.push(escapeHtml(party.address.trim()));
  const city = [party.postal, party.state].filter((p) => p?.trim()).join(" ");
  if (city) lines.push(escapeHtml(city));
  if (party.country?.trim()) lines.push(escapeHtml(party.country.trim()));
  if (party.vat?.trim()) lines.push(`VAT: ${escapeHtml(party.vat.trim())}`);
  return lines.map((l) => `<div>${l}</div>`).join("");
}

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
  body { font-family: Inter, -apple-system, system-ui, "Segoe UI", sans-serif; max-width: 720px; margin: 40px auto; padding: 0 20px 48px; line-height: 1.55; color: #1B3155; background: #F2F4F8; }
  .sheet { background: #fff; border: 1px solid color-mix(in srgb, #1B3155 14%, #fff); border-radius: 12px; padding: 28px 28px 32px; box-shadow: 0 8px 24px color-mix(in srgb, #1B3155 6%, transparent); }
  .actions { display: flex; flex-wrap: wrap; gap: 10px; margin: 0 0 16px; }
  .actions button, .actions a.btn {
    appearance: none; border: none; cursor: pointer; font: inherit; font-size: 14px; font-weight: 600;
    padding: 10px 16px; border-radius: 8px; text-decoration: none; display: inline-flex; align-items: center; gap: 8px;
  }
  .btn-download { background: #EC683C; color: #fff; }
  .btn-download:hover { background: color-mix(in srgb, #EC683C 88%, #1B3155); }
  .btn-secondary { background: #fff; color: #1B3155; border: 1px solid color-mix(in srgb, #1B3155 14%, #fff) !important; }
  .btn-secondary:hover { background: #F2F4F8; }
  .brand { display: flex; align-items: center; gap: 10px; margin-bottom: 24px; }
  .brand img { width: 32px; height: 32px; border-radius: 6px; }
  .head-row { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 16px; }
  .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0 8px; font-size: 14px; }
  .parties .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: #6b7280; margin-bottom: 6px; font-weight: 600; }
  @media (max-width: 560px) { .parties { grid-template-columns: 1fr; } }
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
  .cert-row { margin-top: 20px; padding-top: 16px; border-top: 1px solid #e5e7eb; }
  .cert-row.tampered { border-top: none; padding: 14px 16px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; }
  .cert-badge { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; }
  .cert-badge.confirmed { color: #b45309; }
  .cert-badge.pending { color: #2e7d32; }
  .cert-badge.tampered { color: #b91c1c; font-size: 14px; }
  .cert-note { font-size: 12.5px; color: #6b7280; margin-top: 4px; }
  .cert-note a { color: #EC683C; }
  .cert-note.tampered-note { color: #7f1d1d; }
  footer { margin-top: 32px; font-size: 12px; color: #666; }
  a { color: #EC683C; }
  @media print {
    body { background: #fff; margin: 0; padding: 0; }
    .sheet { border: none; box-shadow: none; border-radius: 0; padding: 0; }
    .actions, .pay-link { display: none !important; }
  }
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
  const workerBase = context.env.WORKER_URL || "https://api.docstoc.io";
  const canonical = `${url.origin}/invoice/${encodeURIComponent(id)}`;

  const upstream = await fetch(`${workerBase}/api/invoices/public/${encodeURIComponent(id)}`, {
    headers: { "X-Docstoc-App-Origin": url.origin },
  }).catch(() => null);

  if (!upstream || upstream.status === 404) {
    return new Response(
      renderPage({
        title: "Invoice not found — docstoc",
        canonical,
        body: `<h1>Invoice not found</h1><p>This invoice link doesn't match anything on file. Check that you have the full link.</p><p><a href="https://docstoc.io/">docstoc</a></p>`,
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

  const { invoice, certificateStatus, from } = (await upstream.json()) as InvoiceResponse;
  const title = `Invoice ${invoice.invoiceNumber} — ${from.name}`;

  let certBlock = "";
  if (certificateStatus.certified && !certificateStatus.matches) {
    // The row's current content no longer hashes to what was certified at send time — this is
    // the actual point of certifying: the mismatch is visible instead of silently invisible.
    certBlock = `<div class="cert-row tampered">
        <span class="cert-badge tampered">⚠ Content does not match its certificate</span>
        <p class="cert-note tampered-note">This invoice was certified when it was sent, but its current content no longer matches that certified hash — meaning it was altered after certification. Treat this invoice with caution and confirm the amount directly with the sender.</p>
      </div>`;
  } else if (certificateStatus.certified && certificateStatus.matches && invoice.certificatePublicId) {
    const verifyUrl = `${url.origin}/verify/${invoice.certificatePublicId}`;
    certBlock =
      certificateStatus.otsStatus === "confirmed"
        ? `<div class="cert-row">
            <span class="cert-badge confirmed">₿ Certified &amp; Bitcoin-timestamped</span>
            <p class="cert-note">This invoice's exact content is hashed and anchored to the Bitcoin blockchain via OpenTimestamps — <a href="${escapeHtml(verifyUrl)}">verify it independently</a> of docstoc's own records. Its content still matches what was certified when it was sent.</p>
          </div>`
        : `<div class="cert-row">
            <span class="cert-badge pending">✓ Certified</span>
            <p class="cert-note">This invoice's exact content is hashed and certified — <a href="${escapeHtml(verifyUrl)}">verify it</a>. Its Bitcoin timestamp is still pending confirmation, usually a few hours.</p>
          </div>`;
  }

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

  const autoDownload = url.searchParams.get("download") === "1";
  const printTitle = JSON.stringify(`Invoice ${invoice.invoiceNumber}`);

  const body = `
<div class="actions" role="toolbar" aria-label="Invoice actions">
  <button type="button" class="btn-download" id="download-pdf">Download PDF</button>
  <button type="button" class="btn-secondary" id="copy-link">Copy share link</button>
</div>
<article class="sheet">
<div class="brand">
  ${from.logoDataUrl ? `<img src="${escapeHtml(from.logoDataUrl)}" alt="">` : `<img src="https://docstoc.io/brand/docstoc-icon.png" alt="">`}
  <strong>${escapeHtml(from.name)}</strong>
</div>
<div class="head-row">
  <div>
    <h1>Invoice ${escapeHtml(invoice.invoiceNumber)}</h1>
    <p class="meta">Issued ${escapeHtml(formatUsDate(invoice.issueDate))} &middot; Due ${escapeHtml(formatUsDate(invoice.dueDate))}</p>
  </div>
  <span class="status ${invoice.status}">${invoice.status === "paid" ? "✓ Paid" : invoice.status === "sent" ? "Sent" : "Draft"}</span>
</div>
<div class="parties">
  <div>
    <div class="label">From</div>
    ${partyBlock(from)}
  </div>
  <div>
    <div class="label">Bill to</div>
    ${partyBlock({
      name: invoice.clientName,
      email: invoice.clientEmail,
      address: invoice.clientAddress,
      state: invoice.clientState,
      postal: invoice.clientPostal,
      country: invoice.clientCountry,
      vat: invoice.clientVat,
    })}
  </div>
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
${certBlock}

<footer>
  Generated via <a href="https://docstoc.io/">docstoc</a>.
</footer>
</article>
<script>
(function () {
  var downloadBtn = document.getElementById("download-pdf");
  var copyBtn = document.getElementById("copy-link");
  function downloadPdf() {
    document.title = ${printTitle};
    window.print();
  }
  if (downloadBtn) downloadBtn.addEventListener("click", downloadPdf);
  if (copyBtn) copyBtn.addEventListener("click", function () {
    var shareUrl = location.href.replace(/[?&]download=1/, "").replace(/\\?$/, "");
    navigator.clipboard.writeText(shareUrl).then(function () {
      copyBtn.textContent = "Copied!";
      setTimeout(function () { copyBtn.textContent = "Copy share link"; }, 1600);
    }).catch(function () {});
  });
  ${autoDownload ? "window.addEventListener('load', function () { setTimeout(downloadPdf, 250); });" : ""}
})();
</script>`;

  return new Response(renderPage({ title, canonical, body }), {
    status: 200,
    headers: { "Content-Type": "text/html; charset=UTF-8" },
  });
};
