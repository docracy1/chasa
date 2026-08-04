/**
 * Records the landing-page “How it works” demo to public/videos/how-it-works.webm
 * Run: node apps/web/scripts/record-how-it-works.mjs
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../../..");
const demoPath = path.join(__dirname, "demos/how-it-works.html");
const outDir = path.join(root, "apps/web/public/videos");
const outPath = path.join(outDir, "how-it-works.webm");
const posterPath = path.join(outDir, "how-it-works-poster.jpg");
const VIEWPORT = { width: 1280, height: 720 };
/** Keep in sync with total sleep() chain in demos/how-it-works.html (~60s + buffer) */
const DURATION_MS = 65000;

async function loadPlaywright() {
  const candidates = [
    path.join(root, "node_modules/playwright/index.js"),
    path.join(root, "apps/web/node_modules/playwright/index.js"),
    "/Users/reinhold/docracy/marketing/linkedin/node_modules/playwright/index.js",
    "/Users/reinhold/docracy/node_modules/playwright/index.js",
  ];
  for (const entry of candidates) {
    if (!fs.existsSync(entry)) continue;
    const req = createRequire(entry);
    return req("playwright");
  }
  throw new Error("playwright not found — npm install playwright");
}

const { chromium } = await loadPlaywright();
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: VIEWPORT,
  recordVideo: { dir: outDir, size: VIEWPORT },
});
const page = await context.newPage();
await page.goto(pathToFileURL(demoPath).href);
await page.waitForTimeout(2500);
await page.screenshot({ path: posterPath, type: "jpeg", quality: 86 });
await page.waitForTimeout(DURATION_MS - 2500);

const video = page.video();
await context.close();
await browser.close();

if (!video) throw new Error("No video recorded");
const tempPath = await video.path();
if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
fs.renameSync(tempPath, outPath);
console.log(`✓ ${outPath}`);
console.log(`✓ ${posterPath}`);
