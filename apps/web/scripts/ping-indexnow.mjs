#!/usr/bin/env node
/**
 * IndexNow submission script for chasa.io
 * Submits updated URLs to search engines via the IndexNow API (Bing, Yandex, Seznam, Naver).
 * Spec: https://www.indexnow.org/documentation
 *
 * Usage:
 *   node apps/web/scripts/ping-indexnow.mjs
 *   node apps/web/scripts/ping-indexnow.mjs https://chasa.io/use-cases/ https://chasa.io/features/
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { INDEXNOW_KEY, SITE_URL } from "./data/seo-config.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "../public");
const sitemapPath = join(publicDir, "sitemap.xml");

const ENDPOINTS = [
  "https://api.indexnow.org/indexnow",
  "https://www.bing.com/indexnow",
];

function extractUrlsFromSitemap() {
  if (!existsSync(sitemapPath)) {
    console.error("sitemap.xml not found at:", sitemapPath);
    return [`${SITE_URL}/`];
  }
  const content = readFileSync(sitemapPath, "utf8");
  const matches = content.match(/<loc>(.*?)<\/loc>/g);
  if (!matches) return [`${SITE_URL}/`];
  return matches.map((m) => m.replace(/<\/?loc>/g, "").trim());
}

async function pingIndexNow(urls) {
  const host = new URL(SITE_URL).hostname;
  const keyLocation = `${SITE_URL}/${INDEXNOW_KEY}.txt`;

  console.log(`=== IndexNow Submission ===`);
  console.log(`Host: ${host}`);
  console.log(`Key: ${INDEXNOW_KEY}`);
  console.log(`Key Location: ${keyLocation}`);
  console.log(`URLs to submit: ${urls.length}`);

  // IndexNow allows max 10,000 URLs per payload
  const BATCH_SIZE = 10000;
  for (let i = 0; i < urls.length; i += BATCH_SIZE) {
    const batch = urls.slice(i, i + BATCH_SIZE);
    const payload = {
      host,
      key: INDEXNOW_KEY,
      keyLocation,
      urlList: batch,
    };

    for (const endpoint of ENDPOINTS) {
      try {
        console.log(`\nSubmitting batch of ${batch.length} URLs to ${endpoint}...`);
        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json; charset=utf-8",
          },
          body: JSON.stringify(payload),
        });

        if (res.ok || res.status === 200 || res.status === 202) {
          console.log(`✅ Success (${res.status}): IndexNow submission accepted by ${endpoint}`);
        } else {
          const body = await res.text();
          console.warn(`⚠️ Warning (${res.status}) from ${endpoint}: ${body || res.statusText}`);
        }
      } catch (err) {
        console.error(`❌ Error submitting to ${endpoint}:`, err.message);
      }
    }
  }
}

const customArgs = process.argv.slice(2).filter((arg) => arg.startsWith("http"));
const targetUrls = customArgs.length > 0 ? customArgs : extractUrlsFromSitemap();

pingIndexNow(targetUrls);
