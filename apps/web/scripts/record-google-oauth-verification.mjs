/**
 * Record Google OAuth verification demo → public/videos/google-oauth-verification.mp4
 * Run: node apps/web/scripts/record-google-oauth-verification.mjs
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import { recordDemoWithVoice } from "./lib/record-demo-with-voice.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const demoPath = path.join(__dirname, "demos/google-oauth-verification.html");
const outMp4 = path.resolve(__dirname, "../public/videos/google-oauth-verification.mp4");
const durationMs = 98000;

async function main() {
  const html = fs.readFileSync(demoPath, "utf8");
  const m = html.match(/window\.__DEMO_NARRATION__\s*=\s*(\[[\s\S]*?\]);/);
  if (!m) throw new Error("Missing window.__DEMO_NARRATION__");
  const segments = JSON.parse(m[1]);
  console.log("Recording Google OAuth verification demo…");
  await recordDemoWithVoice({ demoPath, outMp4, durationMs, segments });
  console.log("\nUpload to YouTube:", outMp4);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
