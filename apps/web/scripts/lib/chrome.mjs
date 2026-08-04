/** Shared HTML chrome for generated marketing pages. */

import { ORG_JSON_LD, SOCIAL } from "../data/seo-config.mjs";
import { renderSeoHead } from "./seo-head.mjs";

/** Bump when site.css / site-nav.js / site-lang.js change so Pages edge caches refresh. */
export const ASSET_V = "20260804d";

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
<link rel="stylesheet" href="${link(`/site.css?v=${ASSET_V}`)}">
</head>
<body>
<header class="site-header">
  <div class="wrap site-header-inner">
    <a href="${link("/")}" class="logo" aria-label="Chasa home"><img class="logo-mark" src="${link("/brand/chasa-icon.png")}" alt="" width="28" height="28" /><span class="logo-word">chasa</span></a>
    <div class="header-nav-right">
      <a href="${link("/#pricing")}" class="header-nav-link header-nav-collapse" data-i18n="nav.pricing">Pricing</a>
      <a href="${link("/blog/invoice-chase-software-comparison/")}" class="header-nav-link header-nav-collapse" data-i18n="nav.compare">Compare</a>
      <a href="${link("/free-templates/")}" class="header-nav-link header-nav-collapse${activeNav === "templates" ? " header-nav-strong" : ""}" data-i18n="nav.templates">Free templates</a>
      <a href="${link("/tools/")}" class="header-nav-link header-nav-collapse${activeNav === "tools" ? " header-nav-strong" : ""}" data-i18n="nav.tools">Tools</a>
      <a href="${link("/ai")}" class="header-nav-link header-nav-collapse${activeNav === "ai" ? " header-nav-strong" : ""}" data-i18n="nav.ai">AI</a>
      <div class="locale-switch" data-locale-switch role="group" data-i18n-aria="nav.language"></div>
      <a href="mailto:sales@chasa.io?subject=Chasa%20sales" class="header-nav-sales header-nav-collapse" data-i18n="nav.contactSales">Contact sales</a>
      <a href="${link("/app/")}" class="nav-cta" data-i18n="nav.tryFree">Try free</a>
      <a href="${link("/app/login")}" class="header-login-btn header-nav-collapse" data-i18n="nav.signIn">Sign in</a>
      <button class="header-menu-toggle" type="button" aria-label="Open menu" aria-expanded="false" data-menu-toggle data-i18n-aria="nav.openMenu">
        <span></span><span></span><span></span>
      </button>
    </div>
  </div>
</header>
<div class="mobile-panel-backdrop" data-mobile-backdrop></div>
<div class="mobile-panel" data-mobile-panel>
  <button class="mobile-panel-close" type="button" aria-label="Close menu" data-mobile-close data-i18n-aria="nav.closeMenu">✕</button>
  <nav class="mobile-panel-nav">
      <a href="${link("/#pricing")}" class="mobile-panel-nav-link" data-i18n="nav.pricing">Pricing</a>
      <a href="${link("/blog/invoice-chase-software-comparison/")}" class="mobile-panel-nav-link" data-i18n="nav.compare">Compare</a>
      <a href="${link("/free-templates/")}" class="mobile-panel-nav-link" data-i18n="nav.templates">Free templates</a>
      <a href="${link("/tools/")}" class="mobile-panel-nav-link" data-i18n="nav.tools">Tools</a>
      <a href="${link("/ai")}" class="mobile-panel-nav-link" data-i18n="nav.ai">AI</a>
      <a href="${link("/app/login")}" class="mobile-panel-nav-link" data-i18n="nav.signIn">Sign in</a>
      <a href="${link("/app/")}" class="mobile-panel-nav-link" data-i18n="nav.tryFree">Try free</a>
  </nav>
  <div class="mobile-panel-ctas">
    <a href="${link("/app/")}" class="mobile-panel-cta-primary" data-i18n="nav.tryFree">Try free</a>
    <a href="${link("/app/login")}" class="mobile-panel-cta-secondary" data-i18n="nav.signIn">Sign in</a>
    <a href="mailto:sales@chasa.io?subject=Chasa%20sales" class="mobile-panel-cta-secondary" data-i18n="nav.contactSales">Contact sales</a>
  </div>
</div>
<main class="wrap page-main">
${mainHtml}
</main>
<footer class="site-footer">
  <div class="wrap site-footer-inner">
    <div class="site-footer-brand">
      <a href="${link("/")}" class="logo" aria-label="Chasa home"><img class="logo-mark" src="${link("/brand/chasa-icon.png")}" alt="" width="24" height="24" /><span class="logo-word">chasa</span></a>
      <p data-i18n="footer.tagline">Free AI invoice follow-ups — paste unpaid invoices, get the reminder email already written.</p>
    </div>
    <div class="site-footer-col">
      <h4 data-i18n="footer.product">Product</h4>
      <a href="${link("/app/")}" data-i18n="footer.tryFree">Try free</a>
      <a href="${link("/#pricing")}" data-i18n="footer.pricing">Pricing</a>
      <a href="${link("/free-templates/")}" data-i18n="footer.templates">Free templates</a>
      <a href="${link("/tools/")}" data-i18n="footer.calculators">Calculators</a>
      <a href="${link("/features/")}" data-i18n="footer.features">Features</a>
      <a href="${link("/docs/")}" data-i18n="footer.docs">Docs</a>
      <a href="${link("/ai")}" data-i18n="footer.ai">AI</a>
      <a href="${link("/#faq")}" data-i18n="footer.faq">FAQ</a>
    </div>
    <div class="site-footer-col">
      <h4 data-i18n="footer.compareCol">Compare</h4>
      <a href="${link("/chasa-vs-chaser")}" data-i18n="footer.vsChaser">vs Chaser</a>
      <a href="${link("/chasa-vs-paidnice")}" data-i18n="footer.vsPaidnice">vs Paidnice</a>
      <a href="${link("/chasa-vs-duefy")}" data-i18n="footer.vsDuefy">vs Duefy</a>
      <a href="${link("/chasa-vs-satago")}" data-i18n="footer.vsSatago">vs Satago</a>
      <a href="${link("/chasa-vs-chaseai")}" data-i18n="footer.vsChaseai">vs ChaseAI</a>
      <a href="${link("/switch-to-chasa")}" data-i18n="footer.switch">Switch to Chasa</a>
      <a href="${link("/blog/invoice-chase-software-comparison/")}" data-i18n="footer.compare">See full comparison</a>
    </div>
    <div class="site-footer-col">
      <h4 data-i18n="footer.company">Company</h4>
      <a href="${link("/about")}" data-i18n="footer.about">About</a>
      <a href="${link("/press")}" data-i18n="footer.press">Press</a>
      <a href="${link("/imprint")}" data-i18n="footer.imprint">Imprint</a>
      <a href="mailto:founder@chasa.io" data-i18n="footer.contact">Contact</a>
      <a href="${SOCIAL.linkedin}" target="_blank" rel="noopener noreferrer" data-i18n="footer.linkedin">LinkedIn</a>
      <a href="${SOCIAL.x}" target="_blank" rel="noopener noreferrer" data-i18n="footer.x">X</a>
    </div>
    <div class="site-footer-col">
      <h4 data-i18n="footer.legal">Legal</h4>
      <a href="${link("/privacy")}" data-i18n="footer.privacy">Privacy</a>
      <a href="${link("/terms")}" data-i18n="footer.terms">Terms</a>
      <a href="${link("/sitemap.xml")}" data-i18n="footer.sitemap">Sitemap</a>
      <a href="${link("/blog/feed.xml")}" data-i18n="footer.rss">RSS</a>
    </div>
  </div>
  <div class="site-footer-bottom" data-i18n-year="footer.copyright">© ${new Date().getFullYear()} Chasa — a product of RELACON GmbH</div>
</footer>
<script src="${link(`/site-lang.js?v=${ASSET_V}`)}" defer></script>
<script src="${link(`/site-nav.js?v=${ASSET_V}`)}" defer></script>
<script src="${link("/cookie-consent.js")}" defer></script>
<script src="${link("/analytics.js")}" defer></script>
</body>
</html>`;
}
