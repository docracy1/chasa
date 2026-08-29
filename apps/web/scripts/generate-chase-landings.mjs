#!/usr/bin/env node
/**
 * Generates SEO chase landing pages with FAQPage JSON-LD.
 * Run after generate-marketing.mjs (these pages are excluded from that manifest).
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chrome, escapeHtml } from "./lib/chrome.mjs";
import { CHASE_LANDINGS } from "./lib/chase-landings-data.mjs";
import { SITE_URL } from "./data/seo-config.mjs";

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
            { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
            { "@type": "ListItem", position: 2, name, item: `${SITE_URL}/${slug}` },
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

for (const page of CHASE_LANDINGS) {
  const mainHtml = page.main.replace("{{FAQ}}", faqHtml(page.faq));
  const html = chrome({
    title: page.title,
    description: page.description,
    canonical: `/${page.slug}`,
    mainHtml: `<p class="crumb"><a href="/">Home</a> / ${escapeHtml(page.breadcrumb)}</p>\n${mainHtml}`,
    jsonLd: buildJsonLd(page.slug, page.breadcrumb, page.faq),
    depth: 0,
  });
  writeFileSync(join(publicDir, `${page.slug}.html`), html, "utf8");
  console.log(`Generated ${page.slug}.html`);
}

console.log(`Done — ${CHASE_LANDINGS.length} chase landing pages.`);
