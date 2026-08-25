#!/usr/bin/env node
/**
 * Generates 4 long-tail SEO landing pages that target specific search phrases without
 * duplicating the existing broad landings (/payment-reminder, /overdue-invoice,
 * /invoice-follow-up, /freelancer-invoice-follow-up) or the single-template pages under
 * /free-templates/. Each page below is a how-to/guide angle that funnels into the matching
 * existing template page rather than re-publishing its copy-paste text.
 * Run: node apps/web/scripts/generate-seo-capture-pages.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chrome, escapeHtml } from "./lib/chrome.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "../public");

function faqHtml(faq) {
  return faq
    .map(
      (item) =>
        `<details class="faq-item"><summary>${escapeHtml(item.q)}</summary>\n<p>${escapeHtml(item.a)}</p>\n</details>`
    )
    .join("\n");
}

function buildJsonLd(slug, name, faq) {
  return JSON.stringify(
    {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: "https://chasa.io/" },
            { "@type": "ListItem", position: 2, name, item: `https://chasa.io/${slug}` },
          ],
        },
        {
          "@type": "FAQPage",
          mainEntity: faq.map((item) => ({
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

const FAQ_TEMPLATES = [
  {
    q: "Are these unpaid invoice follow-up templates really free?",
    a: "Yes — every template linked above is free to copy and use, with no account required. AI tone adjustments (soften, firm up, shorten) are available on Pro ($14.99/mo) and Business.",
  },
  {
    q: "Can I edit these templates for my own business?",
    a: "Yes. They're plain text with bracketed placeholders — swap in your invoice number, amount, due date, and payment link.",
  },
  {
    q: "What if a client doesn't respond to any of these?",
    a: "Move to the next stage in the sequence. If a formal notice at 30 or 60 days gets no response, the final notice template sets a hard deadline before you consider collections.",
  },
];

const FAQ_POLITE = [
  {
    q: "Is it rude to send a payment reminder?",
    a: "No — a short, factual reminder is standard business practice, not an imposition. Clients generally expect it once an invoice is due or overdue.",
  },
  {
    q: "How many polite reminders should I send before getting firmer?",
    a: "Most freelancers send one before the due date and one to two after, gently, in the first 1–7 days overdue. Past 30 days, shift to a formal notice.",
  },
  {
    q: "Should I mention late fees in a polite reminder?",
    a: "Usually not in the first one or two. Save late-fee or consequence language for the formal 30-day notice stage, so early reminders stay low-pressure.",
  },
];

const FAQ_30DAY = [
  {
    q: "Can I charge a late fee at 30 days overdue?",
    a: "Only if your original contract or invoice terms specified one. Don't introduce a new fee retroactively — mention it in the notice only if it was already agreed.",
  },
  {
    q: "Should I involve a collections agency at 30 days?",
    a: "Not yet. Thirty days is the stage for a firm, formal notice — collections is usually reserved for 60–90+ days after further notices go unanswered.",
  },
  {
    q: "How is a 30-day notice different from earlier reminders?",
    a: "Earlier reminders are conversational and assume an oversight. A 30-day notice states the facts plainly, sets a hard new deadline, and is written to be kept on file.",
  },
];

const FAQ_TOOL = [
  {
    q: "Does the tool auto-send reminder emails?",
    a: "No. docstoc only drafts the email — you review it and send it yourself from your own inbox. Nothing goes out automatically.",
  },
  {
    q: "Do I need to connect my accounting software?",
    a: "No. You can paste invoice details manually or upload a CSV. QuickBooks and Xero sync are available as an optional add-on from Pro up.",
  },
  {
    q: "Is there a free plan for freelancers?",
    a: "Yes — 5 AI drafts per month and all 18 templates are free, with no account required to try it.",
  },
];

const PAGES = [
  {
    slug: "unpaid-invoice-follow-up-templates",
    title: "Unpaid Invoice Follow-Up Templates — 12 Free Copy-Paste Emails | docstoc",
    description:
      "12 free unpaid invoice follow-up templates for every stage — before due, gentle overdue, formal notice, final warning. Copy, paste, or let docstoc write it for you.",
    breadcrumb: "Unpaid invoice follow-up templates",
    faq: FAQ_TEMPLATES,
    main: `<h1>Unpaid invoice follow-up templates for every stage of late payment</h1>
  <p class="lede">The right template depends on how late the invoice is. Below is a template for each stage, from a friendly pre-due nudge to a final notice before collections — all free, no account required.</p>

  <h3>Pick the template for how late the invoice is</h3>
  <ul>
    <li><a href="/free-templates/payment-reminder-before-due-date">Payment reminder — 7 days before due</a></li>
    <li><a href="/free-templates/invoice-due-today-reminder">Invoice due today</a></li>
    <li><a href="/free-templates/gentle-overdue-invoice-reminder">Gentle first reminder — 1–3 days overdue</a></li>
    <li><a href="/free-templates/overdue-invoice-reminder-7-days">Second reminder — 7 days overdue</a></li>
    <li><a href="/free-templates/payment-plan-offer-overdue-invoice">Payment plan offer — 14 days overdue</a></li>
    <li><a href="/free-templates/formal-overdue-notice-30-days">Formal notice — 30 days overdue</a></li>
    <li><a href="/free-templates/second-formal-notice-60-days">Second formal notice — 60 days overdue</a></li>
    <li><a href="/free-templates/final-notice-before-collections">Final notice before collections</a></li>
  </ul>

  <h3>What makes a follow-up template actually work</h3>
  <p>Every template above keeps three things constant: the invoice number and amount stated plainly, one clear next step (pay by a specific date, or reply with a status), and a tone that matches how late the payment is. Copy one as-is, or open it on Pro/Business to soften, firm up, or shorten it for your exact invoice.</p>

  <h3>When a template isn't enough</h3>
  <p>If you're chasing more than a couple of invoices, rewriting placeholders by hand gets old fast. docstoc lets you paste invoice details or upload a CSV from QuickBooks, Xero, or FreshBooks, and drafts the follow-up for you — matched to days overdue, ready to copy into your own inbox.</p>

  <p style="margin-top:28px"><a href="/app/" class="nav-cta">Try free — 5 AI drafts</a></p>

  <h3>FAQ</h3>
  ${faqHtml(FAQ_TEMPLATES)}

  <h3>Related resources</h3>
  <ul>
    <li><a href="/free-templates/">All 18 free email templates</a></li>
    <li><a href="/invoice-follow-up">Invoice follow-up emails overview</a></li>
    <li><a href="/payment-reminder">Payment reminder emails</a></li>
    <li><a href="/overdue-invoice">Overdue invoice follow-up</a></li>
    <li><a href="/tools/invoice-chase-calculator">Invoice chase calculator</a></li>
  </ul>`,
  },
  {
    slug: "polite-payment-reminder-email",
    title: "Polite Payment Reminder Email — How to Write One (Free Template) | docstoc",
    description:
      "A polite payment reminder email stays clear and specific without sounding passive or apologetic. See what to include, two example emails, and a free template.",
    breadcrumb: "Polite payment reminder email",
    faq: FAQ_POLITE,
    main: `<h1>How to write a polite payment reminder email</h1>
  <p class="lede">Polite doesn't mean vague. A good reminder is warm in tone but exact about what you need — the invoice number, the amount, and one clear next step.</p>

  <h3>What makes a reminder feel polite instead of passive-aggressive</h3>
  <p>Skip the over-apologizing ("sorry to bother you again") and the guilt-tripping. State the facts, ask once, and give an easy way to act — a pay link or a one-line reply. Politeness comes from tone and brevity, not from hedging.</p>

  <h3>Example: before the due date</h3>
  <p>"Quick note that invoice #1042 for $850 is due on the 14th — no action needed if it's already scheduled. Let me know if anything looks off." Use the <a href="/free-templates/payment-reminder-before-due-date">free before-due-date template</a> as a starting point.</p>

  <h3>Example: just after the due date</h3>
  <p>"Invoice #1042 was due on the 14th and I don't see payment yet — just flagging in case it slipped through. Happy to resend if useful." Try the <a href="/free-templates/gentle-overdue-invoice-reminder">gentle overdue reminder template</a> for the full version.</p>

  <h3>When to stop being "just polite"</h3>
  <p>One or two polite reminders is normal. If an invoice passes 30 days with no response, it's reasonable to move to a firmer, more formal tone — see our <a href="/30-day-overdue-invoice-email">30-day overdue invoice email</a> guide.</p>

  <p style="margin-top:28px"><a href="/app/" class="nav-cta">Draft a payment reminder</a></p>

  <h3>FAQ</h3>
  ${faqHtml(FAQ_POLITE)}

  <h3>Related resources</h3>
  <ul>
    <li><a href="/payment-reminder">Payment reminder emails overview</a></li>
    <li><a href="/free-templates/payment-reminder-before-due-date">Before-due-date template</a></li>
    <li><a href="/free-templates/gentle-overdue-invoice-reminder">Gentle overdue reminder template</a></li>
    <li><a href="/30-day-overdue-invoice-email">30-day overdue invoice email</a></li>
    <li><a href="/features/ai-tone">AI tone matching</a></li>
  </ul>`,
  },
  {
    slug: "30-day-overdue-invoice-email",
    title: "30-Day Overdue Invoice Email — Free Formal Notice Template | docstoc",
    description:
      "At 30 days overdue, your email needs a firmer, documented tone. What to include in a 30-day overdue invoice email, plus a free formal notice template.",
    breadcrumb: "30-day overdue invoice email",
    faq: FAQ_30DAY,
    main: `<h1>Writing a 30-day overdue invoice email</h1>
  <p class="lede">Thirty days is the point where a friendly nudge stops being enough. The email should stay professional, but it needs to read as a formal notice — not just another reminder.</p>

  <h3>Why 30 days is a turning point</h3>
  <p>By 30 days overdue, a client has had the invoice, at least one earlier reminder, and a full billing cycle to pay. The email you send now should be short, unambiguous, and worth keeping on record if the matter escalates.</p>

  <h3>What to include in a 30-day notice</h3>
  <ul>
    <li>The original invoice number, amount, and due date</li>
    <li>A plain statement that it is now 30 days overdue</li>
    <li>A firm new deadline for payment</li>
    <li>Any consequence that actually applies (late fee, pause on further work) — only if it's real</li>
    <li>Payment details or a pay link, so there's no reason to delay replying</li>
  </ul>

  <h3>Free 30-day overdue invoice email template</h3>
  <p>Use the <a href="/free-templates/formal-overdue-notice-30-days">formal 30-day notice template</a> for the full copy-paste version, or open it on Pro/Business to adjust tone for your exact client.</p>

  <h3>What if 30 days passes without a response?</h3>
  <p>Move to a <a href="/free-templates/second-formal-notice-60-days">second formal notice at 60 days</a>, and if that also goes unanswered, the <a href="/free-templates/final-notice-before-collections">final notice before collections</a> template sets the last deadline before you consider outside help.</p>

  <p style="margin-top:28px"><a href="/app/" class="nav-cta">Draft a 30-day notice</a></p>

  <h3>FAQ</h3>
  ${faqHtml(FAQ_30DAY)}

  <h3>Related resources</h3>
  <ul>
    <li><a href="/overdue-invoice">Overdue invoice follow-up overview</a></li>
    <li><a href="/free-templates/formal-overdue-notice-30-days">30-day formal notice template</a></li>
    <li><a href="/free-templates/final-notice-before-collections">Final notice before collections</a></li>
    <li><a href="/polite-payment-reminder-email">Polite payment reminder email</a></li>
    <li><a href="/tools/invoice-chase-calculator">Invoice chase calculator</a></li>
  </ul>`,
  },
  {
    slug: "freelancer-invoice-reminder-tool",
    title: "Invoice Reminder Tool for Freelancers — Free AI Drafts | docstoc",
    description:
      "docstoc is an invoice reminder tool built for freelancers — paste an unpaid invoice, get a tone-matched reminder email in seconds. Free tier, no signup, no auto-send.",
    breadcrumb: "Freelancer invoice reminder tool",
    faq: FAQ_TOOL,
    main: `<h1>An invoice reminder tool built for how freelancers actually invoice</h1>
  <p class="lede">No AR team, no CRM setup, no per-seat pricing — just a tool that turns an unpaid invoice into a reminder email you can send from your own inbox.</p>

  <h3>How the tool works</h3>
  <p>Paste the client name, amount, and due date — or upload a CSV export from QuickBooks, Xero, Wave, or FreshBooks. docstoc drafts a reminder matched to how late the invoice is: friendly at a few days overdue, firmer past 30. Copy it into Gmail, Outlook, or Apple Mail and send it yourself.</p>

  <h3>Built for freelancers, not enterprise AR teams</h3>
  <p>Nothing auto-sends. There's no per-seat pricing, no collections workflow, and no dashboard you need to learn before your first reminder goes out. It's built for the reality of solo work: you invoice from a few tools, and you don't have time to rewrite the same email every week.</p>

  <h3>What's included free</h3>
  <p>Five AI drafts per month, 18 copy-paste templates, CSV upload, and an aging board to see what's overdue at a glance. Pro ($14.99/mo) adds QuickBooks/Xero sync, tone adjustments, and unlimited drafts.</p>

  <p style="margin-top:28px"><a href="/app/" class="nav-cta">Try the tool free</a></p>

  <h3>FAQ</h3>
  ${faqHtml(FAQ_TOOL)}

  <h3>Related resources</h3>
  <ul>
    <li><a href="/freelancer-invoice-follow-up">Freelancer invoice follow-up guide</a></li>
    <li><a href="/industry/freelancers">docstoc for freelancers &amp; consultants</a></li>
    <li><a href="/features/">Features overview</a></li>
    <li><a href="/#pricing">Compare plans</a></li>
    <li><a href="/unpaid-invoice-follow-up-templates">Unpaid invoice follow-up templates</a></li>
  </ul>`,
  },
];

mkdirSync(publicDir, { recursive: true });

for (const p of PAGES) {
  const html = chrome({
    title: p.title,
    description: p.description,
    canonical: `/${p.slug}`,
    activeNav: "",
    mainHtml: `<p class="crumb"><a href="/">Home</a> / ${escapeHtml(p.breadcrumb)}</p>\n${p.main}`,
    jsonLd: buildJsonLd(p.slug, p.breadcrumb, p.faq),
    depth: 0,
  });

  writeFileSync(join(publicDir, `${p.slug}.html`), html, "utf8");
  console.log(`Generated ${p.slug}.html`);
}

console.log(`Done — ${PAGES.length} SEO capture pages.`);
