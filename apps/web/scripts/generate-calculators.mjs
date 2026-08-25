#!/usr/bin/env node
/**
 * Generates SEO tool pages under /tools/ — templates, certificates, SSL, trust badges,
 * invoice chasing — so invoice chasing isn't the lead/only tool.
 * Run: node apps/web/scripts/generate-calculators.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chrome } from "./lib/chrome.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "../public/tools");
mkdirSync(outDir, { recursive: true });

const extraHead = `<style>
/* Classic docstoc-style sans hierarchy on tools (not Fraunces). */
main h1, main h2, main h3, .tools-card h2, .calc-stat strong, .finder-card strong {
  font-family: Inter, "Helvetica Neue", Helvetica, Arial, sans-serif;
}
.calc-grid { display: grid; gap: 28px; margin: 28px 0 36px; }
@media (min-width: 860px) {
  .calc-grid { grid-template-columns: 1.1fr 0.9fr; align-items: start; }
}
.calc-panel, .calc-results {
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 20px 22px;
  background: var(--white);
}
.calc-results { background: color-mix(in srgb, var(--accent) 6%, var(--white)); }
.calc-field { margin-bottom: 14px; }
.calc-field label {
  display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px; color: var(--ink);
}
.calc-field input, .calc-field select {
  width: 100%; box-sizing: border-box; padding: 10px 12px;
  border: 1px solid var(--line); border-radius: 8px; font: inherit; background: var(--paper);
}
.calc-field input[type="range"] { padding: 0; background: transparent; border: none; }
.calc-hint { font-size: 12.5px; color: var(--ink-soft); margin-top: 4px; }
.calc-stat { margin: 0 0 14px; }
.calc-stat strong { display: block; font-size: 28px; margin-top: 2px; font-weight: 700; }
.calc-stat span { font-size: 13px; color: var(--ink-soft); font-weight: 600; }
.calc-note { font-size: 12.5px; color: var(--ink-soft); margin-top: 12px; line-height: 1.45; }
.calc-divider { border: none; border-top: 1px solid var(--line); margin: 40px 0; }
.tools-card-grid { display: grid; gap: 14px; margin: 22px 0 8px; }
@media (min-width: 700px) { .tools-card-grid { grid-template-columns: 1fr 1fr; } }
@media (min-width: 1040px) { .tools-card-grid { grid-template-columns: 1fr 1fr 1fr; } }
.tools-card {
  display: block; text-decoration: none; color: inherit;
  border: 1px solid var(--line); border-radius: 12px; padding: 18px 20px;
  background: var(--white); transition: border-color 0.15s ease, transform 0.12s ease;
}
.tools-card:hover { border-color: var(--accent); transform: translateY(-1px); }
.tools-card h2 { font-size: 20px; margin: 0 0 8px; font-weight: 700; }
.tools-card p { margin: 0; color: var(--ink-soft); font-size: 14.5px; line-height: 1.45; }
.trust-badge-demo {
  display: inline-flex; align-items: center; gap: 6px;
  font: 12px/1.2 -apple-system, system-ui, sans-serif; color: #1B3155;
  text-decoration: none; border: 1px solid #d8dee8; border-radius: 6px;
  padding: 6px 10px; background: #fafbfc;
}
.trust-badge-demo svg { flex-shrink: 0; }
.trust-embed-box {
  margin-top: 12px; padding: 10px 12px; background: var(--paper);
  border: 1px solid var(--line); border-radius: 6px; font-size: 12.5px;
  word-break: break-all; font-family: "IBM Plex Mono", ui-monospace, monospace;
}
.trust-lookup-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 4px; }
.trust-lookup-actions button {
  font-size: 13px; font-weight: 600; padding: 10px 14px;
  border: 1px solid var(--line); border-radius: 8px; background: var(--white); cursor: pointer;
}
.trust-lookup-actions button[data-trust-lookup] {
  background: var(--accent); color: #fff; border-color: var(--accent);
}
.trust-lookup-actions button:hover { filter: brightness(0.97); }
.finder-grid { display: grid; gap: 12px; margin: 22px 0 8px; }
@media (min-width: 700px) { .finder-grid { grid-template-columns: 1fr 1fr; } }
.finder-card {
  display: block; text-decoration: none; color: inherit;
  border: 1px solid var(--line); border-radius: 10px; padding: 14px 16px;
  background: var(--white); transition: border-color 0.15s ease;
}
.finder-card:hover { border-color: var(--accent); }
.finder-card strong { display: block; font-size: 15px; margin-bottom: 3px; }
.finder-card span { font-size: 13px; color: var(--ink-soft); }
.hash-drop {
  border: 2px dashed var(--line); border-radius: 12px; padding: 32px 20px; text-align: center;
  cursor: pointer; background: var(--white); transition: border-color 0.15s ease;
}
.hash-drop.is-drag { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 6%, var(--white)); }
.hash-drop p { margin: 6px 0 0; color: var(--ink-soft); font-size: 13.5px; }
.hash-out { margin-top: 20px; }
.hash-out-row { display: flex; gap: 8px; align-items: center; margin-bottom: 10px; }
.hash-out-row code {
  flex: 1; font-size: 12.5px; word-break: break-all; padding: 8px 10px;
  background: var(--paper); border: 1px solid var(--line); border-radius: 6px;
}
.hash-copy-btn {
  flex-shrink: 0; font-size: 12.5px; font-weight: 600; padding: 8px 12px;
  border: 1px solid var(--line); border-radius: 6px; background: var(--white); cursor: pointer;
}
.hash-copy-btn:hover { border-color: var(--accent); color: var(--accent); }
</style>
<script src="/tools-calc.js" defer></script>`;

function faqJsonLd(faqs) {
  return JSON.stringify(
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
    null,
    2
  );
}

function breadcrumbJsonLd(items) {
  return JSON.stringify(
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: items.map((it, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: it.name,
        item: it.item,
      })),
    },
    null,
    2
  );
}

function webAppJsonLd({ name, description, url }) {
  return JSON.stringify(
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name,
      description,
      url,
      applicationCategory: "UtilitiesApplication",
      operatingSystem: "Any",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      provider: { "@type": "Organization", name: "docstoc", url: "https://chasa.io/" },
    },
    null,
    2
  );
}

function multiJsonLd(...blocks) {
  return `[${blocks.join(",\n")}]`;
}

const chaseFaqs = [
  {
    q: "How do you calculate late payment interest on an unpaid invoice?",
    a: "Multiply the invoice amount by the annual interest rate, then by days overdue divided by 365. Example: $1,000 × 8% × (30 ÷ 365) ≈ $6.58 interest.",
  },
  {
    q: "What interest rate should I use for late invoices?",
    a: "Use the rate in your contract or invoice terms. Many freelancers use 1–1.5% per month (about 12–18% annually). Some countries set a statutory rate for commercial late payments — check local rules.",
  },
  {
    q: "How does this savings estimate work?",
    a: "It divides your unpaid AR balance by current average days outstanding to estimate daily cash tied up, then multiplies by the days you expect to shorten with consistent follow-ups.",
  },
  {
    q: "Does docstoc email clients for me?",
    a: "No. docstoc drafts follow-up emails; you review and send from your own inbox. That keeps your client relationship in your control.",
  },
];

const finderFaqs = [
  {
    q: "Do I need an account to use these templates?",
    a: "No. Every template is free to view and copy without signing up — an account only matters if you want to submit your own template or use docstoc's other tools.",
  },
  {
    q: "What if my situation isn't listed?",
    a: "The eight situations above are the most common starting points, not the full list. Browse all 488+ templates for anything more specific — business, legal, real estate, finance, and HR documents are all covered.",
  },
  {
    q: "Can I edit the template after copying it?",
    a: "Yes. Templates are plain text you copy into your own document — there's no lock-in format or proprietary editor involved.",
  },
];

const hashFaqs = [
  {
    q: "Is my file uploaded anywhere?",
    a: "No. The hash is computed entirely in your browser using the Web Crypto API — the file's bytes never leave your device or get sent to any server.",
  },
  {
    q: "What is SHA-256 used for?",
    a: "SHA-256 produces a fixed-length fingerprint of a file. If even one byte changes, the hash changes completely — making it a reliable way to prove a file hasn't been altered.",
  },
  {
    q: "How is this different from a docstoc certificate?",
    a: "This tool just shows you the hash. A docstoc certificate stores that hash with a timestamp and gives you a shareable link anyone can use to verify the file later — this calculator is the same math, without the record-keeping.",
  },
];

const sslFaqs = [
  {
    q: "Why 90 days for the default validity period?",
    a: "Let's Encrypt — the certificate authority docstoc automates — issues certificates valid for 90 days by default, shorter than the 1-year certificates some paid providers sell.",
  },
  {
    q: "What happens if a certificate expires?",
    a: "Browsers show a security warning and block or flag the site as untrusted. Renewing before expiry avoids any visible disruption to visitors.",
  },
  {
    q: "Can docstoc remind me automatically instead of me tracking this by hand?",
    a: "Yes — once a domain is added in docstoc, it tracks expiry for you and emails a reminder before the certificate lapses, with a one-click renewal path.",
  },
];

const trustBadgeFaqs = [
  {
    q: "Is this a legal-entity or business-registry check?",
    a: "No. The badge confirms DNS control of a domain (via a real Let's Encrypt certificate issued through docstoc) and, once Bitcoin-confirmed, the date that verified status began. It does not check company registries or claim KYC/identity verification.",
  },
  {
    q: "Do I need an account to look up someone else's badge?",
    a: "No. Paste a workspace account ID or a /trust/… link below — the lookup is public. Getting your own badge requires securing a domain in docstoc first.",
  },
  {
    q: "Where does the embed script go?",
    a: "Anywhere HTML is allowed — your website footer, proposals, or a client portal. The script loads a small domain-verified badge that links to the public trust profile.",
  },
  {
    q: "When does the Bitcoin timestamp show up?",
    a: "Usually within a few hours of first verification. Until then the badge still says domain-verified; once confirmed it upgrades to include the verified-since date.",
  },
];

const trustBadgeSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2e7d32" stroke-width="2" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="1.5"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>`;

const toolsIndexMain = `
<p class="crumb"><a href="/">Home</a> / Tools</p>
<h1>Free tools — one for each part of the workflow</h1>
<p class="lede">Small, no-signup utilities that match docstoc's products: finding the right template, checking a file's hash, tracking SSL expiry, verifying corporate domain trust badges, and estimating what late payments cost.</p>

<div class="tools-card-grid">
  <a class="tools-card" href="/tools/template-finder">
    <h2>Template finder</h2>
    <p>Pick your situation, get a direct link to the right free business or legal template.</p>
  </a>
  <a class="tools-card" href="/tools/file-hash-checker">
    <h2>File hash checker</h2>
    <p>Compute a file's SHA-256 hash in your browser — the same check behind docstoc's document certificates.</p>
  </a>
  <a class="tools-card" href="/tools/ssl-certificate-calculator">
    <h2>SSL certificate expiry calculator</h2>
    <p>Enter an issue date and validity period, get the exact expiry date and days remaining.</p>
  </a>
  <a class="tools-card" href="/tools/trust-badges">
    <h2>Verified Corporate Identity &amp; Trust Badges</h2>
    <p>Preview the domain-verified badge, look up a public trust profile, and copy the embed snippet.</p>
  </a>
  <a class="tools-card" href="/tools/invoice-chase-calculator">
    <h2>Invoice chase calculator</h2>
    <p>Estimate late payment interest and the cash you unlock when overdue invoices get paid sooner.</p>
  </a>
</div>

<h2>Why these tools</h2>
<p>Most tools here run entirely in your browser — no signup, no data upload. The trust-badge lookup only fetches a public profile you already have a link for. Use them to size a decision, then do the actual work in <a href="/app/">docstoc</a> if it's a fit.</p>
`.trim();

const templateFinderMain = `
<p class="crumb"><a href="/">Home</a> / <a href="/tools/">Tools</a> / Template finder</p>
<h1>Template finder</h1>
<p class="lede">Pick the situation closest to yours — each links straight to a free, ready-to-copy template. No signup, no search required.</p>

<div class="finder-grid">
  <a class="finder-card" href="/document-templates/independent-contractor-agreement-template">
    <strong>Hiring a freelance contractor</strong>
    <span>Independent Contractor Agreement</span>
  </a>
  <a class="finder-card" href="/document-templates/non-disclosure-and-non-circumvention-agreement-template">
    <strong>Sharing confidential information</strong>
    <span>Non-Disclosure &amp; Non-Circumvention Agreement</span>
  </a>
  <a class="finder-card" href="/document-templates/employee-offer-letter-template">
    <strong>Hiring a new employee</strong>
    <span>Employee Offer Letter</span>
  </a>
  <a class="finder-card" href="/document-templates/employment-termination-letter-template">
    <strong>Ending someone's employment</strong>
    <span>Employment Termination Letter</span>
  </a>
  <a class="finder-card" href="/document-templates/commercial-lease-agreement-template">
    <strong>Renting out a commercial property</strong>
    <span>Commercial Lease Agreement</span>
  </a>
  <a class="finder-card" href="/document-templates/eviction-notice-template">
    <strong>Evicting a tenant</strong>
    <span>Eviction Notice</span>
  </a>
  <a class="finder-card" href="/document-templates/demand-letter-unpaid-invoice-template">
    <strong>An invoice went unpaid</strong>
    <span>Demand Letter for Unpaid Invoice</span>
  </a>
  <a class="finder-card" href="/document-templates/">
    <strong>Something else</strong>
    <span>Browse all 488+ free templates →</span>
  </a>
</div>

<h2>After you pick a template</h2>
<p>Copy it directly — no account needed. If it's the final version of something a client needs proof of receiving, <a href="/app/certificates">certify it</a>. If it's tied to an invoice that goes unpaid, docstoc can <a href="/app/">draft the follow-up</a> for you.</p>

<h2>FAQs</h2>
${finderFaqs.map((f) => `<details class="faq-item"><summary>${f.q}</summary><p>${f.a}</p></details>`).join("\n")}

<h3>Related</h3>
<ul>
  <li><a href="/marketplace">The document marketplace</a></li>
  <li><a href="/use-cases/freelance-contract-templates">Real use case: hiring a freelance contractor</a></li>
</ul>
`.trim();

const hashCheckerMain = `
<p class="crumb"><a href="/">Home</a> / <a href="/tools/">Tools</a> / File hash checker</p>
<h1>File hash checker</h1>
<p class="lede">Drop a file to compute its SHA-256 hash instantly. Nothing is uploaded — the hash is calculated entirely in your browser using the Web Crypto API.</p>

<div class="hash-drop" data-hash-drop tabindex="0" role="button" aria-label="Drop a file or click to choose one">
  <p><strong>Click or drag a file here</strong></p>
  <p>Nothing leaves your browser</p>
  <input type="file" data-hash-input style="position:absolute; width:1px; height:1px; opacity:0; pointer-events:none;" />
</div>

<div class="hash-out" data-hash-out hidden>
  <div class="hash-out-row">
    <code data-hash-value>—</code>
    <button type="button" class="hash-copy-btn" data-hash-copy>Copy</button>
  </div>
  <p class="calc-note" data-hash-meta></p>
</div>

<h2>What this proves</h2>
<p>If you hash the same file twice — even on different computers — you get the exact same result. Change a single character inside the file and the hash changes completely. That makes it a reliable way to confirm a file wasn't altered after you last checked it.</p>
<p style="margin-top:20px"><a href="/app/certificates" class="nav-cta">Turn this into a shareable certificate</a></p>

<h2>FAQs</h2>
${hashFaqs.map((f) => `<details class="faq-item"><summary>${f.q}</summary><p>${f.a}</p></details>`).join("\n")}

<h3>Related</h3>
<ul>
  <li><a href="/use-cases/chasa-certificate-monitoring">Document certificate monitoring</a></li>
  <li><a href="/tools/trust-badges">Verified Corporate Identity &amp; Trust Badges</a></li>
  <li><a href="/verify/DOC-DEMO0001">See a sample verification page</a></li>
</ul>
`.trim();

const sslCalcMain = `
<p class="crumb"><a href="/">Home</a> / <a href="/tools/">Tools</a> / SSL certificate expiry calculator</p>
<h1>SSL certificate expiry calculator</h1>
<p class="lede">Enter when a certificate was issued and how long it's valid for — see the exact expiry date and how many days are left, before you're caught by a browser warning.</p>

<div class="calc-grid" data-calc="ssl-expiry">
  <div class="calc-panel">
    <div class="calc-field">
      <label for="ssl-issued">Date the certificate was issued</label>
      <input id="ssl-issued" data-ssl-issued type="date" />
    </div>
    <div class="calc-field">
      <label for="ssl-validity">Validity period (days)</label>
      <select id="ssl-validity" data-ssl-validity>
        <option value="90">90 days — Let's Encrypt (default)</option>
        <option value="398">398 days — max allowed by browsers today</option>
        <option value="365">365 days — 1 year</option>
      </select>
      <p class="calc-hint">docstoc issues 90-day Let's Encrypt certificates and reminds you before renewal is due.</p>
    </div>
  </div>
  <div class="calc-results" aria-live="polite">
    <p class="calc-stat"><span>Expiry date</span><strong data-ssl-out-expiry>—</strong></p>
    <p class="calc-stat"><span>Days remaining</span><strong data-ssl-out-remaining>—</strong></p>
    <p class="calc-note">Renew with a comfortable margin before the expiry date — DNS propagation and validation can take time.</p>
  </div>
</div>

<h2>Why this matters</h2>
<p>An expired SSL/TLS certificate shows visitors a security warning and can block access entirely, depending on the browser. Automated renewal reminders — like docstoc's — exist because manually tracking expiry across every domain doesn't scale.</p>
<p style="margin-top:20px"><a href="/app/login?start=1" class="nav-cta" data-cta data-cta-source="tool_ssl_calc">Secure a domain with automated renewal reminders →</a></p>

<h2>FAQs</h2>
${sslFaqs.map((f) => `<details class="faq-item"><summary>${f.q}</summary><p>${f.a}</p></details>`).join("\n")}

<h3>Related</h3>
<ul>
  <li><a href="/tools/trust-badges">Verified Corporate Identity &amp; Trust Badges</a></li>
  <li><a href="/monitoringssl">SSL certificate monitoring</a></li>
  <li><a href="/ssl">How docstoc's SSL automation works</a></li>
</ul>
`.trim();

const trustBadgesMain = `
<p class="crumb"><a href="/">Home</a> / <a href="/tools/">Tools</a> / Trust badges</p>
<h1>Verified Corporate Identity &amp; Trust Badges</h1>
<p class="lede">Show clients you control your domain — with a public trust profile and an embeddable badge backed by a real SSL certificate and an optional Bitcoin timestamp. Look up any public profile below; no signup required.</p>

<div class="calc-grid" data-calc="trust-badge">
  <div class="calc-panel">
    <div class="calc-field">
      <label for="trust-id">Account ID or trust profile URL</label>
      <input id="trust-id" data-trust-id type="text" placeholder="e.g. abc123… or https://chasa.io/trust/…" autocomplete="off" />
      <p class="calc-hint">Find the ID on your SSL Certificates page after a domain is verified, or in any public /trust/… link.</p>
    </div>
    <div class="trust-lookup-actions">
      <button type="button" data-trust-lookup>Look up profile</button>
      <button type="button" data-trust-copy-embed hidden>Copy embed code</button>
    </div>
  </div>
  <div class="calc-results" aria-live="polite">
    <p class="calc-stat"><span>Workspace</span><strong data-trust-out-name>—</strong></p>
    <p class="calc-stat"><span>Domain</span><strong data-trust-out-domain>—</strong></p>
    <p class="calc-stat"><span>SSL status</span><strong data-trust-out-status>—</strong></p>
    <p class="calc-stat"><span>Verified since</span><strong data-trust-out-since>—</strong></p>
    <p class="calc-note" data-trust-out-note>Paste an ID above to load a live public profile. Demo badge style:</p>
    <p style="margin-top:14px">
      <span class="trust-badge-demo" data-trust-badge-preview>${trustBadgeSvg} Domain-verified via docstoc</span>
    </p>
    <p class="trust-embed-box" data-trust-embed hidden></p>
    <p style="margin-top:14px" data-trust-profile-link-wrap hidden>
      <a href="#" data-trust-profile-link target="_blank" rel="noopener noreferrer">Open public trust profile →</a>
    </p>
  </div>
</div>

<h2>What this verifies</h2>
<p>When you issue a domain's SSL certificate through docstoc, the platform proves you control that domain's DNS. That creates a public trust profile with a "verified since" date. Once the OpenTimestamps Bitcoin anchor confirms, anyone can independently check the claim — not only against docstoc's database.</p>
<ul>
  <li><strong>Domain control</strong> — proven by a live Let's Encrypt certificate for your domain</li>
  <li><strong>Verified-since date</strong> — Bitcoin-timestamped when confirmation completes</li>
  <li><strong>Embeddable badge</strong> — one script tag for your site, proposals, or portal</li>
</ul>

<h2>What it does not claim</h2>
<p>docstoc does not check business registries, government IDs, or legal-entity filings. The badge never says it does. Use it as domain-verified corporate presence — not as KYC or a chamber-of-commerce seal.</p>

<h2>How to get your own badge</h2>
<ol>
  <li>Secure a domain with <a href="/ssl">docstoc SSL automation</a> (Business plan).</li>
  <li>Open <a href="/app/ssl">SSL Certificates</a> — your trust profile and embed snippet appear once the domain is active.</li>
  <li>Paste the script on your site, or share your <code>/trust/…</code> link.</li>
</ol>
<p style="margin-top:20px"><a href="/trust-badges" class="nav-cta">Read the full product overview →</a></p>
<p style="margin-top:12px"><a href="/app/login?start=1" data-cta data-cta-source="tool_trust_badges">Secure a domain and get a badge →</a></p>

<h2>FAQs</h2>
${trustBadgeFaqs.map((f) => `<details class="faq-item"><summary>${f.q}</summary><p>${f.a}</p></details>`).join("\n")}

<h3>Related</h3>
<ul>
  <li><a href="/trust-badges">Trust badges product page</a></li>
  <li><a href="/ssl">Free SSL automation</a></li>
  <li><a href="/tools/ssl-certificate-calculator">SSL certificate expiry calculator</a></li>
  <li><a href="/tools/file-hash-checker">File hash checker</a></li>
</ul>
`.trim();

const chaseCalcMain = `
<p class="crumb"><a href="/">Home</a> / <a href="/tools/">Tools</a> / Invoice chase calculator</p>
<h1>Invoice chase calculator</h1>
<p class="lede">Two quick estimates: interest owed on one overdue invoice, and the cash + time you could unlock by chasing consistently across all of them.</p>

<h2>Late payment interest</h2>
<div class="calc-grid" data-calc="late-payment">
  <div class="calc-panel">
    <div class="calc-field">
      <label for="lp-currency">Currency</label>
      <select id="lp-currency" data-lp-currency>
        <option value="USD">USD</option>
        <option value="EUR">EUR</option>
        <option value="GBP">GBP</option>
        <option value="AUD">AUD</option>
        <option value="CAD">CAD</option>
      </select>
    </div>
    <div class="calc-field">
      <label for="lp-amount">Invoice amount</label>
      <input id="lp-amount" data-lp-amount type="number" min="0" step="0.01" value="2500" />
    </div>
    <div class="calc-field">
      <label for="lp-overdue">Date payment became overdue</label>
      <input id="lp-overdue" data-lp-overdue type="date" />
    </div>
    <div class="calc-field">
      <label for="lp-paid">Date of payment (or today if still unpaid)</label>
      <input id="lp-paid" data-lp-paid type="date" />
    </div>
    <div class="calc-field">
      <label for="lp-rate">Annual interest rate (<span data-lp-rate-label>8.0%</span>)</label>
      <input id="lp-rate" data-lp-rate type="range" min="0" max="30" step="0.1" value="8" />
      <p class="calc-hint">Use your contract rate, or a statutory commercial late-payment rate where it applies.</p>
    </div>
    <div class="calc-field">
      <label for="lp-fee">Optional one-time late fee (% of invoice)</label>
      <input id="lp-fee" data-lp-fee type="number" min="0" max="100" step="0.1" value="0" />
    </div>
  </div>
  <div class="calc-results" aria-live="polite">
    <p class="calc-stat"><span>Days overdue</span><strong data-lp-out-days>—</strong></p>
    <p class="calc-stat"><span>Interest accrued</span><strong data-lp-out-interest>—</strong></p>
    <p class="calc-stat"><span>Late fee</span><strong data-lp-out-fee>—</strong></p>
    <p class="calc-stat"><span>Updated total due</span><strong data-lp-out-total>—</strong></p>
    <p class="calc-note">Simple interest: amount × annual rate × (days ÷ 365). Not legal advice — confirm rates and fees against your contract and local law.</p>
  </div>
</div>

<hr class="calc-divider" />

<h2>Cash unlocked by chasing consistently</h2>
<div class="calc-grid" data-calc="chase-savings">
  <div class="calc-panel">
    <div class="calc-field">
      <label for="sv-currency">Currency</label>
      <select id="sv-currency" data-sv-currency>
        <option value="USD">USD</option>
        <option value="EUR">EUR</option>
        <option value="GBP">GBP</option>
        <option value="AUD">AUD</option>
        <option value="CAD">CAD</option>
      </select>
    </div>
    <div class="calc-field">
      <label for="sv-ar">Unpaid invoices / AR balance</label>
      <input id="sv-ar" data-sv-ar type="number" min="0" step="100" value="50000" />
    </div>
    <div class="calc-field">
      <label for="sv-dso">Current average days outstanding</label>
      <input id="sv-dso" data-sv-dso type="number" min="1" step="1" value="45" />
    </div>
    <div class="calc-field">
      <label for="sv-reduce">Days you could cut with consistent chasing (<span data-sv-reduce-label>12</span>)</label>
      <input id="sv-reduce" data-sv-reduce type="range" min="0" max="40" step="1" value="12" />
      <p class="calc-hint">Many teams see faster payments when reminders go out on a fixed cadence.</p>
    </div>
    <div class="calc-field">
      <label for="sv-hours">Hours per week spent chasing invoices</label>
      <input id="sv-hours" data-sv-hours type="number" min="0" step="0.5" value="4" />
    </div>
    <div class="calc-field">
      <label for="sv-wage">Your hourly value (or staff cost)</label>
      <input id="sv-wage" data-sv-wage type="number" min="0" step="1" value="50" />
    </div>
  </div>
  <div class="calc-results" aria-live="polite">
    <p class="calc-stat"><span>Cash unlocked (working capital)</span><strong data-sv-out-cash>—</strong></p>
    <p class="calc-stat"><span>Chase time saved (est.)</span><strong data-sv-out-hours>—</strong></p>
    <p class="calc-stat"><span>Value of time saved / year</span><strong data-sv-out-timecost>—</strong></p>
    <p class="calc-stat"><span>Approx. ROI vs Pro ($14.99/mo)</span><strong data-sv-out-roi>—</strong></p>
    <p class="calc-note">Cash unlocked ≈ (AR ÷ days outstanding) × days cut. Time savings assume ~50% less manual chase work with a clear draft workflow. Illustrative only.</p>
  </div>
</div>

<h2>FAQs</h2>
${chaseFaqs.map((f) => `<details class="faq-item"><summary>${f.q}</summary><p>${f.a}</p></details>`).join("\n")}

<h3>Related</h3>
<ul>
  <li><a href="/overdue-invoice">Overdue invoice follow-up</a></li>
  <li><a href="/blog/freelancer-late-payment-policy/">Freelancer late payment policy</a></li>
  <li><a href="/free-templates/">Free reminder templates</a></li>
</ul>
<p style="margin-top:28px"><a href="/app/" class="nav-cta">Draft the chase email</a></p>
`.trim();

const pages = [
  {
    file: "index.html",
    title: "Free Tools — Templates, Hash, SSL, Trust Badges, Invoice Chase | docstoc",
    description:
      "Free no-signup tools: find templates, check SHA-256 hashes, calculate SSL expiry, look up verified corporate trust badges, and estimate invoice chase savings.",
    canonical: "/tools/",
    mainHtml: toolsIndexMain,
    jsonLd: multiJsonLd(
      breadcrumbJsonLd([
        { name: "Home", item: "https://chasa.io/" },
        { name: "Tools", item: "https://chasa.io/tools/" },
      ])
    ),
  },
  {
    file: "template-finder.html",
    title: "Template Finder — Find the Right Free Document | docstoc",
    description:
      "Pick your situation, get a direct link to the right free business or legal template. No search, no signup.",
    canonical: "/tools/template-finder",
    mainHtml: templateFinderMain,
    jsonLd: multiJsonLd(
      breadcrumbJsonLd([
        { name: "Home", item: "https://chasa.io/" },
        { name: "Tools", item: "https://chasa.io/tools/" },
        { name: "Template finder", item: "https://chasa.io/tools/template-finder" },
      ]),
      faqJsonLd(finderFaqs)
    ),
  },
  {
    file: "file-hash-checker.html",
    title: "Free File Hash Checker (SHA-256) — No Upload | docstoc",
    description:
      "Compute a file's SHA-256 hash entirely in your browser. Nothing is uploaded. Free, instant, no signup.",
    canonical: "/tools/file-hash-checker",
    mainHtml: hashCheckerMain,
    jsonLd: multiJsonLd(
      breadcrumbJsonLd([
        { name: "Home", item: "https://chasa.io/" },
        { name: "Tools", item: "https://chasa.io/tools/" },
        { name: "File hash checker", item: "https://chasa.io/tools/file-hash-checker" },
      ]),
      webAppJsonLd({
        name: "File hash checker",
        description: "Compute a file's SHA-256 hash in the browser, no upload required.",
        url: "https://chasa.io/tools/file-hash-checker",
      }),
      faqJsonLd(hashFaqs)
    ),
  },
  {
    file: "ssl-certificate-calculator.html",
    title: "SSL Certificate Expiry Calculator | docstoc",
    description:
      "Enter a certificate's issue date and validity period to see the exact expiry date and days remaining. Free, no signup.",
    canonical: "/tools/ssl-certificate-calculator",
    mainHtml: sslCalcMain,
    jsonLd: multiJsonLd(
      breadcrumbJsonLd([
        { name: "Home", item: "https://chasa.io/" },
        { name: "Tools", item: "https://chasa.io/tools/" },
        { name: "SSL certificate expiry calculator", item: "https://chasa.io/tools/ssl-certificate-calculator" },
      ]),
      webAppJsonLd({
        name: "SSL certificate expiry calculator",
        description: "Calculate SSL/TLS certificate expiry date and days remaining.",
        url: "https://chasa.io/tools/ssl-certificate-calculator",
      }),
      faqJsonLd(sslFaqs)
    ),
  },
  {
    file: "trust-badges.html",
    title: "Verified Corporate Identity & Trust Badges — Lookup & Embed | docstoc",
    description:
      "Look up a public domain-verified trust profile, preview the embeddable badge, and copy the script. Free lookup, no signup. Bitcoin-timestamped verified-since when confirmed.",
    canonical: "/tools/trust-badges",
    mainHtml: trustBadgesMain,
    jsonLd: multiJsonLd(
      breadcrumbJsonLd([
        { name: "Home", item: "https://chasa.io/" },
        { name: "Tools", item: "https://chasa.io/tools/" },
        { name: "Verified Corporate Identity & Trust Badges", item: "https://chasa.io/tools/trust-badges" },
      ]),
      webAppJsonLd({
        name: "Verified Corporate Identity & Trust Badges",
        description: "Look up public trust profiles and preview embeddable domain-verified badges.",
        url: "https://chasa.io/tools/trust-badges",
      }),
      faqJsonLd(trustBadgeFaqs)
    ),
  },
  {
    file: "invoice-chase-calculator.html",
    title: "Invoice Chase Calculator — Late Fees & Savings | docstoc",
    description:
      "Free calculator for late payment interest and chase savings. Estimate fees on unpaid invoices and cash unlocked when you get paid faster.",
    canonical: "/tools/invoice-chase-calculator",
    mainHtml: chaseCalcMain,
    jsonLd: multiJsonLd(
      breadcrumbJsonLd([
        { name: "Home", item: "https://chasa.io/" },
        { name: "Tools", item: "https://chasa.io/tools/" },
        { name: "Invoice chase calculator", item: "https://chasa.io/tools/invoice-chase-calculator" },
      ]),
      webAppJsonLd({
        name: "Invoice chase calculator",
        description: "Estimate late payment interest and cash unlocked from consistent invoice chasing.",
        url: "https://chasa.io/tools/invoice-chase-calculator",
      }),
      faqJsonLd(chaseFaqs)
    ),
  },
];

for (const page of pages) {
  const html = chrome({
    title: page.title,
    description: page.description,
    canonical: page.canonical,
    activeNav: "tools",
    mainHtml: page.mainHtml,
    jsonLd: page.jsonLd,
    depth: 1,
    extraHead,
  });
  writeFileSync(join(outDir, page.file), html, "utf8");
  console.log(`Wrote tools/${page.file}`);
}

console.log("Done — tool pages generated.");
