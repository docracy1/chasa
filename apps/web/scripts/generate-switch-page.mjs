#!/usr/bin/env node
/**
 * Generates /switch-to-chasa — a migration guide for someone leaving another invoice-chasing
 * tool (Chaser, Paidnice, Duefy, Satago, ChaseAI, or a spreadsheet) for docstoc. Complements the
 * per-competitor "docstoc vs X" pages (generate-vs-pages.mjs) with the practical "how do I actually
 * move" page those don't cover.
 * Run: node apps/web/scripts/generate-switch-page.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chrome, escapeHtml } from "./lib/chrome.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "../public");

const FAQ = [
  {
    q: "Will I lose my chase history when I switch?",
    a: "docstoc doesn't import another tool's send history — you're starting a fresh chase log in docstoc from the day you switch. Your invoice and client data (amounts, due dates, contact names) is what carries over via CSV or QuickBooks/Xero sync.",
  },
  {
    q: "Do I need to cancel my old subscription myself?",
    a: "Yes — docstoc can't cancel another company's subscription for you. Export your data first, confirm it imported correctly in docstoc, then cancel the old plan from that provider's own billing settings.",
  },
  {
    q: "What if my invoices are already in QuickBooks or Xero?",
    a: "Skip the CSV step entirely — connect QuickBooks Online or Xero natively from Connector (Solo plan and up) and docstoc imports overdue invoices directly via OAuth.",
  },
  {
    q: "What if my old tool doesn't let me export data?",
    a: "You can still start clean: add clients and open invoices to docstoc manually, or paste the details straight into a chase draft — no import required to use the free tier.",
  },
];

const STEPS = [
  {
    title: "Export your client and invoice list",
    body: "Most invoice-chasing tools let you export clients and open invoices as a CSV from their Settings, Reports, or Export/Data page. Look for an option to include client name, email, invoice amount, and due date — that's all docstoc needs.",
  },
  {
    title: "Import into docstoc",
    body: 'Upload that CSV in the Tool (headers are mapped automatically for QuickBooks, FreshBooks, Xero, Wave, Zoho, and sevDesk exports) — or skip this step and connect QuickBooks Online / Xero natively from <a href="/app/connector">Connector</a> for direct OAuth sync.',
  },
  {
    title: "Confirm everything landed correctly",
    body: "Check the aging view for the right clients, amounts, and due dates before you rely on it — a quick scan takes a minute and avoids chasing the wrong balance.",
  },
  {
    title: "Cancel your old plan",
    body: "Once docstoc has what it needs, cancel the subscription with your previous provider from their own billing page — docstoc can't do this on your behalf.",
  },
];

function buildJsonLd() {
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
              name: "Switch to docstoc",
              item: "https://chasa.io/switch-to-chasa",
            },
          ],
        },
        {
          "@type": "HowTo",
          name: "How to switch to docstoc from another invoice-chasing tool",
          step: STEPS.map((s) => ({ "@type": "HowToStep", name: s.title, text: s.body.replace(/<[^>]+>/g, "") })),
        },
        {
          "@type": "FAQPage",
          mainEntity: FAQ.map((item) => ({
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

function buildMain() {
  const stepsHtml = STEPS.map(
    (s, i) => `      <li>
        <strong>${escapeHtml(s.title)}</strong>
        <p>${s.body}</p>
      </li>`
  ).join("\n");

  const faqHtml = FAQ.map(
    (item) =>
      `<details class="faq-item"><summary>${escapeHtml(item.q)}</summary>\n<p>${escapeHtml(item.a)}</p>\n</details>`
  ).join("\n");

  const otherTools = ["Chaser", "Paidnice", "Duefy", "Satago", "ChaseAI", "a spreadsheet"];
  const toolLinks = otherTools
    .slice(0, 5)
    .map((name) => {
      const slug = name.toLowerCase();
      return `<a href="/docstoc-vs-${slug}">${escapeHtml(name)}</a>`;
    })
    .join(", ");

  return `<p class="crumb"><a href="/">Home</a> / Switch to docstoc</p>
<h1>Switching to docstoc — a practical migration guide</h1>
  <p class="lede">
    Moving from ${toolLinks}, or just a spreadsheet? Here's how to bring your clients and open
    invoices into docstoc without losing track of anything mid-switch.
  </p>

  <h2>Four steps</h2>
  <ol class="switch-steps">
${stepsHtml}
  </ol>

  <p style="margin-top:28px"><a href="/app/" class="nav-cta">Try docstoc free</a></p>

  <h2>FAQ</h2>
  ${faqHtml}`;
}

mkdirSync(publicDir, { recursive: true });

const html = chrome({
  title: "Switch to docstoc — Migration Guide from Chaser, Paidnice, Duefy & More | docstoc",
  description:
    "Moving from another invoice-chasing tool or a spreadsheet? Step-by-step guide to exporting your clients and invoices, importing into docstoc, and cancelling your old plan.",
  canonical: "/switch-to-chasa",
  activeNav: "",
  mainHtml: buildMain(),
  jsonLd: buildJsonLd(),
  depth: 0,
});

writeFileSync(join(publicDir, "switch-to-chasa.html"), html, "utf8");
console.log("Generated switch-to-chasa.html");
