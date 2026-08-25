#!/usr/bin/env node
/** Restore broken rebrand placeholders and apply user-facing email brand. */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, extname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "../../..");
const SKIP = new Set(["node_modules", "dist", ".git", "fonts"]);
const EXT = new Set([".html", ".js", ".mjs", ".ts", ".tsx", ".css", ".json", ".md", ".txt", ".xml", ".toml"]);

const RESTORE = [
  ["api.chasa.io", "api.chasa.io"],
  ["chasa.io", "chasa.io"],
  ["chasa-71s", "chasa-71s"],
  ["CHASA_DB", "CHASA_DB"],
  ["chasa-db", "chasa-db"],
  ["chasa-worker", "chasa-worker"],
  ["@chasa/", "@chasa/"],
  ["chasa_session", "chasa_session"],
  ["chasa_admin", "chasa_admin"],
  ["company/chasa-io", "company/chasa-io"],
  ["x.com/chasaHQ", "x.com/chasaHQ"],
];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (EXT.has(extname(name))) out.push(p);
  }
  return out;
}

function fixContent(s, path) {
  let t = s;
  for (const [from, to] of RESTORE) t = t.split(from).join(to);
  // User-facing contact emails (not SMTP From: headers in worker)
  if (!path.includes("apps/worker/")) {
    t = t.replace(/founder@chasa\.io/g, "founder@docstoc.io");
    t = t.replace(/sales@chasa\.io/g, "sales@docstoc.io");
  }
  return t;
}

let n = 0;
for (const dir of [join(ROOT, "apps/web"), join(ROOT, "apps/worker/src")]) {
  for (const f of walk(dir)) {
    const before = readFileSync(f, "utf8");
    const after = fixContent(before, f);
    if (after !== before) {
      writeFileSync(f, after, "utf8");
      n++;
    }
  }
}
console.log(`Fixed placeholders in ${n} files.`);
