#!/usr/bin/env node
/**
 * Rebrand user-facing "docstoc" → "docstoc". Preserves infrastructure hostnames
 * (chasa.io, api.docstoc.io), D1 bindings, session cookies, and npm scope.
 */
import { readFileSync, writeFileSync, readdirSync, statSync, renameSync, existsSync } from "node:fs";
import { dirname, join, extname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "../../..");
const WEB = join(ROOT, "apps/web");
const WORKER = join(ROOT, "apps/worker/src");

const SKIP_DIRS = new Set(["node_modules", "dist", ".git", "fonts"]);
const TEXT_EXT = new Set([
  ".html", ".js", ".mjs", ".ts", ".tsx", ".css", ".json", ".md", ".txt", ".xml", ".toml",
]);

/** Tokens that must survive the blanket replace (longest / most specific first). */
const GUARD = [
  ["api.docstoc.io", "api.docstoc.io"],
  ["chasa.io", "chasa.io"],
  ["chasa-71s", "chasa-71s"],
  ["CHASA_DB", "__BIND_CHASA_DB__"],
  ["chasa-db", "__BIND_CHASA_DB_NAME__"],
  ["chasa-worker", "chasa-worker"],
  ["@chasa/", "@chasa/"],
  ["chasa_session", "chasa_session"],
  ["chasa_admin", "chasa_admin"],
  ["company/docstochq", "company/docstochq"],
  ["x.com/DocstocHQ", "x.com/DocstocHQ"],
  ["61593805566159", "61593805566159"],
];

function guardText(s) {
  let out = s;
  for (const [from, to] of GUARD) out = out.split(from).join(to);
  return out;
}

function unguardText(s) {
  let out = s;
  for (const [from, to] of [...GUARD].reverse()) out = out.split(to).join(from);
  return out;
}

function rebrandText(s) {
  let t = guardText(s);
  t = t.replace(/Docstoc/g, "Docstoc");
  t = t.replace(/DOCSTOC/g, "DOCSTOC");
  t = t.replace(/docstoc/g, "docstoc");
  return unguardText(t);
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (TEXT_EXT.has(extname(name))) out.push(p);
  }
  return out;
}

function processFile(path) {
  const before = readFileSync(path, "utf8");
  const after = rebrandText(before);
  if (after !== before) {
    writeFileSync(path, after, "utf8");
    return true;
  }
  return false;
}

function renameIfExists(from, to) {
  if (!existsSync(from)) return false;
  if (existsSync(to)) return false;
  renameSync(from, to);
  return true;
}

// --- File / path renames ---
const renames = [
  [join(WEB, "public/switch-to-docstoc.html"), join(WEB, "public/switch-to-docstoc.html")],
  [
    join(WEB, "public/use-cases/docstoc-certificate-monitoring.html"),
    join(WEB, "public/use-cases/docstoc-certificate-monitoring.html"),
  ],
  [
    join(WEB, "public/blog/ar-policy-that-works-with-docstoc"),
    join(WEB, "public/blog/ar-policy-that-works-with-docstoc"),
  ],
  [
    join(WEB, "scripts/data/blog-bodies/ar-policy-that-works-with-docstoc.html"),
    join(WEB, "scripts/data/blog-bodies/ar-policy-that-works-with-docstoc.html"),
  ],
];
for (const [from, to] of renames) {
  if (renameIfExists(from, to)) console.log(`Renamed ${from} → ${to}`);
}

// --- Process source trees ---
const dirs = [
  join(WEB, "scripts"),
  join(WEB, "app"),
  join(WEB, "public"),
  WORKER,
];
let changed = 0;
for (const dir of dirs) {
  if (!existsSync(dir)) continue;
  for (const f of walk(dir)) {
    if (processFile(f)) changed++;
  }
}

console.log(`Rebrand complete — ${changed} files updated.`);
