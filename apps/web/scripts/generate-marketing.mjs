#!/usr/bin/env node
/**
 * Regenerates marketing HTML pages: extracts <main> from existing files,
 * wraps with shared chrome. Run: node apps/web/scripts/generate-marketing.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chrome } from "./lib/chrome.mjs";
import { MARKETING_PAGES } from "./data/marketing-manifest.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "../public");

function extractMain(html) {
  const match = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  if (!match) throw new Error("No <main> found");
  return match[1].trim();
}

function extractTitle(html) {
  const match = html.match(/<title>([^<]*)<\/title>/i);
  return match ? match[1].trim() : "docstoc";
}

function extractDescription(html) {
  const match = html.match(/<meta name="description" content="([^"]*)"/i);
  return match ? match[1] : "";
}

function extractCanonical(html) {
  const match = html.match(/<link rel="canonical" href="([^"]*)"/i);
  if (!match) return "/";
  return match[1].replace(/^https:\/\/chasa\.io/, "") || "/";
}

function extractJsonLd(html) {
  const match = html.match(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/i);
  return match ? match[1].trim() : null;
}

function decodeHtmlEntities(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"');
}

for (const page of MARKETING_PAGES) {
  const filePath = join(publicDir, page.file);
  const html = readFileSync(filePath, "utf8");
  const mainHtml = extractMain(html);
  const out = chrome({
    title: decodeHtmlEntities(extractTitle(html)),
    description: decodeHtmlEntities(extractDescription(html)),
    canonical: extractCanonical(html),
    activeNav: page.activeNav ?? "",
    mainHtml,
    jsonLd: extractJsonLd(html),
    depth: page.depth ?? 0,
    extraHead: page.extraHead ?? "",
  });
  writeFileSync(filePath, out, "utf8");
  console.log(`Generated ${page.file}`);
}

console.log(`Done — ${MARKETING_PAGES.length} marketing pages.`);
