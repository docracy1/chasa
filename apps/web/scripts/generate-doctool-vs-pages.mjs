#!/usr/bin/env node
/**
 * Generates one "docstoc vs {Competitor}" SEO landing page per document/contract-workflow tool —
 * a different competitor category from generate-vs-pages.mjs (which covers invoice-chasing-only
 * tools). These compare docstoc's document-templates + certification angle against tools whose
 * core business is client contracts, proposals, and legal-document generation.
 * Run: node apps/web/scripts/generate-doctool-vs-pages.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chrome, escapeHtml } from "./lib/chrome.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "../public");

/** @type {Array<{
 *  slug: string; name: string; pricingUrl: string; bestFit: string; entryPrice: string;
 *  pricingModel: string; freeTemplates: string; invoiceChasing: string; certification: string;
 *  coreStrength: string; freeTier: string; summary: string; faq: Array<{q: string; a: string}>;
 * }>} */
const COMPETITORS = [
  {
    slug: "bonsai",
    name: "Bonsai",
    pricingUrl: "https://www.hellobonsai.com/pricing",
    bestFit: "Solo freelancers & small agencies",
    entryPrice: "$9/mo per user (billed annually)",
    pricingModel: "Per-seat — a 2-person team pays double",
    freeTemplates: "✗ own contract/proposal templates only, gated to paid plans",
    invoiceChasing: "Invoicing + reminders, not AI-drafted or tone-matched",
    certification: "✗ no document certification/verification",
    coreStrength: "Time tracking, project management, CRM, deal pipeline",
    freeTier: "7-day trial only — no free plan",
    summary:
      "Bonsai bundles time tracking, project management, and a client CRM alongside invoicing and contracts — genuinely more built-out project-management tooling than docstoc offers. But it's priced per seat ($9/mo/user billed annually, more month-to-month) with no free plan, has no AI-drafted invoice-chase emails, and no document certification. docstoc's free tier gives real functionality with no seat multiplier, plus a free document-template library and certification that Bonsai doesn't have at any tier.",
    faq: [
      {
        q: "Is docstoc a Bonsai alternative?",
        a: "For invoice chasing, document templates, and certification specifically, yes. Bonsai is a stronger fit if you need mature time tracking, Gantt/workload views, or a deal pipeline — docstoc doesn't try to replace that.",
      },
      {
        q: "Is docstoc cheaper than Bonsai?",
        a: "Yes for most team sizes — Bonsai's cheapest paid plan is $9/mo per user (so a 2-person team pays $18/mo), where docstoc Pro is a flat $14.99/mo regardless of seats up to the plan's limit.",
      },
      {
        q: "Does Bonsai have AI invoice-chasing or document certification?",
        a: "No. Bonsai has invoicing and payment reminders, but they're not AI-drafted or tone-matched to how late an invoice is, and Bonsai has no document-certification/verification feature.",
      },
    ],
  },
  {
    slug: "honeybook",
    name: "HoneyBook",
    pricingUrl: "https://www.honeybook.com/pricing",
    bestFit: "Creative & service-based solopreneurs",
    entryPrice: "$29/mo billed annually ($36/mo month-to-month)",
    pricingModel: "Flat per workspace, tiered by features/seats",
    freeTemplates: "✗ proposal/contract templates for its own workflow, not a public library",
    invoiceChasing: "Automations/reminders, not AI-drafted or tone-matched",
    certification: "✗ no document certification/verification",
    coreStrength: "Client-facing branded portal, scheduler, lead-capture forms",
    freeTier: "Trial only — no free plan",
    summary:
      "HoneyBook is built for creative and service-based solopreneurs who want a branded client portal with scheduling, lead forms, and payment automations in one place. Its entry price ($29/mo annual, $36/mo month-to-month) is well above docstoc's Pro tier ($14.99/mo) or even Business ($39.99/mo), and it has no AI-drafted invoice chasing, no public document-template library, and no certification feature. docstoc is narrower in client-acquisition tooling but adds those three things HoneyBook doesn't have.",
    faq: [
      {
        q: "Is docstoc a HoneyBook alternative?",
        a: "For invoice chasing and document templates, yes — at a fraction of the price. HoneyBook is the stronger choice if you specifically need lead-capture forms, a client scheduler, and a fully branded client portal.",
      },
      {
        q: "Is docstoc cheaper than HoneyBook?",
        a: "Yes — HoneyBook starts at $29/mo (annual) or $36/mo (monthly). docstoc's free tier costs nothing, and Pro is $14.99/mo.",
      },
      {
        q: "Does HoneyBook have document certification or a free template library?",
        a: "No. HoneyBook's templates are proposal/contract templates for its own client workflow, not a public library, and it has no document-certification or verification-link feature.",
      },
    ],
  },
  {
    slug: "pandadoc",
    name: "PandaDoc",
    pricingUrl: "https://www.pandadoc.com/pricing/",
    bestFit: "Sales, ops, and HR teams doing proposal/contract workflows",
    entryPrice: "Typically ~$19/user/mo billed annually",
    pricingModel: "Per-seat, tiered by workflow/CRM features",
    freeTemplates: "Free tier is e-signature only, capped around 60 documents/year",
    invoiceChasing: "✗ no AI-drafted, tone-matched invoice-chase emails",
    certification: "✗ no tamper-evident document-certification/verify-link feature",
    coreStrength: "CRM integrations, sales-workflow automation, document analytics",
    freeTier: "Free eSign plan — signature only, ~60 documents/year cap",
    summary:
      "PandaDoc is a document-workflow tool built for sales and ops teams: proposal/quote/contract creation with e-signature and CRM integrations (Salesforce, HubSpot). Its free tier is signature-only with a roughly 60-document/year cap, and paid tiers run per seat from around $19/mo. It has no AI invoice-chasing and no document-certification feature. docstoc's free document-template library has no document-count cap, and it adds AI-drafted invoice chasing and certification that PandaDoc doesn't offer at any tier.",
    faq: [
      {
        q: "Is docstoc a PandaDoc alternative?",
        a: "For a free, uncapped document-template library plus invoice chasing and certification, yes. PandaDoc is the stronger choice for CRM-integrated sales workflows and advanced e-signature analytics.",
      },
      {
        q: "Does PandaDoc's free plan have the same document access as docstoc?",
        a: "No — PandaDoc's free tier is signature-only and capped at roughly 60 documents per year. docstoc's document-template library is free to browse and copy with no cap and no signup.",
      },
      {
        q: "Does PandaDoc offer invoice chasing or document certification?",
        a: "No. PandaDoc focuses on proposal/contract creation and e-signature, not AI-drafted payment follow-ups or tamper-evident document certification.",
      },
    ],
  },
  {
    slug: "rocket-lawyer",
    name: "Rocket Lawyer",
    pricingUrl: "https://www.rocketlawyer.com/pricing",
    bestFit: "Individuals & small landlords wanting attorney access",
    entryPrice: "$149/year (Standard) for unlimited documents",
    pricingModel: "Annual membership required for unlimited document access",
    freeTemplates: "Free tier is very limited — unlimited documents require a paid membership",
    invoiceChasing: "✗ no invoicing or invoice-chase functionality at all",
    certification: "✗ no document certification/verification, and no arbitrary-document e-sign",
    coreStrength: "Live attorney consultations and \"Ask an Attorney\" access",
    freeTier: "Very limited document access without a paid membership",
    summary:
      "Rocket Lawyer pairs template legal documents with real (if limited) attorney access — live consultations and Ask-an-Attorney questions that docstoc has no equivalent for. But every tier requires an annual membership ($149–$349/year) to get unlimited document access; free-tier access is minimal. Rocket Lawyer has no invoicing, no AI invoice-chasing, and no document-certification feature — its e-signature only covers documents generated in its own system, not arbitrary uploads.",
    faq: [
      {
        q: "Is docstoc a Rocket Lawyer alternative?",
        a: "For free document templates with no subscription, yes. Rocket Lawyer is the better choice specifically if you want live attorney consultations bundled in — docstoc doesn't offer legal advice.",
      },
      {
        q: "Are docstoc's document templates really free, unlike Rocket Lawyer's?",
        a: "Yes — docstoc's document-template library is free to copy with no account or subscription. Rocket Lawyer's free tier gives very limited document access; unlimited access requires an annual membership starting at $149/year.",
      },
      {
        q: "Does Rocket Lawyer offer invoice chasing or document certification?",
        a: "No — Rocket Lawyer doesn't do invoicing or payment follow-ups, and it has no tamper-evident document-certification feature.",
      },
    ],
  },
  {
    slug: "legalzoom",
    name: "LegalZoom",
    pricingUrl: "https://www.legalzoom.com/business/business-formation",
    bestFit: "First-time business owners forming an LLC/corporation",
    entryPrice: "$0 + state filing fees (formation); legal-document subscriptions run $31–$49/mo",
    pricingModel: "Bundled formation packages plus a separate ongoing legal-plan subscription",
    freeTemplates: "Free tier is filing-only; document generation needs a paid legal plan",
    invoiceChasing: "✗ no invoicing or invoice-chase functionality at all",
    certification: "✗ no document certification/verification",
    coreStrength: "LLC/business formation, registered agent, and compliance filings",
    freeTier: "Filing-only — document templates need a paid legal-plan subscription",
    summary:
      "LegalZoom's core product is business formation and compliance filing (LLC setup, EIN, registered agent, annual reports) — real services docstoc doesn't offer at all. Its legal-document generation is bundled into a separate ongoing subscription reported at roughly $31–$49/mo, several times docstoc's Pro tier, for a narrower feature set with no invoicing, no AI invoice-chasing, and no document certification.",
    faq: [
      {
        q: "Is docstoc a LegalZoom alternative?",
        a: "For free business & legal document templates, yes. LegalZoom is the right choice specifically for LLC/business formation and registered-agent services, which docstoc doesn't offer.",
      },
      {
        q: "Is docstoc cheaper than LegalZoom's document plans?",
        a: "Yes — LegalZoom's ongoing legal-document subscription is reported around $31–$49/mo. docstoc's document-template library is free with no subscription, and Pro (with invoice chasing and certification added) is $14.99/mo.",
      },
      {
        q: "Does LegalZoom offer invoice chasing or document certification?",
        a: "No — LegalZoom focuses on formation and legal-document generation, not invoicing or tamper-evident document certification.",
      },
    ],
  },
];

function buildJsonLd(c) {
  return JSON.stringify(
    {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: "https://docstoc.io/" },
            {
              "@type": "ListItem",
              position: 2,
              name: `docstoc vs ${c.name}`,
              item: `https://docstoc.io/docstoc-vs-${c.slug}`,
            },
          ],
        },
        {
          "@type": "FAQPage",
          mainEntity: c.faq.map((item) => ({
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

function buildMain(c) {
  const title = `docstoc vs ${c.name}`;
  const rows = [
    ["Best fit", "Freelancers & small teams needing docs + chasing", c.bestFit],
    ["Entry paid price", "$14.99/mo Pro, flat", c.entryPrice],
    ["Pricing model", "Flat per workspace, no per-seat multiplier", c.pricingModel],
    ["Free business & legal document templates", "✓ free, no signup, no cap", c.freeTemplates],
    ["AI-drafted invoice chasing", "✓ tone-matched to days overdue", c.invoiceChasing],
    ["Document certification / verify link", "✓ free, tamper-evident hash", c.certification],
    ["Core strength", "Documents + AI chasing in one flat-fee tool", c.coreStrength],
    ["Free tier", "5 AI drafts/mo + full template library", c.freeTier],
  ];

  const tableRows = rows
    .map(
      ([label, docstocVal, otherVal]) =>
        `          <tr>
            <td>${escapeHtml(label)}</td>
            <td class="col-docstoc">${docstocVal}</td>
            <td>${escapeHtml(otherVal)}</td>
          </tr>`
    )
    .join("\n");

  const faqHtml = c.faq
    .map(
      (item) =>
        `<details class="faq-item"><summary>${escapeHtml(item.q)}</summary>\n<p>${escapeHtml(item.a)}</p>\n</details>`
    )
    .join("\n");

  return `<p class="crumb"><a href="/">Home</a> / ${escapeHtml(title)}</p>
<h1>${escapeHtml(title)} — which document &amp; client tool fits?</h1>
  <p class="lede">${c.summary}</p>

  <h2>docstoc vs ${escapeHtml(c.name)} at a glance</h2>
  <div class="compare-table-wrap">
    <table class="compare-table">
      <thead>
        <tr>
          <th scope="col"></th>
          <th scope="col" class="col-docstoc">docstoc</th>
          <th scope="col">${escapeHtml(c.name)}</th>
        </tr>
      </thead>
      <tbody>
${tableRows}
      </tbody>
    </table>
  </div>
  <p class="pc-note">Figures reflect publicly available pricing and feature information as of August 2026 — check <a href="${c.pricingUrl}" target="_blank" rel="noopener noreferrer">${escapeHtml(c.name)}'s pricing page</a> directly before you buy, as plans change.</p>

  <p style="margin-top:28px"><a href="/document-templates/" class="nav-cta">Browse free document templates</a></p>

  <h2>FAQ</h2>
  ${faqHtml}`;
}

mkdirSync(publicDir, { recursive: true });

for (const c of COMPETITORS) {
  const slug = `docstoc-vs-${c.slug}`;
  const title = `docstoc vs ${c.name} — Free Document Templates &amp; AI Chasing | docstoc`;
  const description = `docstoc vs ${c.name}: pricing, free document templates, AI invoice chasing, and document certification compared side by side.`;

  const html = chrome({
    title,
    description,
    canonical: `/${slug}`,
    activeNav: "",
    mainHtml: buildMain(c),
    jsonLd: buildJsonLd(c),
    depth: 0,
  });

  writeFileSync(join(publicDir, `${slug}.html`), html, "utf8");
  console.log(`Generated ${slug}.html`);
}

console.log(`Done — ${COMPETITORS.length} document-tool vs-competitor pages.`);
