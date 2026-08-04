#!/usr/bin/env node
/**
 * Generates one dedicated "Chasa vs {Competitor}" SEO landing page per competitor, so each can
 * rank for its own "chasa vs X" / "X alternative" search query instead of sharing a section on
 * the single big /blog/invoice-chase-software-comparison/ post. Figures below are the same
 * vetted numbers already published on that post — not re-derived, just reused per-competitor.
 * Run: node apps/web/scripts/generate-vs-pages.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chrome, escapeHtml } from "./lib/chrome.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "../public");

/** @type {Array<{
 *  slug: string; name: string; pricingUrl: string; bestFit: string; entryPrice: string;
 *  pricingModel: string; autoSend: string; ownInbox: string; aiDrafts: string; toneAdjust: string;
 *  tracking: string; qboXero: string; sms: string; paymentPortal: string; freeTier: string;
 *  summary: string; faq: Array<{q: string; a: string}>;
 * }>} */
const COMPETITORS = [
  {
    slug: "chaser",
    name: "Chaser",
    pricingUrl: "https://www.chaserhq.com/chaser-pricing",
    bestFit: "SMB / mid-market AR",
    entryPrice: "From $259/mo",
    pricingModel: "Revenue tier + user caps",
    autoSend: "✓ auto-sends",
    ownInbox: "Optional / own-domain",
    aiDrafts: "Yes (AI assist)",
    toneAdjust: "Edit templates",
    tracking: "✓",
    qboXero: "✓",
    sms: "✓",
    paymentPortal: "✓",
    freeTier: "Trial",
    summary:
      "Chaser targets mid-market accounts-receivable teams with auto-send sequences, credit reporting, and a hosted payment portal — priced in revenue tiers starting around $259/mo. Chasa is built for the freelancer/small-team end of the market: a flat $7/mo, and every message stays a draft you send yourself instead of an automated collections domain emailing your clients.",
    faq: [
      {
        q: "Is Chasa a Chaser alternative?",
        a: "Yes for freelancers and small teams who want cheaper, draft-only follow-ups. Chaser targets SMB/mid-market AR with auto-send starting at a much higher price point.",
      },
      {
        q: "Does Chasa auto-send payment reminders like Chaser does?",
        a: "No. Chasa writes the email; you copy it into Gmail, Outlook, or Apple Mail (or open a mailto link). Clients always hear from you, not an automated system.",
      },
      {
        q: "How much cheaper is Chasa than Chaser?",
        a: "Chasa Solo is a flat $7/mo. Chaser's entry plan (Compact, up to 4 users) starts around $259/mo, and larger teams move to Chaser Core at roughly $779/mo — both revenue-tiered.",
      },
    ],
  },
  {
    slug: "paidnice",
    name: "Paidnice",
    pricingUrl: "https://www.paidnice.com/pricing",
    bestFit: "Xero / QuickBooks SMBs",
    entryPrice: "$69/mo",
    pricingModel: "Flat · seat cap on Essentials",
    autoSend: "✓ auto-sends",
    ownInbox: "Custom domain",
    aiDrafts: "Templates / rules",
    toneAdjust: "—",
    tracking: "✓",
    qboXero: "✓",
    sms: "✓",
    paymentPortal: "✓",
    freeTier: "Trial",
    summary:
      "Paidnice is Xero-native, adds UK late fees and statutory interest automatically, and starts at $69/mo flat with a seat cap on its entry plan. It's rule/template-based rather than AI-drafted, and it auto-sends. Chasa is $7/mo flat, writes an AI draft matched to how late each invoice is, and never sends anything without you reviewing it first.",
    faq: [
      {
        q: "Is Chasa a Paidnice alternative?",
        a: "If you want AI-written drafts and full control over what gets sent, yes. Paidnice is a strong fit if you specifically need automatic UK late fees and Xero-native automation — Chasa doesn't auto-charge late fees.",
      },
      {
        q: "Can Chasa replace Paidnice?",
        a: "If you need automatic UK statutory interest/late fees and full auto-send sequences, Paidnice may fit better. If you want AI drafts, tone controls, and inbox-first sending at a third of the price, Chasa is built for that.",
      },
      {
        q: "Does Chasa cost less than Paidnice?",
        a: "Yes — Chasa Solo is $7/mo flat. Paidnice starts at $69/mo for Essentials (up to 2 team members) or $99/mo for Pro (unlimited users).",
      },
    ],
  },
  {
    slug: "duefy",
    name: "Duefy",
    pricingUrl: "https://duefy.ai/",
    bestFit: "Solo & small teams",
    entryPrice: "$19/mo",
    pricingModel: "Plan tiers · Team +$/seat",
    autoSend: "✓ auto-sends",
    ownInbox: "Sends as you",
    aiDrafts: "✓",
    toneAdjust: "Tone escalation",
    tracking: "—",
    qboXero: "Integrations on paid",
    sms: "Pro+",
    paymentPortal: "✓",
    freeTier: "14-day trial",
    summary:
      "Duefy is the closest competitor in spirit — AI-written, tone-escalating reminders for solo operators and small teams — but it auto-sends on your behalf and starts at $19/mo (Solo), rising to $49/mo (Pro) or a per-seat Team plan. Chasa is $7/mo flat, keeps every send manual, and doesn't add per-seat charges until Enterprise.",
    faq: [
      {
        q: "Is Chasa a Duefy alternative?",
        a: "Yes, if the one thing you want to change is auto-send — Duefy sends chase emails automatically once scheduled; Chasa always leaves the send action to you, at roughly a third of Duefy Solo's price.",
      },
      {
        q: "How does Chasa pricing compare to Duefy?",
        a: "Chasa Solo is $7/mo flat. Duefy Solo is $19/mo, Duefy Pro is $49/mo, and Duefy Team starts at $99/mo plus $10 per extra seat past five.",
      },
      {
        q: "Does Duefy have tone escalation like Chasa?",
        a: "Both escalate tone as an invoice ages. Chasa's tone adjustment (soften/firm up/shorten) is a manual, per-draft control on paid plans; Duefy escalates automatically as part of its send schedule.",
      },
    ],
  },
  {
    slug: "satago",
    name: "Satago",
    pricingUrl: "https://www.satago.com/pricing/",
    bestFit: "UK credit control",
    entryPrice: "£45/mo (~$58)",
    pricingModel: "Flat plan tiers",
    autoSend: "✓ auto-sends",
    ownInbox: "Own email on Premium+",
    aiDrafts: "Templates",
    toneAdjust: "—",
    tracking: "—",
    qboXero: "✓",
    sms: "Premium+",
    paymentPortal: "Cards / BNPL",
    freeTier: "Trial",
    summary:
      "Satago adds Experian credit risk scoring and UK invoice finance on top of chasing — a genuinely different product aimed at UK credit control, not just reminder emails. It starts around £45/mo (~$58) and auto-sends from template rules. Chasa doesn't do credit checks or invoice finance; it's a $7/mo, AI-drafted, draft-only alternative for freelancers who just need the wording done.",
    faq: [
      {
        q: "Is Chasa a Satago alternative?",
        a: "For chasing specifically, yes — at a much lower price and without auto-send. If you need Experian credit checks or invoice finance, Satago covers ground Chasa doesn't touch at all.",
      },
      {
        q: "How much does Satago cost compared to Chasa?",
        a: "Satago Basic is about £45/mo (~$58), Satago Premium about £80/mo (~$102). Chasa Solo is $7/mo flat.",
      },
      {
        q: "Does Chasa offer invoice finance like Satago?",
        a: "No. Chasa focuses only on drafting payment follow-up emails — it doesn't offer credit scoring, invoice finance, or a payment portal.",
      },
    ],
  },
  {
    slug: "chaseai",
    name: "ChaseAI",
    pricingUrl: "https://chaseai.app/pricing",
    bestFit: "Freelancers (auto-send)",
    entryPrice: "$9/mo",
    pricingModel: "Flat workspace",
    autoSend: "✓ auto-sends",
    ownInbox: "Sends as you",
    aiDrafts: "✓",
    toneAdjust: "Tone options",
    tracking: "—",
    qboXero: "✗ PDF / manual",
    sms: "✗",
    paymentPortal: "✗",
    freeTier: "Free plan",
    summary:
      "ChaseAI is the nearest in price to Chasa ($9/mo vs $7/mo) and also targets freelancers, but it auto-sends the AI draft on a schedule rather than handing it back to you first, and it has no native QuickBooks/Xero sync (PDF/manual import only). Chasa keeps every message draft-only and adds Solo+ OAuth sync to QuickBooks Online and Xero.",
    faq: [
      {
        q: "Is Chasa a ChaseAI alternative?",
        a: "Yes — both are built for freelancers and priced close together, but ChaseAI auto-sends while Chasa always leaves the send action to you, and Chasa adds native QuickBooks/Xero sync that ChaseAI doesn't have.",
      },
      {
        q: "Which is cheaper, Chasa or ChaseAI?",
        a: "ChaseAI Starter is $9/mo (Pro $19/mo). Chasa Solo is $7/mo flat (Pro $17/mo) — slightly cheaper at every tier, with Chasa's tier also including native accounting sync.",
      },
      {
        q: "Does ChaseAI connect to QuickBooks or Xero?",
        a: "Not natively — ChaseAI relies on PDF or manual invoice import. Chasa has native OAuth sync to QuickBooks Online and Xero from Solo up.",
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
            { "@type": "ListItem", position: 1, name: "Home", item: "https://chasa.io/" },
            {
              "@type": "ListItem",
              position: 2,
              name: `Chasa vs ${c.name}`,
              item: `https://chasa.io/chasa-vs-${c.slug}`,
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
  const title = `Chasa vs ${c.name}`;
  const rows = [
    ["Best fit", "Freelancers & small teams", c.bestFit],
    ["Entry paid price", "$7/mo Solo", c.entryPrice],
    ["Pricing model", "Flat workspace", c.pricingModel],
    ["Auto-sends chase emails", "✗ draft only", c.autoSend],
    ["You send from your inbox", "✓", c.ownInbox],
    ["AI-written drafts", "✓", c.aiDrafts],
    ["Soften / firm / shorten", "✓ paid", c.toneAdjust],
    ["Open / click tracking", "✓ Solo+ tracked HTML", c.tracking],
    ["Native QuickBooks / Xero sync", "✓ Solo+ OAuth", c.qboXero],
    ["SMS reminders", "✓ Solo+ drafts only", c.sms],
    ["Client payment portal", "✗ your pay link in drafts", c.paymentPortal],
    ["Free tier", "18 templates + 5 AI drafts", c.freeTier],
  ];

  const tableRows = rows
    .map(
      ([label, chasaVal, otherVal]) =>
        `          <tr>
            <td>${escapeHtml(label)}</td>
            <td class="col-chasa">${chasaVal}</td>
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
<h1>${escapeHtml(title)} — which invoice chase tool fits?</h1>
  <p class="lede">${c.summary}</p>

  <h2>Chasa vs ${escapeHtml(c.name)} at a glance</h2>
  <div class="compare-table-wrap">
    <table class="compare-table">
      <thead>
        <tr>
          <th scope="col"></th>
          <th scope="col" class="col-chasa">Chasa</th>
          <th scope="col">${escapeHtml(c.name)}</th>
        </tr>
      </thead>
      <tbody>
${tableRows}
      </tbody>
    </table>
  </div>
  <p class="pc-note">Figures are the same published-price comparison as <a href="/blog/invoice-chase-software-comparison/">the full Chasa vs Chaser, Paidnice, Duefy, Satago &amp; ChaseAI comparison</a> — check <a href="${c.pricingUrl}" target="_blank" rel="noopener noreferrer">${escapeHtml(c.name)}'s pricing page</a> directly before you buy, as plans change.</p>

  <p style="margin-top:28px"><a href="/app/" class="nav-cta">Try Chasa free</a></p>

  <h2>FAQ</h2>
  ${faqHtml}`;
}

mkdirSync(publicDir, { recursive: true });

for (const c of COMPETITORS) {
  const slug = `chasa-vs-${c.slug}`;
  const title = `Chasa vs ${c.name} — Which Invoice Chase Tool Fits? | Chasa`;
  const description = `Chasa vs ${c.name}: price, auto-send vs draft-only, AI drafts, and tracking compared side by side — pick the right invoice chase tool for a freelancer or small team.`;

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

console.log(`Done — ${COMPETITORS.length} vs-competitor pages.`);
