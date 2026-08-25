#!/usr/bin/env node
/**
 * Generates /ssl and /tls conversion landings with competitor grids.
 * Run: node apps/web/scripts/generate-ssl-landings.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chrome, escapeHtml } from "./lib/chrome.mjs";
import { SSL_COMPETITORS } from "./data/ssl-competitors.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "../public");

function competitorGrid() {
  const cards = SSL_COMPETITORS.map(
    (c) => `      <article class="ssl-comp-card">
        <h3>${escapeHtml(c.name)}</h3>
        <p>${escapeHtml(c.bestFit)}</p>
        <p class="ssl-comp-links">
          <a href="/docstoc-vs-${escapeHtml(c.slug)}">Compare</a>
          · <a href="/switch-from-${escapeHtml(c.slug)}">Switch from ${escapeHtml(c.name)}</a>
        </p>
      </article>`
  ).join("\n");
  return `<div class="ssl-comp-grid">\n${cards}\n    </div>`;
}

const EXTRA_HEAD = `<style>
.ssl-hero-actions { display:flex; flex-wrap:wrap; gap:12px; margin:20px 0 8px; }
.ssl-steps { display:grid; gap:16px; margin:20px 0 28px; }
@media (min-width:720px){ .ssl-steps { grid-template-columns: repeat(3, 1fr); } }
.ssl-step { border:1px solid #e5e7eb; border-radius:12px; padding:18px 16px; background:#fff; }
.ssl-step strong { display:block; margin-bottom:8px; font-size:15px; }
.ssl-step p { margin:0; font-size:14.5px; line-height:1.55; color:#4b5563; }
.ssl-comp-grid { display:grid; gap:14px; margin:18px 0 28px; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); }
.ssl-comp-card { border:1px solid #e5e7eb; border-radius:12px; padding:16px; background:#fff; }
.ssl-comp-card h3 { margin:0 0 8px; font-size:16px; }
.ssl-comp-card p { margin:0 0 10px; font-size:13.5px; line-height:1.5; color:#4b5563; }
.ssl-comp-links { margin:0 !important; font-size:13.5px !important; font-weight:600; }
.ssl-limits { background:#f9fafb; border:1px solid #e5e7eb; border-radius:12px; padding:18px 20px; margin:18px 0 28px; }
.ssl-limits ul { margin:8px 0 0; padding-left:18px; }
</style>`;

function sharedSections(kind) {
  const peer = kind === "ssl" ? ["TLS", "/tls"] : ["SSL", "/ssl"];
  return `
  <h2>How it works</h2>
  <div class="ssl-steps">
    <div class="ssl-step"><strong>1. Add your domain</strong><p>Sign in and add the hostname you want secured in SSL certificates.</p></div>
    <div class="ssl-step"><strong>2. Publish one DNS TXT record</strong><p>Copy the challenge record to your DNS provider. No CDN proxy or nameserver move required.</p></div>
    <div class="ssl-step"><strong>3. Auto-renew forever</strong><p>docstoc issues a real Let's Encrypt certificate and reissues before expiry while your plan stays active.</p></div>
  </div>

  <h2>Who it's for</h2>
  <ul>
    <li>Freelancers and small businesses who need HTTPS without running certbot</li>
    <li>Agencies putting client sites or portals on custom domains</li>
    <li>Teams that already use docstoc for invoices, templates, or certificates and want SSL in the same account</li>
  </ul>

  <div class="ssl-limits">
    <strong>Honest limits</strong>
    <ul>
      <li><strong>DV only</strong> — domain-validated Let's Encrypt certificates (browser padlock). Not OV/EV.</li>
      <li><strong>Not a commercial CA replacement</strong> for warranties, wildcards-as-a-product, or enterprise PKI.</li>
      <li><strong>Not your host/CDN</strong> — keep your hosting; docstoc automates the certificate lifecycle.</li>
    </ul>
  </div>

  <h2>Compare docstoc to SSL/TLS providers</h2>
  <p>Side-by-side pages and migration guides for the tools people actually search against — including Let's Encrypt DIY, commercial CAs, free-SSL sites, Cloudflare, and hosts.</p>
  ${competitorGrid()}

  <h2>Features</h2>
  <ul>
    <li><a href="/ssl/features">SSL features hub</a></li>
    <li><a href="/ssl/features/certificates">Certificates</a> · <a href="/ssl/features/validation">Validation</a> · <a href="/ssl/features/installation">Installation</a></li>
    <li><a href="/ssl/features/monitoring">Monitoring</a> · <a href="/ssl/features/protection">Trust &amp; protection</a> · <a href="/ssl/features/acme">ACME</a></li>
    <li><a href="/ssl/features/enterprise">Business SSL</a> · <a href="/ssl/developer">Developer API</a></li>
  </ul>

  <h2>Related</h2>
  <ul>
    <li><a href="${peer[1]}">${peer[0]} certificates on docstoc</a> — same product, ${peer[0].toLowerCase()}-oriented search intent</li>
    <li><a href="/use-cases/free-ssl-for-your-domain">Free SSL for a client's domain</a></li>
    <li><a href="/tools/ssl-certificate-calculator">SSL expiry calculator</a></li>
    <li><a href="/trust-badges">Trust badges</a></li>
    <li><a href="/monitoringssl">SSL monitoring</a> · <a href="/monitoringtls">TLS monitoring</a></li>
  </ul>`;
}

function sslFaq() {
  return [
    {
      q: "Is this a free SSL certificate?",
      a: "docstoc issues real Let's Encrypt DV certificates with no separate per-certificate fee. Automation is included on the paid plan — not a surprise SSL upsell at renewal.",
    },
    {
      q: "SSL or TLS — which do I need?",
      a: "Modern browsers use TLS. People still search “SSL certificate” for the same HTTPS padlock. docstoc covers both intents with the same automated Let's Encrypt flow. See also /tls.",
    },
    {
      q: "Do I need to move my site to docstoc hosting?",
      a: "No. Keep your host. Add one DNS TXT record for validation; renewals are handled in-product.",
    },
    {
      q: "Can I get OV or EV certificates?",
      a: "Not from docstoc. We automate DV Let's Encrypt certificates. If procurement requires OV/EV, use a commercial CA — we say so on every comparison page.",
    },
  ];
}

function tlsFaq() {
  return [
    {
      q: "What is a TLS certificate?",
      a: "A TLS certificate lets browsers establish an encrypted HTTPS connection. “SSL certificate” is the older everyday name for the same idea. docstoc automates Let's Encrypt DV certificates for TLS.",
    },
    {
      q: "Is TLS better than SSL?",
      a: "TLS is the modern protocol family; legacy SSL versions are retired. When vendors say SSL, they almost always mean TLS under the hood. docstoc issues certificates used for TLS/HTTPS.",
    },
    {
      q: "How is docstoc different from running certbot?",
      a: "Same CA (Let's Encrypt). Different ops: certbot is DIY on your server; docstoc is one DNS TXT record and in-product renewals beside invoices and documents.",
    },
    {
      q: "Where do I compare alternatives?",
      a: "Use the provider grid on this page for docstoc vs and switch-from guides — ZeroSSL, Cloudflare, DigiCert, Hostinger, and more.",
    },
  ];
}

function faqHtml(faqs) {
  return faqs
    .map(
      (item) =>
        `<details class="faq-item"><summary>${escapeHtml(item.q)}</summary>\n<p>${escapeHtml(item.a)}</p>\n</details>`
    )
    .join("\n");
}

function buildJsonLd(path, name, faqs) {
  return JSON.stringify(
    {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: "https://chasa.io/" },
            { "@type": "ListItem", position: 2, name, item: `https://chasa.io${path}` },
          ],
        },
        {
          "@type": "WebApplication",
          name: `docstoc ${name}`,
          url: `https://chasa.io${path}`,
          applicationCategory: "SecurityApplication",
          operatingSystem: "Any",
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
          provider: { "@type": "Organization", name: "docstoc", url: "https://chasa.io/" },
        },
        {
          "@type": "FAQPage",
          mainEntity: faqs.map((item) => ({
            "@type": "Question",
            name: item.q,
            acceptedAnswer: { "@type": "Answer", text: item.a },
          })),
        },
      ],
    },
    null,
    2
  );
}

const sslFaqs = sslFaq();
const tlsFaqs = tlsFaq();

const sslMain = `<p class="crumb"><a href="/">Home</a> / SSL</p>
<h1>Free automated SSL certificates for your domain</h1>
  <p class="lede">Add a domain, publish one DNS TXT record, get a real Let's Encrypt SSL certificate — automated renewals, no certbot, no separate certificate dashboard. Built for small businesses who need HTTPS without ACME ops.</p>
  <div class="ssl-hero-actions">
    <a href="/app/login?start=1" class="nav-cta">Secure a domain free →</a>
    <a href="/tools/ssl-certificate-calculator">Check cert expiry</a>
    <a href="/tls">Looking for TLS instead?</a>
  </div>
  ${sharedSections("ssl")}
  <h2>FAQ</h2>
  ${faqHtml(sslFaqs)}
  <p style="margin-top:28px"><a href="/app/login?start=1" class="nav-cta">Try docstoc free</a></p>`;

const tlsMain = `<p class="crumb"><a href="/">Home</a> / TLS</p>
<h1>TLS certificates without running your own ACME stack</h1>
  <p class="lede">Modern HTTPS is TLS. docstoc automates real Let's Encrypt DV certificates for your domain — one DNS TXT record, hands-off renewals, inside the same platform as invoices and documents. No certbot babysitting.</p>
  <div class="ssl-hero-actions">
    <a href="/app/login?start=1" class="nav-cta">Issue TLS for your domain →</a>
    <a href="/ssl">Prefer the SSL wording?</a>
    <a href="/use-cases/free-ssl-for-your-domain">Client-domain use case</a>
  </div>
  ${sharedSections("tls")}
  <h2>FAQ</h2>
  ${faqHtml(tlsFaqs)}
  <p style="margin-top:28px"><a href="/app/login?start=1" class="nav-cta">Try docstoc free</a></p>`;

mkdirSync(publicDir, { recursive: true });

writeFileSync(
  join(publicDir, "ssl.html"),
  chrome({
    title: "Free Automated SSL Certificates — Let's Encrypt, No Certbot | docstoc",
    description:
      "Free automated SSL for your domain: real Let's Encrypt certificates, one DNS TXT record, auto-renewal. Compare and switch from ZeroSSL, Cloudflare, DigiCert, Hostinger, and more.",
    canonical: "/ssl",
    activeNav: "",
    mainHtml: sslMain,
    jsonLd: buildJsonLd("/ssl", "SSL", sslFaqs),
    extraHead: EXTRA_HEAD,
    depth: 0,
  }),
  "utf8"
);

writeFileSync(
  join(publicDir, "tls.html"),
  chrome({
    title: "TLS Certificates Automated — Let's Encrypt Without ACME Ops | docstoc",
    description:
      "Automate TLS certificates for your domain with Let's Encrypt DV — one DNS record, renewals handled. Compare docstoc to commercial CAs, free SSL tools, Cloudflare, and Hostinger.",
    canonical: "/tls",
    activeNav: "",
    mainHtml: tlsMain,
    jsonLd: buildJsonLd("/tls", "TLS", tlsFaqs),
    extraHead: EXTRA_HEAD,
    depth: 0,
  }),
  "utf8"
);

console.log("Generated ssl.html and tls.html");
