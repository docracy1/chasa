#!/usr/bin/env node
/**
 * Generates /guides/invoice-chasing/ — topical silo hub linking chase landers, templates, blog, app.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chrome, escapeHtml } from "./lib/chrome.mjs";
import {
  HUB_BLOG_SLUGS,
  HUB_FAQ,
  HUB_MAIN,
  HUB_META,
  HUB_STYLE,
} from "./lib/invoice-chasing-hub-data.mjs";
import { SITE_URL } from "./data/seo-config.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "../public");
const blogPostsPath = join(__dirname, "data/blog-posts.json");

function faqHtml(faq) {
  return faq
    .map(
      (item) =>
        `<details class="faq-item"><summary>${escapeHtml(item.q)}</summary>\n<p>${escapeHtml(item.a)}</p>\n</details>`
    )
    .join("\n");
}

function blogLinksHtml() {
  const posts = JSON.parse(readFileSync(blogPostsPath, "utf8"));
  const bySlug = new Map(posts.map((p) => [p.slug, p]));
  return HUB_BLOG_SLUGS.map((slug) => {
    const post = bySlug.get(slug);
    if (!post) return "";
    return `<a href="/blog/${slug}/"><strong>${escapeHtml(post.title)}</strong><span>${escapeHtml(post.description)}</span></a>`;
  })
    .filter(Boolean)
    .join("\n      ");
}

function buildJsonLd(faq) {
  const items = [
    { name: "Invoice follow-up", url: `${SITE_URL}/invoice-follow-up` },
    { name: "Chase invoices", url: `${SITE_URL}/chase-invoices` },
    { name: "Payment reminders", url: `${SITE_URL}/payment-reminder` },
    { name: "Free templates", url: `${SITE_URL}/free-templates/` },
    { name: "Overdue invoices guide", url: `${SITE_URL}/overdue-invoices-guide` },
    { name: "Try the app", url: `${SITE_URL}/app/` },
  ];
  return JSON.stringify(
    {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
            { "@type": "ListItem", position: 2, name: HUB_META.breadcrumb, item: `${SITE_URL}/guides/invoice-chasing/` },
          ],
        },
        {
          "@type": "CollectionPage",
          name: "Invoice chasing hub",
          description: HUB_META.description,
          url: `${SITE_URL}/guides/invoice-chasing/`,
          mainEntity: {
            "@type": "ItemList",
            itemListElement: items.map((item, i) => ({
              "@type": "ListItem",
              position: i + 1,
              name: item.name,
              url: item.url,
            })),
          },
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

const mainHtml = HUB_MAIN.replace("{{FAQ}}", faqHtml(HUB_FAQ)).replace("{{BLOG_LINKS}}", blogLinksHtml());

const outDir = join(publicDir, "guides/invoice-chasing");
mkdirSync(outDir, { recursive: true });

const html = chrome({
  title: HUB_META.title,
  description: HUB_META.description,
  canonical: "/guides/invoice-chasing/",
  mainHtml: `<p class="crumb"><a href="/">Home</a> / Guides / Invoice chasing</p>\n${mainHtml}`,
  jsonLd: buildJsonLd(HUB_FAQ),
  depth: 2,
  extraHead: HUB_STYLE,
});

writeFileSync(join(outDir, "index.html"), html, "utf8");
console.log("Generated guides/invoice-chasing/index.html");
