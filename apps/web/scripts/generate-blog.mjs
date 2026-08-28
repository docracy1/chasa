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
const API_BASE = "https://api.docstoc.io";

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
  const contentMatch = html.match(/<div class="blog-article-content">([\s\S]*?)<section class="blog-article-footer">/i);
  if (contentMatch) return contentMatch[1].trim();
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
    <h1>Practical guides for running<br>your business, not chasing tools.</h1>
    <p class="lede">Short, high-signal articles on free business &amp; legal templates, document certificates, SSL for your domain, and getting paid on time — written for freelancers and small teams.</p>
  </section>
  <div class="blog-layout">
    <div class="blog-posts">
      ${articles}
    </div>
    <aside class="blog-sidebar-cta">
      <span class="blog-sidebar-eyebrow">Quick help</span>
      <h3>One place for the paperwork side of your business</h3>
      <p>Free templates, document certificates, SSL for your domain, and AI-drafted invoice follow-ups — no signup required to start.</p>
      <a class="blog-sidebar-btn blog-sidebar-btn-primary" href="/app/">Try docstoc free</a>
      <a class="blog-sidebar-btn blog-sidebar-btn-secondary" href="/document-templates/">Browse free templates</a>
      <p class="blog-sidebar-tip">Tip: stay friendly under 7 days late on a chase, get firmer past 30, and always leave the door open for a reply.</p>
    </aside>
  </div>`;
}

function renderBody(body) {
  if (!body) return { html: "", tocHtml: "" };
  let html = body;
  if (!/<[a-z][\s\S]*>/i.test(html)) {
    html = structuredBodyToHtml(html);
  }

  let tocHtml = "";
  const tocMatch = html.match(/<nav\s+class="blog-toc"[^>]*>[\s\S]*?<\/nav>/i);
  if (tocMatch) {
    tocHtml = tocMatch[0]
      .replace('class="blog-toc"', 'class="blog-toc blog-toc-side"')
      .replace("class='blog-toc'", "class='blog-toc blog-toc-side'");
    html = html.replace(tocMatch[0], "");
  } else {
    const headings = [...html.matchAll(/<h2([^>]*)>([\s\S]*?)<\/h2>/gi)];
    if (headings.length >= 3) {
      const items = [];
      for (const m of headings) {
        const attrs = m[1] || "";
        const rawTitle = m[2].replace(/<[^>]+>/g, "").trim();
        const idMatch = attrs.match(/\bid=["']([^"']+)["']/);
        const id = idMatch ? idMatch[1] : slugifyHeading(rawTitle);
        if (!idMatch && rawTitle) {
          html = html.replace(m[0], `<h2 id="${id}">${m[2]}</h2>`);
        }
        items.push(`<li><a href="#${id}">${escapeHtml(rawTitle)}</a></li>`);
      }
      tocHtml = `<nav class="blog-toc blog-toc-side" aria-label="Table of contents"><div class="blog-toc-title">Table of contents</div><ol>${items.join("")}</ol></nav>`;
    }
  }

  if (!/class=["'][^"']*\bblog-body\b/.test(html)) {
    html = `<div class="blog-body">${html.trim()}</div>`;
  }
  return { html: html.trim(), tocHtml };
}

function estimateReadMinutes(html) {
  const text = String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = text ? text.split(" ").length : 0;
  return Math.max(1, Math.round(words / 220));
}

function formatPostDate(iso) {
  if (!iso) return "";
  const d = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

const PILLAR_RESOURCES = {
  templates: {
    stripCopy: "Browse the full free template library — contracts, NDAs, offer letters and more",
    stripHref: "/document-templates/",
    stripLabel: "Browse templates",
    links: [
      ["/document-templates/", "Free business & legal document templates"],
      ["/free-templates/", "Free payment reminder email templates"],
      ["/certificate.html", "Certify a signed document"],
      ["/app/", "Try docstoc free"],
    ],
  },
  certificates: {
    stripCopy: "Certify your first document free — hashed in your browser, anchored to Bitcoin",
    stripHref: "/certificate.html",
    stripLabel: "Certify a document",
    links: [
      ["/certificate.html", "Create a document certificate"],
      ["/security.html", "docstoc security & trust overview"],
      ["/document-templates/", "Free business & legal document templates"],
      ["/app/", "Try docstoc free"],
    ],
  },
  ssl: {
    stripCopy: "Add your domain and get a free, real Let's Encrypt certificate",
    stripHref: "/ssl",
    stripLabel: "Set up free SSL",
    links: [
      ["/ssl", "Free SSL/TLS automation for your domain"],
      ["/app/ssl-domains", "Manage SSL domains"],
      ["/tools/ssl-certificate-calculator", "SSL expiry calculator"],
      ["/zerossl-alternative", "ZeroSSL alternative"],
      ["/app/", "Try docstoc free"],
    ],
  },
  chasing: {
    stripCopy: "Get your polite invoice templates PDF to chase clients with confidence",
    stripHref: "/free-templates/download",
    stripLabel: "Download",
    links: [
      ["/tools/invoice-chase-calculator", "Invoice chase calculator"],
      ["/blog/invoice-chase-software-comparison/", "docstoc vs Chaser, Paidnice &amp; other invoice chase tools"],
      ["/free-templates/", "Free payment reminder email templates"],
      ["/app/", "Try the AI invoice follow-up tool"],
      ["/payment-reminder", "Payment reminder emails guide"],
      ["/overdue-invoice", "Overdue invoice follow-up"],
      ["/invoice-follow-up", "Invoice follow-up best practices"],
    ],
  },
};

function pillarForPost(post) {
  switch (post.slug) {
    case "free-business-legal-document-templates":
      return "templates";
    case "document-certificates-tamper-evident-verification":
      return "certificates";
    case "free-ssl-automation-lets-encrypt-domain":
    case "ssl-certificate-authorities-market-share":
    case "ssl-certificate-providers-compared":
    case "ssl-tls-certificate-lifetime-shortening":
    case "types-of-ssl-certificates":
    case "types-of-tls-certificates":
    case "certificate-authority-types-pros-cons":
    case "acme-protocol-certificate-automation":
      return "ssl";
    default:
      return "chasing";
  }
}

function buildPostMain(post, body, depth = 2) {
  const prefix = "../".repeat(depth);
  const href = (p) => `${prefix}${p.replace(/^\//, "")}`;
  const script =
    post.slug === "invoice-chase-software-comparison"
      ? `\n<script src="${href("/price-compare.js")}" defer></script>`
      : "";
  const pillar = PILLAR_RESOURCES[pillarForPost(post)];
  const resourceLinks = pillar.links
    .map(([path, label]) => `<li><a href="${href(path)}">${label}</a></li>`)
    .join("\n      ");
  const { html: bodyHtml, tocHtml } = renderBody(body);
  const minutes = estimateReadMinutes(`${post.title} ${post.description || ""} ${bodyHtml}`);
  const dateLabel = formatPostDate(post.publishedAt);
  const category = post.category || "Guide";
  const aside = tocHtml
    ? `<aside class="blog-article-aside">${tocHtml}</aside>`
    : `<aside class="blog-article-aside" aria-hidden="true"></aside>`;

  return `<article class="blog-article">
  <header class="blog-article-hero">
    <div class="blog-article-hero-inner">
      <a class="blog-article-back" href="${href("/blog/")}">← Blog</a>
      <div class="blog-article-meta">
        <span class="blog-article-tag">${escapeHtml(category)}</span>
        ${dateLabel ? `<span class="blog-article-date">— ${escapeHtml(dateLabel)}</span>` : ""}
        <span class="blog-article-read">${minutes} min read</span>
      </div>
      <h1>${escapeHtml(post.title)}</h1>
      ${post.description ? `<p class="blog-article-lede">${escapeHtml(post.description)}</p>` : ""}
    </div>
  </header>
  <div class="blog-article-layout">
    ${aside}
    <div class="blog-article-content">
      ${bodyHtml}
      <section class="blog-article-footer">
        <aside class="tpl-pack-strip" aria-label="Related resource">
          <p class="tpl-pack-strip-copy">${pillar.stripCopy}</p>
          <a class="tpl-pack-strip-btn" href="${href(pillar.stripHref)}">${pillar.stripLabel}</a>
        </aside>
        <h2>Related resources</h2>
        <ul>
          ${resourceLinks}
        </ul>
      </section>
    </div>
  </div>
</article>${script}`;
}

const COMPARISON_FAQ = [
  {
    q: "Is docstoc a Chaser alternative?",
    a: "Yes for freelancers and small teams who want cheaper, draft-only follow-ups. Chaser targets SMB/mid-market AR with auto-send starting at a much higher price point.",
  },
  {
    q: "Does docstoc auto-send payment reminders?",
    a: "No. docstoc writes the email; you copy it into Gmail, Outlook, or Apple Mail (or open a mailto link). Clients always hear from you.",
  },
  {
    q: "How does docstoc pricing compare?",
    a: "Pro is $14.99/mo flat per workspace; Business is $39.99/mo. Competitors often use revenue tiers, seat caps, or higher entry plans (Paidnice from $69/mo, Chaser Compact from $259/mo).",
  },
  {
    q: "Can docstoc replace Paidnice or Duefy?",
    a: "If you need full auto-send sequences and a hosted payment portal, those tools may fit better. If you want AI drafts, tone controls, and inbox-first sending at a lower price, docstoc is built for that.",
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
    url: `https://docstoc.io/blog/${post.slug}/`,
    datePublished: post.publishedAt || undefined,
    dateModified: post.publishedAt || undefined,
    author: { "@type": "Organization", name: "docstoc" },
    publisher: {
      "@type": "Organization",
      name: "RELACON GmbH",
      logo: { "@type": "ImageObject", url: "https://docstoc.io/brand/docstoc-icon.png" },
    },
    mainEntityOfPage: `https://docstoc.io/blog/${post.slug}/`,
  };

  const faqBySlug = {
    "invoice-chase-software-comparison": COMPARISON_FAQ,
    "ar-policy-that-works-with-docstoc": AR_POLICY_FAQ,
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
    name: "docstoc Blog",
    url: "https://docstoc.io/blog/",
    description:
      "Practical guides on free business & legal templates, document certificates, free SSL for your domain, and invoice follow-ups for freelancers and small teams.",
    publisher: {
      "@type": "Organization",
      name: "RELACON GmbH",
      logo: { "@type": "ImageObject", url: "https://docstoc.io/brand/docstoc-icon.png" },
    },
    blogPost: posts.map((p) => ({
      "@type": "BlogPosting",
      headline: p.title,
      description: p.description || "",
      url: `https://docstoc.io/blog/${p.slug}/`,
      datePublished: p.publishedAt || undefined,
    })),
  },
  null,
  2
);

const indexHtml = chrome({
  title: "Free Templates, SSL, Document Certificates & Invoice Guides | docstoc Blog",
  description:
    "Practical guides on free business & legal templates, document certificates, free SSL for your domain, and chasing overdue invoices — for freelancers and small teams.",
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
      ? `${post.title} (2026) — docstoc`
      : `${post.title} — docstoc`;

  const postHtml = chrome({
    title,
    description: post.description || post.title,
    canonical: `/blog/${post.slug}/`,
    activeNav: "blog",
    mainHtml: buildPostMain(post, body),
    jsonLd: buildJsonLd(post),
    depth: 2,
    mainClass: "blog-article-main",
  });
  writeFileSync(join(slugDir, "index.html"), postHtml, "utf8");
  console.log(`Generated blog/${post.slug}/index.html`);
}

console.log(`Done — ${posts.length} blog posts.`);
