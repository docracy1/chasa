#!/usr/bin/env node
/**
 * Generates SEO calculator pages under /tools/.
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
.calc-stat strong { display: block; font-family: Fraunces, Georgia, serif; font-size: 28px; margin-top: 2px; }
.calc-stat span { font-size: 13px; color: var(--ink-soft); font-weight: 600; }
.calc-note { font-size: 12.5px; color: var(--ink-soft); margin-top: 12px; line-height: 1.45; }
.tools-card-grid { display: grid; gap: 14px; margin: 22px 0 8px; }
@media (min-width: 700px) { .tools-card-grid { grid-template-columns: 1fr 1fr; } }
.tools-card {
  display: block; text-decoration: none; color: inherit;
  border: 1px solid var(--line); border-radius: 12px; padding: 18px 20px;
  background: var(--white); transition: border-color 0.15s ease, transform 0.12s ease;
}
.tools-card:hover { border-color: var(--accent); transform: translateY(-1px); }
.tools-card h2 { font-size: 20px; margin: 0 0 8px; font-family: Fraunces, Georgia, serif; }
.tools-card p { margin: 0; color: var(--ink-soft); font-size: 14.5px; line-height: 1.45; }
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
      applicationCategory: "FinanceApplication",
      operatingSystem: "Any",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      provider: { "@type": "Organization", name: "Chasa", url: "https://chasa.io/" },
    },
    null,
    2
  );
}

function multiJsonLd(...blocks) {
  return `[${blocks.join(",\n")}]`;
}

const lateFaqs = [
  {
    q: "How do you calculate late payment interest on an unpaid invoice?",
    a: "Multiply the invoice amount by the annual interest rate, then by days overdue divided by 365. Example: $1,000 × 8% × (30 ÷ 365) ≈ $6.58 interest.",
  },
  {
    q: "What interest rate should I use for late invoices?",
    a: "Use the rate in your contract or invoice terms. Many freelancers use 1–1.5% per month (about 12–18% annually). Some countries set a statutory rate for commercial late payments — check local rules.",
  },
  {
    q: "Can I charge late fees if my contract never mentioned them?",
    a: "Usually no. Late interest and fees are easiest to enforce when they appear in your agreement or invoice terms before work starts. Add them to new contracts going forward.",
  },
  {
    q: "Does Chasa email clients for me?",
    a: "No. Chasa drafts follow-up emails; you review and send from your own inbox. That keeps your client relationship in your control.",
  },
];

const savingsFaqs = [
  {
    q: "How does this chase savings calculator estimate cash unlocked?",
    a: "It divides your unpaid AR balance by current average days outstanding to estimate daily cash tied up, then multiplies by the days you expect to shorten with consistent follow-ups.",
  },
  {
    q: "Is this the same as a DSO or ROI calculator?",
    a: "It is a practical DSO / cash-flow style estimate plus time savings. It is not tax, accounting, or investment advice — use it to size the cost of slow collections.",
  },
  {
    q: "How does Chasa help reduce days outstanding?",
    a: "Chasa drafts tone-matched reminders for each overdue stage so you follow up sooner and more consistently. You still send the emails yourself.",
  },
];

const indexMain = `
<p class="crumb"><a href="/">Home</a> / Tools</p>
<h1>Free invoice chase calculators</h1>
<p class="lede">Estimate late payment interest and the cash you unlock when overdue invoices get paid sooner. Built for freelancers and small teams who chase invoices themselves — then draft the follow-up in <a href="/app/">Chasa</a>.</p>

<div class="tools-card-grid">
  <a class="tools-card" href="/tools/late-payment-calculator">
    <h2>Late payment calculator</h2>
    <p>Calculate interest and optional late fees on an unpaid invoice from overdue date to payment date.</p>
  </a>
  <a class="tools-card" href="/tools/chase-savings-calculator">
    <h2>Chase savings calculator</h2>
    <p>Estimate cash unlocked and hours saved if you cut days outstanding with consistent follow-ups.</p>
  </a>
</div>

<h2>Why these tools</h2>
<p>These calculators run entirely in your browser — no signup, no data upload. Use them to size interest or cash impact, then draft a clear chase email in Chasa and send it yourself.</p>
<p style="margin-top:28px"><a href="/app/" class="nav-cta">Draft a chase email</a></p>
`.trim();

const lateMain = `
<p class="crumb"><a href="/">Home</a> / <a href="/tools/">Tools</a> / Late payment calculator</p>
<h1>Late payment calculator</h1>
<p class="lede">Calculate interest on an unpaid invoice. Enter amount, overdue date, payment date, and rate — see accrued interest, optional flat late fee, and the new total due.</p>

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

<h2>How to calculate late payment interest</h2>
<p>Late payment interest compensates you for cash tied up after the due date. The usual simple-interest formula is:</p>
<p><strong>Interest = invoice amount × annual rate × (days overdue ÷ 365)</strong></p>
<p>After you know the number, add it as a clear line item on an updated invoice or statement, then send a professional follow-up. Chasa can draft that email; you send it.</p>

<h2>What to do next</h2>
<ol>
  <li>Confirm the rate is in your terms or allowed by local commercial rules.</li>
  <li>Issue an updated invoice that itemizes original amount + interest (+ fee if any).</li>
  <li><a href="/app/">Draft an overdue follow-up</a> that explains the new total without burning the relationship.</li>
</ol>

<h2>FAQs</h2>
${lateFaqs
  .map(
    (f) => `<details class="faq-item"><summary>${f.q}</summary><p>${f.a}</p></details>`
  )
  .join("\n")}

<h3>Related</h3>
<ul>
  <li><a href="/tools/chase-savings-calculator">Chase savings calculator</a></li>
  <li><a href="/overdue-invoice">Overdue invoice follow-up</a></li>
  <li><a href="/blog/freelancer-late-payment-policy/">Freelancer late payment policy</a></li>
  <li><a href="/free-templates/">Free reminder templates</a></li>
</ul>
<p style="margin-top:28px"><a href="/app/" class="nav-cta">Draft the chase email</a></p>
`.trim();

const savingsMain = `
<p class="crumb"><a href="/">Home</a> / <a href="/tools/">Tools</a> / Chase savings calculator</p>
<h1>Chase savings calculator</h1>
<p class="lede">Estimate cash unlocked and time saved when consistent invoice follow-ups cut days outstanding. A free DSO-style ROI check for freelancers and small finance teams — no signup.</p>

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
    <p class="calc-stat"><span>Approx. ROI vs Solo ($7/mo)</span><strong data-sv-out-roi>—</strong></p>
    <p class="calc-note">Cash unlocked ≈ (AR ÷ days outstanding) × days cut. Time savings assume ~50% less manual chase work with a clear draft workflow. Illustrative only.</p>
  </div>
</div>

<h2>How this ROI estimate works</h2>
<p>Every day an invoice sits unpaid ties up cash. If your average unpaid balance is high and days outstanding are long, even a modest reduction frees working capital you can use for payroll, tax, or growth.</p>
<p>Chasa does not auto-email clients. It writes the follow-ups so you actually send them — the missing step for most freelancers who “mean to chase later.”</p>

<h2>FAQs</h2>
${savingsFaqs
  .map(
    (f) => `<details class="faq-item"><summary>${f.q}</summary><p>${f.a}</p></details>`
  )
  .join("\n")}

<h3>Related</h3>
<ul>
  <li><a href="/tools/late-payment-calculator">Late payment calculator</a></li>
  <li><a href="/chase-invoices">Chase invoices overview</a></li>
  <li><a href="/#pricing">Chasa pricing</a></li>
  <li><a href="/payment-reminder">Payment reminder emails</a></li>
</ul>
<p style="margin-top:28px"><a href="/app/" class="nav-cta">Try Chasa free</a></p>
`.trim();

const pages = [
  {
    file: "index.html",
    title: "Free Invoice Chase Calculators — Late Fees & Savings | Chasa",
    description:
      "Free calculators for late payment interest and chase savings. Estimate fees on unpaid invoices and cash unlocked when you get paid faster.",
    canonical: "/tools/",
    mainHtml: indexMain,
    jsonLd: multiJsonLd(
      breadcrumbJsonLd([
        { name: "Home", item: "https://chasa.io/" },
        { name: "Tools", item: "https://chasa.io/tools/" },
      ]),
      webAppJsonLd({
        name: "Chasa invoice chase calculators",
        description:
          "Free late payment interest and chase savings calculators for freelancers and small businesses.",
        url: "https://chasa.io/tools/",
      })
    ),
  },
  {
    file: "late-payment-calculator.html",
    title: "Late Payment Calculator — Invoice Interest & Fees | Chasa",
    description:
      "Free late payment calculator for unpaid invoices. Compute interest by days overdue, optional late fee, and updated total due. No signup.",
    canonical: "/tools/late-payment-calculator",
    mainHtml: lateMain,
    jsonLd: multiJsonLd(
      breadcrumbJsonLd([
        { name: "Home", item: "https://chasa.io/" },
        { name: "Tools", item: "https://chasa.io/tools/" },
        { name: "Late payment calculator", item: "https://chasa.io/tools/late-payment-calculator" },
      ]),
      webAppJsonLd({
        name: "Late payment calculator",
        description: "Calculate interest and late fees on an unpaid invoice.",
        url: "https://chasa.io/tools/late-payment-calculator",
      }),
      faqJsonLd(lateFaqs)
    ),
  },
  {
    file: "chase-savings-calculator.html",
    title: "Chase Savings Calculator — DSO & Cash Unlocked | Chasa",
    description:
      "Free chase savings / ROI calculator. Estimate cash unlocked and hours saved when consistent invoice follow-ups reduce days outstanding.",
    canonical: "/tools/chase-savings-calculator",
    mainHtml: savingsMain,
    jsonLd: multiJsonLd(
      breadcrumbJsonLd([
        { name: "Home", item: "https://chasa.io/" },
        { name: "Tools", item: "https://chasa.io/tools/" },
        { name: "Chase savings calculator", item: "https://chasa.io/tools/chase-savings-calculator" },
      ]),
      webAppJsonLd({
        name: "Chase savings calculator",
        description: "Estimate working capital unlocked and time saved from faster invoice chasing.",
        url: "https://chasa.io/tools/chase-savings-calculator",
      }),
      faqJsonLd(savingsFaqs)
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

console.log("Done — calculator pages generated.");
