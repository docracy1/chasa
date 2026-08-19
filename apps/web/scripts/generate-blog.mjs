#!/usr/bin/env node
/**
 * Generates blog/index.html and blog/{slug}/index.html from the API,
 * merged with local posts in data/blog-posts.json (and optional HTML bodies).
 * Run: node apps/web/scripts/generate-blog.mjs
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chrome, escapeHtml } from "./lib/chrome.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "../public");
const fallbackPath = join(__dirname, "data/blog-posts.json");
const bodiesDir = join(__dirname, "data/blog-bodies");
const API_BASE = "https://api.chasa.io";

function extractMain(html) {
  const match = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  return match ? match[1].trim() : null;
}

function slugifyHeading(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Structured parser for weekly-cron / admin-authored plain-text bodies: blank-line paragraphs,
 *  "##"/"###" headings, "- " lists, plus a table of contents for 3+ H2 sections. Mirrors
 *  blog-post.js's client-side renderer so a rebuild bakes the same structure statically instead
 *  of falling back to one flat wall of paragraphs. */
function structuredBodyToHtml(body) {
  const lines = String(body || "").replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  let para = [];
  let listItems = null;

  const flushPara = () => {
    const text = para.join(" ").trim();
    if (text) blocks.push({ type: "p", text });
    para = [];
  };
  const flushList = () => {
    if (listItems && listItems.length) blocks.push({ type: "list", items: listItems });
    listItems = null;
  };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, "");
    const trimmed = line.trim();
    if (!trimmed) {
      flushPara();
      flushList();
      continue;
    }
    if (trimmed.startsWith("## ")) {
      flushPara();
      flushList();
      blocks.push({ type: "h2", text: trimmed.slice(3).trim() });
      continue;
    }
    if (trimmed.startsWith("### ")) {
      flushPara();
      flushList();
      blocks.push({ type: "h3", text: trimmed.slice(4).trim() });
      continue;
    }
    if (/^[-*]\s+/.test(trimmed)) {
      flushPara();
      if (!listItems) listItems = [];
      listItems.push(trimmed.replace(/^[-*]\s+/, "").trim());
      continue;
    }
    flushList();
    para.push(trimmed);
  }
  flushPara();
  flushList();

  const toc = blocks.filter((b) => b.type === "h2");
  let html = "";
  if (toc.length >= 3) {
    html += `<nav class="blog-toc" aria-label="Table of contents"><div class="blog-toc-title">Table of contents</div><ol>${toc
      .map((item) => `<li><a href="#${slugifyHeading(item.text)}">${escapeHtml(item.text)}</a></li>`)
      .join("")}</ol></nav>`;
  }
  html += '<div class="blog-body">';
  for (const block of blocks) {
    if (block.type === "list") {
      html += `<ul>${block.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
    } else if (block.type === "h2") {
      html += `<h2 id="${slugifyHeading(block.text)}">${escapeHtml(block.text)}</h2>`;
    } else if (block.type === "h3") {
      html += `<h3>${escapeHtml(block.text)}</h3>`;
    } else {
      html += `<p>${escapeHtml(block.text)}</p>`;
    }
  }
  html += "</div>";
  return html;
}

function readFallbackPosts() {
  return JSON.parse(readFileSync(fallbackPath, "utf8"));
}

/** Prefer API posts, then add any local-only slugs (so SEO drafts ship without D1). */
function mergePosts(apiPosts, localPosts) {
  const bySlug = new Map();
  for (const p of apiPosts) bySlug.set(p.slug, p);
  for (const p of localPosts) {
    if (!bySlug.has(p.slug)) bySlug.set(p.slug, p);
  }
  return [...bySlug.values()].sort((a, b) =>
    String(b.publishedAt || "").localeCompare(String(a.publishedAt || ""))
  );
}

async function fetchPosts() {
  const local = readFallbackPosts();
  try {
    const res = await fetch(`${API_BASE}/api/blog/posts`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const posts = data.posts ?? [];
    if (posts.length === 0) {
      console.warn(`API returned no posts, using ${fallbackPath}`);
      return local;
    }
    return mergePosts(posts, local);
  } catch (e) {
    console.warn(`API fetch failed (${e.message}), using ${fallbackPath}`);
    return local;
  }
}

async function fetchPostBody(slug) {
  try {
    const res = await fetch(`${API_BASE}/api/blog/posts/${encodeURIComponent(slug)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.post?.body ?? null;
  } catch {
    return null;
  }
}

function localBodyFile(slug) {
  const path = join(bodiesDir, `${slug}.html`);
  if (!existsSync(path)) return null;
  return readFileSync(path, "utf8").trim();
}

function extractBodyFromMain(mainHtml) {
  let html = mainHtml;
  html = html.replace(/^<p><a href="[^"]*">← Blog<\/a><\/p>\s*/i, "");
  html = html.replace(/^<h1>[\s\S]*?<\/h1>\s*/i, "");
  html = html.replace(/^<p class="lede">[\s\S]*?<\/p>\s*/i, "");
  html = html.replace(/<section[\s\S]*$/i, "");
  return html.trim();
}

function postMainFromExisting(slug) {
  const path = join(publicDir, "blog", slug, "index.html");
  if (!existsSync(path)) return null;
  const main = extractMain(readFileSync(path, "utf8"));
  return main ? extractBodyFromMain(main) : null;
}

const NEW_BADGE_DAYS = 14;

function isRecent(publishedAt) {
  if (!publishedAt) return false;
  const days = (Date.now() - new Date(publishedAt).getTime()) / 86_400_000;
  return days >= 0 && days <= NEW_BADGE_DAYS;
}

function buildIndexMain(posts) {
  const articles = posts
    .map((p) => {
      const category = p.category || "Guide";
      const badge = isRecent(p.publishedAt) ? `<span class="blog-card-badge"><i></i>New</span>` : "";
      return `<article class="blog-card">
      <div class="blog-card-top">
        <span class="blog-card-tag">${escapeHtml(category)}</span>
        ${badge}
      </div>
      <h2><a href="/blog/${escapeHtml(p.slug)}/">${escapeHtml(p.title)}</a></h2>
      <p>${escapeHtml(p.description || "")}</p>
      <a class="blog-read-btn" href="/blog/${escapeHtml(p.slug)}/">Read article</a>
    </article>`;
    })
    .join("\n    ");

  return `<section class="blog-hero">
    <h1>Practical guides for<br>getting paid faster.</h1>
    <p class="lede">Short, high-signal articles about invoice follow-ups, tone, and cash flow — written for freelancers and small teams who chase payment themselves.</p>
  </section>
  <div class="blog-layout">
    <div class="blog-posts">
      ${articles}
    </div>
    <aside class="blog-sidebar-cta">
      <span class="blog-sidebar-eyebrow">Quick help</span>
      <h3>Not sure how to word your next chase?</h3>
      <p>Paste your invoice details and get a tone-matched follow-up draft in seconds — free, no signup.</p>
      <a class="blog-sidebar-btn blog-sidebar-btn-primary" href="/app/">Try Chasa free</a>
      <a class="blog-sidebar-btn blog-sidebar-btn-secondary" href="/free-templates/">Browse free templates</a>
      <p class="blog-sidebar-tip">Tip: stay friendly under 7 days late, get firmer past 30, and always leave the door open for a reply.</p>
    </aside>
  </div>`;
}

function renderBody(body) {
  if (!body) return "";
  if (/<[a-z][\s\S]*>/i.test(body)) return body;
  return structuredBodyToHtml(body);
}

function buildPostMain(post, body, depth = 2) {
  const prefix = "../".repeat(depth);
  const href = (p) => `${prefix}${p.replace(/^\//, "")}`;
  const script =
    post.slug === "invoice-chase-software-comparison"
      ? `\n<script src="${href("/price-compare.js")}" defer></script>`
      : "";
  return `<p><a href="${href("/blog/")}">← Blog</a></p>
  <h1>${escapeHtml(post.title)}</h1>
  ${post.description ? `<p class="lede">${escapeHtml(post.description)}</p>` : ""}
  ${renderBody(body)}
  <section style="margin-top:40px;padding-top:24px;border-top:1px solid var(--line)">
    <aside class="tpl-pack-strip" aria-label="Download the full PDF pack">
      <p class="tpl-pack-strip-copy">Get your polite invoice templates PDF to chase clients with confidence</p>
      <a class="tpl-pack-strip-btn" href="${href("/free-templates/download")}">Download</a>
    </aside>
    <h2>Related resources</h2>
    <ul>
      <li><a href="${href("/tools/late-payment-calculator")}">Late payment calculator</a></li>
      <li><a href="${href("/tools/chase-savings-calculator")}">Chase savings calculator</a></li>
      <li><a href="${href("/blog/invoice-chase-software-comparison/")}">Chasa vs Chaser, Paidnice &amp; other invoice chase tools</a></li>
      <li><a href="${href("/free-templates/")}">Free payment reminder email templates</a></li>
      <li><a href="${href("/app/")}">Try the AI invoice follow-up tool</a></li>
      <li><a href="${href("/payment-reminder")}">Payment reminder emails guide</a></li>
      <li><a href="${href("/overdue-invoice")}">Overdue invoice follow-up</a></li>
      <li><a href="${href("/invoice-follow-up")}">Invoice follow-up best practices</a></li>
    </ul>
  </section>${script}`;
}

const COMPARISON_FAQ = [
  {
    q: "Is Chasa a Chaser alternative?",
    a: "Yes for freelancers and small teams who want cheaper, draft-only follow-ups. Chaser targets SMB/mid-market AR with auto-send starting at a much higher price point.",
  },
  {
    q: "Does Chasa auto-send payment reminders?",
    a: "No. Chasa writes the email; you copy it into Gmail, Outlook, or Apple Mail (or open a mailto link). Clients always hear from you.",
  },
  {
    q: "How does Chasa pricing compare?",
    a: "Solo is $7/mo flat per workspace; Pro is $17/mo. Competitors often use revenue tiers, seat caps, or higher entry plans (Paidnice from $69/mo, Chaser Compact from $259/mo).",
  },
  {
    q: "Can Chasa replace Paidnice or Duefy?",
    a: "If you need full auto-send sequences and a hosted payment portal, those tools may fit better. If you want AI drafts, tone controls, and inbox-first sending at a lower price, Chasa is built for that.",
  },
];

const AR_POLICY_FAQ = [
  {
    q: "What should an accounts receivable policy include?",
    a: "At minimum: standard payment terms and exception approval, invoice validation rules, a simple credit-limit approach, client segmentation notes, a staged collections workflow with owners, a dispute pause procedure, and write-off approval thresholds.",
  },
  {
    q: "What is a soft credit threshold?",
    a: "The maximum open balance you allow without a formal credit review, as long as the client is verified, has no bad-debt history with you, and stays on short terms (typically Net 30 or less).",
  },
  {
    q: "When should I pause chasing for a dispute?",
    a: "As soon as the client raises a legitimate issue. Log it the same day, set a resolution window, and stop escalating tone until it is fixed or credited.",
  },
  {
    q: "Who should approve a write-off?",
    a: "Use amount tiers. Small balances can be your call; larger ones should need a second person. Keep chase history and a short memo on why recovery stopped.",
  },
];

function buildJsonLd(post) {
  const article = {
    "@type": "Article",
    headline: post.title,
    description: post.description || "",
    url: `https://chasa.io/blog/${post.slug}/`,
    datePublished: post.publishedAt || undefined,
    dateModified: post.publishedAt || undefined,
    author: { "@type": "Organization", name: "Chasa" },
    publisher: {
      "@type": "Organization",
      name: "RELACON GmbH",
      logo: { "@type": "ImageObject", url: "https://chasa.io/brand/chasa-icon.png" },
    },
    mainEntityOfPage: `https://chasa.io/blog/${post.slug}/`,
  };

  const faqBySlug = {
    "invoice-chase-software-comparison": COMPARISON_FAQ,
    "ar-policy-that-works-with-chasa": AR_POLICY_FAQ,
  };
  const faq = faqBySlug[post.slug];
  if (!faq) {
    return JSON.stringify({ "@context": "https://schema.org", ...article }, null, 2);
  }

  return JSON.stringify(
    {
      "@context": "https://schema.org",
      "@graph": [
        article,
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

const posts = await fetchPosts();

const blogIndexJsonLd = JSON.stringify(
  {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: "Chasa Blog",
    url: "https://chasa.io/blog/",
    description:
      "Practical guides on invoice follow-ups, payment reminder emails, and AR policy for freelancers and small teams.",
    publisher: {
      "@type": "Organization",
      name: "RELACON GmbH",
      logo: { "@type": "ImageObject", url: "https://chasa.io/brand/chasa-icon.png" },
    },
    blogPost: posts.map((p) => ({
      "@type": "BlogPosting",
      headline: p.title,
      description: p.description || "",
      url: `https://chasa.io/blog/${p.slug}/`,
      datePublished: p.publishedAt || undefined,
    })),
  },
  null,
  2
);

const indexHtml = chrome({
  title: "Invoice Chasing & Payment Reminder Guides | Chasa Blog",
  description:
    "Practical guides on chasing overdue invoices, writing payment reminder emails, and building an AR policy for freelancers and small teams.",
  canonical: "/blog/",
  activeNav: "blog",
  mainHtml: buildIndexMain(posts),
  jsonLd: blogIndexJsonLd,
  depth: 1,
});
writeFileSync(join(publicDir, "blog/index.html"), indexHtml, "utf8");
console.log("Generated blog/index.html");

for (const post of posts) {
  // Prefer local SEO HTML bodies over API text when present.
  let body = localBodyFile(post.slug);
  if (!body) body = await fetchPostBody(post.slug);
  if (!body) body = postMainFromExisting(post.slug) ?? "";

  const slugDir = join(publicDir, "blog", post.slug);
  mkdirSync(slugDir, { recursive: true });

  const title =
    post.slug === "invoice-chase-software-comparison"
      ? `${post.title} (2026) — Chasa`
      : `${post.title} — Chasa`;

  const postHtml = chrome({
    title,
    description: post.description || post.title,
    canonical: `/blog/${post.slug}/`,
    activeNav: "blog",
    mainHtml: buildPostMain(post, body),
    jsonLd: buildJsonLd(post),
    depth: 2,
  });
  writeFileSync(join(slugDir, "index.html"), postHtml, "utf8");
  console.log(`Generated blog/${post.slug}/index.html`);
}

console.log(`Done — ${posts.length} blog posts.`);
