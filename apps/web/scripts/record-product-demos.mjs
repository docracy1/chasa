/**
 * Record all five docstoc product demo videos with voiceover → public/videos/*.mp4
 * Run: node apps/web/scripts/record-product-demos.mjs
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { recordDemoWithVoice } from "./lib/record-demo-with-voice.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const demosDir = path.join(__dirname, "demos");
const outDir = path.resolve(__dirname, "../public/videos");

const DEMOS = [
  {
    id: "product-01-document-templates",
    file: "product-document-templates.html",
    durationMs: 58000,
  },
  {
    id: "product-02-invoice-generator",
    file: "product-invoice-generator.html",
    durationMs: 58000,
  },
  {
    id: "product-03-ai-chasing-google-oauth",
    file: "product-google-oauth.html",
    durationMs: 98000,
  },
  {
    id: "product-04-ssl-automation",
    file: "product-ssl.html",
    durationMs: 52000,
  },
  {
    id: "product-05-document-certificates",
    file: "product-certificates.html",
    durationMs: 52000,
  },
];

async function main() {
  for (const demo of DEMOS) {
    const demoPath = path.join(demosDir, demo.file);
    const outMp4 = path.join(outDir, `${demo.id}.mp4`);
    console.log(`\n=== ${demo.id} ===`);
    const html = await import("node:fs").then((fs) => fs.readFileSync(demoPath, "utf8"));
    const m = html.match(/window\.__DEMO_NARRATION__\s*=\s*(\[[\s\S]*?\]);/);
    if (!m) throw new Error(`Missing narration in ${demo.file}`);
    const segments = JSON.parse(m[1]);
    await recordDemoWithVoice({
      demoPath,
      outMp4,
      durationMs: demo.durationMs,
      segments,
    });
  }
  console.log("\nAll product demos recorded in", outDir);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
