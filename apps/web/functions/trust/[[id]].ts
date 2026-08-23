// Public trust profile page. Deliberately worded to claim only what's actually verified: DNS
// control of a domain (proven by a real, docstoc-issued SSL certificate) and, once confirmed, a
// Bitcoin-anchored "verified since" date. This never claims legal-entity or business-registry
// verification — docstoc doesn't check those, so the page doesn't say it does.

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatUsDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}

type PublicTrustProfile = {
  workspaceName: string;
  domain: string | null;
  domainStatus: "active" | "expiring" | "expired" | "none";
  verifiedSince: string;
  otsStatus: "none" | "pending" | "confirmed" | "failed";
  otsConfirmedAt: string | null;
};

function renderPage(opts: { title: string; body: string; canonical: string }): string {
  return `<!DOCTYPE html>
<html lang="en-US">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(opts.title)}</title>
<meta property="og:title" content="${escapeHtml(opts.title)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${escapeHtml(opts.canonical)}">
<meta name="twitter:card" content="summary">
<link rel="canonical" href="${escapeHtml(opts.canonical)}">
<meta name="robots" content="noindex">
<style>
  body { font-family: -apple-system, system-ui, "Segoe UI", sans-serif; max-width: 640px; margin: 40px auto; padding: 0 20px; line-height: 1.55; color: #1B3155; }
  h1 { font-size: 22px; margin-bottom: 4px; }
  .card { border: 1px solid #d8dee8; border-radius: 10px; padding: 20px; margin: 20px 0; background: #fafbfc; }
  .row { margin: 0 0 10px; }
  .row strong { color: #1B3155; }
  .status { display: inline-flex; align-items: center; gap: 6px; font-weight: 600; }
  .status.active { color: #1a7f37; }
  .status.expiring, .status.expired, .status.none { color: #b45309; }
  .disclaimer { font-size: 12.5px; color: #6b7280; margin-top: 20px; }
  footer { margin-top: 32px; font-size: 12px; color: #666; }
  a { color: #2e5bdb; }
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
  const canonical = `${url.origin}/trust/${encodeURIComponent(id)}`;

  const upstream = await fetch(`${workerBase}/api/trust/public/${encodeURIComponent(id)}`, {
    headers: { "X-Chasa-App-Origin": url.origin },
  }).catch(() => null);

  if (!upstream || upstream.status === 404) {
    return new Response(
      renderPage({
        title: "Trust profile not found — docstoc",
        canonical,
        body: `<h1>Trust profile not found</h1><p>This account doesn't have a verified domain yet, or the link is incomplete.</p><p><a href="https://chasa.io/">docstoc</a></p>`,
      }),
      { status: 404, headers: { "Content-Type": "text/html; charset=UTF-8" } }
    );
  }

  if (!upstream.ok) {
    return new Response(
      renderPage({
        title: "Trust profile unavailable — docstoc",
        canonical,
        body: `<h1>Trust profile temporarily unavailable</h1><p>Try again in a moment.</p>`,
      }),
      { status: 502, headers: { "Content-Type": "text/html; charset=UTF-8" } }
    );
  }

  const profile = (await upstream.json()) as PublicTrustProfile;
  const title = `${profile.workspaceName} — Trust Profile — docstoc`;
  const statusLabel =
    profile.domainStatus === "active"
      ? "✓ SSL active"
      : profile.domainStatus === "expiring"
      ? "⚠ SSL renewal due"
      : profile.domainStatus === "expired"
      ? "⚠ SSL expired"
      : "No verified domain";

  const otsBlock =
    profile.otsStatus === "confirmed"
      ? `<p class="row"><strong>Verified since:</strong> ${escapeHtml(formatUsDate(profile.verifiedSince))} — <span style="color:#b45309">₿ Bitcoin-timestamped</span>. <a href="${workerBase}/api/trust/proof/${encodeURIComponent(id)}.ots">Download the proof (.ots)</a> to check it yourself.</p>`
      : `<p class="row"><strong>Verified since:</strong> ${escapeHtml(formatUsDate(profile.verifiedSince))} (Bitcoin timestamp pending confirmation)</p>`;

  const body = `
<h1>${escapeHtml(profile.workspaceName)}</h1>
<div class="card">
  ${profile.domain ? `<p class="row"><strong>Domain:</strong> ${escapeHtml(profile.domain)}</p>` : ""}
  <p class="row"><strong>Status:</strong> <span class="status ${profile.domainStatus}">${statusLabel}</span></p>
  ${otsBlock}
</div>
<p class="disclaimer">This confirms docstoc verified DNS control of the domain above via a real Let's Encrypt SSL certificate, and (once Bitcoin-confirmed) that this account has held verified status since the date shown. It is not a business registration, legal entity, or identity check — docstoc doesn't perform those.</p>
<footer>
  Issued via <a href="https://chasa.io/">docstoc</a>.
</footer>`;

  return new Response(renderPage({ title, canonical, body }), {
    status: 200,
    headers: { "Content-Type": "text/html; charset=UTF-8" },
  });
};
