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

function bodyToHtml(body) {
  return (body || "")
    .split(/\n\s*\n/)
    .map((t) => `<p>${escapeHtml(t).replace(/\n/g, "<br>")}</p>`)
    .join("");
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

function buildIndexMain(posts) {
  const articles = posts
    .map(
      (p) => `<article style="margin-bottom:28px;padding-bottom:20px;border-bottom:1px solid var(--line)">
      <h2 style="font-family:Fraunces,serif;font-size:24px;margin:0 0 8px"><a href="/blog/${escapeHtml(p.slug)}/">${escapeHtml(p.title)}</a></h2>
      <p style="color:var(--ink-soft);margin:0">${escapeHtml(p.description || "")}</p>
    </article>`
    )
    .join("\n    ");
  return `<h1>Blog</h1>
  <p class="lede" style="margin-bottom:28px">Notes on chasing invoices without the awkwardness.</p>
  <div id="posts">
    ${articles}
  </div>`;
}

function renderBody(body) {
  if (!body) return "";
  if (/<[a-z][\s\S]*>/i.test(body)) return body;
  return bodyToHtml(body);
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

const indexHtml = chrome({
  title: "Blog — Chasa",
  description: "Notes on invoice chase, freelancing cash flow, and Chasa.",
  canonical: "/blog/",
  activeNav: "blog",
  mainHtml: buildIndexMain(posts),
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
