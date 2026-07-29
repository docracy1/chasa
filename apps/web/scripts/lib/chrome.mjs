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
      <a href="${link("/tools/")}" class="header-nav-link header-nav-collapse${activeNav === "tools" ? " header-nav-strong" : ""}">Tools</a>
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
      <a href="${link("/tools/")}">Tools</a>
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
      <a href="${link("/tools/")}">Calculators</a>
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
