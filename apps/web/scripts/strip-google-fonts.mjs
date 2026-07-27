#!/usr/bin/env node
/** Remove Google Fonts link tags from static HTML (fonts served via site.css @font-face). */
import { readFileSync, writeFileSync } from "node:fs";
import { readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "../public");

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name.endsWith(".html")) out.push(p);
  }
  return out;
}

const fontLinkRe =
  /\s*<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com">\s*\n?\s*<link rel="preconnect" href="https:\/\/fonts\.gstatic\.com" crossorigin>\s*\n?\s*<link href="https:\/\/fonts\.googleapis\.com\/css2[^"]+" rel="stylesheet">\s*\n?/g;

let changed = 0;
for (const file of walk(publicDir)) {
  const before = readFileSync(file, "utf8");
  const after = before.replace(fontLinkRe, "\n");
  if (after !== before) {
    writeFileSync(file, after);
    changed++;
    console.log(`Stripped Google Fonts: ${file.replace(publicDir, "")}`);
  }
}

console.log(`Done — updated ${changed} HTML files.`);
