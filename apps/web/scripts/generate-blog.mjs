#!/usr/bin/env node
/**
 * Generates blog/index.html and blog/{slug}/index.html from the API (fallback: blog-posts.json).
 * Run: node apps/web/scripts/generate-blog.mjs
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chrome, escapeHtml } from "./lib/chrome.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "../public");
const fallbackPath = join(__dirname, "data/blog-posts.json");
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

async function fetchPosts() {
  try {
    const res = await fetch(`${API_BASE}/api/blog/posts`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const posts = data.posts ?? [];
    if (posts.length === 0) {
      const fallback = readFallbackPosts();
      if (fallback.length > 0) {
        console.warn(`API returned no posts, using ${fallbackPath}`);
        return fallback;
      }
    }
    return posts;
  } catch (e) {
    console.warn(`API fetch failed (${e.message}), using ${fallbackPath}`);
    return readFallbackPosts();
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
  return `<p><a href="${href("/blog/")}">← Blog</a></p>
  <h1>${escapeHtml(post.title)}</h1>
  ${post.description ? `<p class="lede">${escapeHtml(post.description)}</p>` : ""}
  ${renderBody(body)}
  <section style="margin-top:40px;padding-top:24px;border-top:1px solid var(--line)">
    <h2>Related resources</h2>
    <ul>
      <li><a href="${href("/free-templates/")}">Free payment reminder email templates</a></li>
      <li><a href="${href("/app/")}">Try the AI invoice follow-up tool</a></li>
      <li><a href="${href("/payment-reminder")}">Payment reminder emails guide</a></li>
      <li><a href="${href("/overdue-invoice")}">Overdue invoice follow-up</a></li>
      <li><a href="${href("/invoice-follow-up")}">Invoice follow-up best practices</a></li>
    </ul>
  </section>`;
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
  let body = await fetchPostBody(post.slug);
  if (!body) {
    body = postMainFromExisting(post.slug) ?? "";
  }

  const slugDir = join(publicDir, "blog", post.slug);
  mkdirSync(slugDir, { recursive: true });

  const jsonLd = JSON.stringify(
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: post.title,
      description: post.description || "",
      url: `https://chasa.io/blog/${post.slug}/`,
      datePublished: post.publishedAt || undefined,
      author: { "@type": "Organization", name: "Chasa" },
      publisher: { "@type": "Organization", name: "RELACON GmbH" },
    },
    null,
    2
  );

  const postHtml = chrome({
    title: `${post.title} — Chasa`,
    description: post.description || post.title,
    canonical: `/blog/${post.slug}/`,
    activeNav: "blog",
    mainHtml: buildPostMain(post, body),
    jsonLd,
    depth: 2,
  });
  writeFileSync(join(slugDir, "index.html"), postHtml, "utf8");
  console.log(`Generated blog/${post.slug}/index.html`);
}

console.log(`Done — ${posts.length} blog posts.`);
