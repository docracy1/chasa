#!/usr/bin/env node
/** Copy self-hosted woff2 fonts from @fontsource packages into public/fonts/. */
import { copyFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "../../..");
const outDir = join(__dirname, "../public/fonts");

const copies = [
  { pkg: "inter", file: "inter-latin-400-normal.woff2", dest: "inter-400.woff2" },
  { pkg: "inter", file: "inter-latin-500-normal.woff2", dest: "inter-500.woff2" },
  { pkg: "inter", file: "inter-latin-600-normal.woff2", dest: "inter-600.woff2" },
  { pkg: "inter", file: "inter-latin-700-normal.woff2", dest: "inter-700.woff2" },
  { pkg: "fraunces", file: "fraunces-latin-400-normal.woff2", dest: "fraunces-400.woff2" },
  { pkg: "fraunces", file: "fraunces-latin-600-normal.woff2", dest: "fraunces-600.woff2" },
  { pkg: "fraunces", file: "fraunces-latin-500-italic.woff2", dest: "fraunces-500-italic.woff2" },
  { pkg: "ibm-plex-mono", file: "ibm-plex-mono-latin-400-normal.woff2", dest: "ibm-plex-mono-400.woff2" },
  { pkg: "ibm-plex-mono", file: "ibm-plex-mono-latin-500-normal.woff2", dest: "ibm-plex-mono-500.woff2" },
  { pkg: "ibm-plex-mono", file: "ibm-plex-mono-latin-600-normal.woff2", dest: "ibm-plex-mono-600.woff2" },
];

mkdirSync(outDir, { recursive: true });

for (const { pkg, file, dest } of copies) {
  const src = join(root, "node_modules/@fontsource", pkg, "files", file);
  if (!existsSync(src)) {
    console.error(`Missing font file: ${src}`);
    process.exit(1);
  }
  copyFileSync(src, join(outDir, dest));
  console.log(`Copied ${dest}`);
}

console.log("Fonts copied to public/fonts/");
