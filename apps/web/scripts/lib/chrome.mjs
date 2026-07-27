/** Shared HTML chrome for generated marketing pages. */

import { ORG_JSON_LD, SOCIAL } from "../data/seo-config.mjs";
import { renderSeoHead } from "./seo-head.mjs";

export function escapeHtml(s) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** Honest trust strip — no fake certifications or partner badges. */
export function trustStripHtml(link = (p) => p) {
  const icon = (paths) =>
    `<svg class="trust-strip-icon" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="none">${paths}</svg>`;
  const stroke = 'stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"';
  const draft = icon(`<path d="M4 2.5h6.5L13 5v8.5H4V2.5z" ${stroke}/><path d="M10.5 2.5V5H13" ${stroke}/><path d="M6 8h4M6 10.5h3" ${stroke}/>`);
  const send = icon(`<path d="M2.5 8h8.5M8.5 5.5 11.5 8 8.5 10.5" ${stroke}/><path d="M13.5 3.5v9" ${stroke}/>`);
  const eu = icon(`<circle cx="8" cy="8" r="5.25" ${stroke}/><path d="M8 2.75v10.5M2.75 8h10.5M4.2 4.2c1.2 1.1 2.5 1.65 3.8 1.65s2.6-.55 3.8-1.65M4.2 11.8c1.2-1.1 2.5-1.65 3.8-1.65s2.6.55 3.8 1.65" ${stroke}/>`);
  const cloud = icon(`<path d="M5.2 11.5h6.1a2.6 2.6 0 0 0 .35-5.18A3.4 3.4 0 0 0 5.3 5.6a2.35 2.35 0 0 0-.1 4.7z" ${stroke}/>`);
  const card = icon(`<rect x="2.25" y="4" width="11.5" height="8" rx="1.2" ${stroke}/><path d="M2.25 6.75h11.5M5 9.5h2.5" ${stroke}/>`);
  const plug = icon(`<path d="M5.5 2.5v3M10.5 2.5v3M4 5.5h8v2.2c0 2.4-1.8 4.3-4 4.3s-4-1.9-4-4.3V5.5zM8 12v1.5" ${stroke}/>`);

  return `<aside class="trust-strip" aria-label="Trust and transparency">
  <div class="wrap">
    <ul class="trust-strip-list">
      <li>${draft}<span>Draft-only — we never email your clients</span></li>
      <li>${send}<span>You send from your inbox</span></li>
      <li>${eu}<span>EU company — <a href="${link("/imprint")}">RELACON GmbH</a>, Vienna</span></li>
      <li>${cloud}<span>Built on <a href="https://www.cloudflare.com/" rel="noopener noreferrer" target="_blank">Cloudflare</a></span></li>
      <li>${card}<span>Billing by <a href="https://stripe.com/" rel="noopener noreferrer" target="_blank">Stripe</a></span></li>
      <li>${plug}<span>Works with QuickBooks Online &amp; Xero</span></li>
    </ul>
    <p class="trust-strip-privacy">Analytics only with your consent · no ad trackers</p>
  </div>
</aside>`;
}

export function chrome({ title, description, canonical, activeNav = "", mainHtml, jsonLd, depth = 0, extraHead = "" }) {
  const prefix = depth > 0 ? "../".repeat(depth) : "";
  const root = depth > 0 ? "../".repeat(depth).slice(0, -1) || "." : "";
  const base = depth === 0 ? "" : "../".repeat(depth).replace(/\/$/, "") || ".";

  const pathPrefix = depth > 0 ? "../".repeat(depth) : "/";
  const link = (p) => (depth > 0 ? `${pathPrefix}${p.replace(/^\//, "")}` : p);
  const canonicalUrl = canonical.startsWith("http") ? canonical : `https://chasa.io${canonical}`;
  const defaultJsonLd = JSON.stringify(ORG_JSON_LD, null, 2);
  const seoHead = renderSeoHead({ link });

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<link rel="canonical" href="${canonicalUrl}">
<meta property="og:type" content="website">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${canonicalUrl}">
<meta property="og:image" content="https://chasa.io/brand/og/chasa-og-1200x630.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(description)}">
<meta name="twitter:image" content="https://chasa.io/brand/og/chasa-og-1200x630.png">
${seoHead}
${extraHead}
${jsonLd ? `<script type="application/ld+json">\n${jsonLd}\n</script>` : `<script type="application/ld+json">\n${defaultJsonLd}\n</script>`}
<link rel="icon" href="${link("/favicon.png")}" type="image/png">
<link rel="icon" href="${link("/favicon.svg")}" type="image/svg+xml">
<link rel="apple-touch-icon" href="${link("/apple-touch-icon.png")}">
<link rel="stylesheet" href="${link("/site.css")}">
</head>
<body>
<header class="site-header">
  <div class="wrap site-header-inner">
    <a href="${link("/")}" class="logo" aria-label="Chasa home"><img class="logo-mark" src="${link("/brand/chasa-icon.png")}" alt="" width="28" height="28" /><span class="logo-word">chasa</span></a>
    <div class="header-nav-right">
      <a href="${link("/#pricing")}" class="header-nav-link header-nav-collapse">Pricing</a>
      <a href="${link("/free-templates/")}" class="header-nav-link header-nav-collapse${activeNav === "templates" ? " header-nav-strong" : ""}">Free templates</a>
      <a href="${link("/ai")}" class="header-nav-link header-nav-collapse${activeNav === "ai" ? " header-nav-strong" : ""}">AI</a>
      <a href="${link("/about")}" class="header-nav-link header-nav-collapse">About</a>
      <a href="${link("/app/login")}" class="header-nav-link header-nav-strong">Sign in</a>
      <a href="${link("/app/")}" class="nav-cta">Try free</a>
      <button class="header-menu-toggle" type="button" aria-label="Open menu" aria-expanded="false" data-menu-toggle>
        <span></span><span></span><span></span>
      </button>
    </div>
    <div class="header-mobile-menu" data-mobile-menu>
      <a href="${link("/#pricing")}">Pricing</a>
      <a href="${link("/free-templates/")}">Free templates</a>
      <a href="${link("/ai")}">AI</a>
      <a href="${link("/about")}">About</a>
      <a href="${link("/app/login")}">Sign in</a>
      <a href="${link("/app/")}" class="nav-cta">Try free</a>
    </div>
  </div>
</header>
<main class="wrap page-main">
${mainHtml}
</main>
${trustStripHtml(link)}
<footer class="site-footer">
  <div class="wrap site-footer-inner">
    <div class="site-footer-brand">
      <a href="${link("/")}" class="logo" aria-label="Chasa home"><img class="logo-mark" src="${link("/brand/chasa-icon.png")}" alt="" width="24" height="24" /><span class="logo-word">chasa</span></a>
      <p>Free AI invoice follow-ups — paste unpaid invoices, get the reminder email already written.</p>
    </div>
    <div class="site-footer-col">
      <h4>Product</h4>
      <a href="${link("/app/")}">Try free</a>
      <a href="${link("/#pricing")}">Pricing</a>
      <a href="${link("/free-templates/")}">Free templates</a>
      <a href="${link("/docs/")}">Docs</a>
      <a href="${link("/blog/")}">Blog</a>
    </div>
    <div class="site-footer-col">
      <h4>Company</h4>
      <a href="${link("/about")}">About</a>
      <a href="${link("/press")}">Press</a>
      <a href="${link("/privacy")}">Privacy</a>
      <a href="${link("/terms")}">Terms</a>
      <a href="${link("/imprint")}">Imprint</a>
    </div>
    <div class="site-footer-col">
      <h4>Connect</h4>
      <a href="${SOCIAL.linkedin}" target="_blank" rel="noopener noreferrer">LinkedIn</a>
      <a href="${SOCIAL.x}" target="_blank" rel="noopener noreferrer">X</a>
      <a href="${link("/sitemap.xml")}">Sitemap</a>
      <a href="${link("/blog/feed.xml")}">RSS</a>
    </div>
  </div>
  <div class="wrap footer-bottom">
    <p>© ${new Date().getFullYear()} RELACON GmbH</p>
  </div>
</footer>
<script src="${link("/site-nav.js")}" defer></script>
<script src="${link("/cookie-consent.js")}" defer></script>
<script src="${link("/analytics.js")}" defer></script>
</body>
</html>`;
}
