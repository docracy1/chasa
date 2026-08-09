#!/usr/bin/env node
/**
 * Generates real, crawlable /es/ counterparts for the pages with full data-i18n coverage —
 * NOT the client-side JS text-swap every other page still uses. Run AFTER
 * generate-marketing.mjs and generate-blog.mjs, since it reads their EN output.
 *
 * Adding a page here requires it to have full data-i18n / data-i18n-html coverage in its
 * <main> already (check with `grep -c data-i18n public/<file>`), plus an entry in
 * es-alternates.mjs's EN_TO_ES map. Don't add one without the other — an alternates entry
 * with no generated file means hreflang/sitemap point at a 404; a generated file with no
 * alternates entry means it's invisible to hreflang, sitemap, and the locale switcher.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chrome, escapeHtml } from "./lib/chrome.mjs";
import { es as esCatalog } from "./data/marketing-i18n.mjs";
import { EN_TO_ES, ES_PAGE_PAIRS } from "./data/es-alternates.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "../public");

/** Page-specific SEO metadata isn't part of the shared UI catalog (it's per-page, not a
 *  reusable string), so it's hand-translated here instead. */
const SEO_ES = {
  "/": {
    title: "Chasa — Recordatorios de facturas con IA para autónomos",
    description:
      "Herramienta gratuita con IA para seguimiento de facturas. Pega tu factura impaga y recibe el recordatorio con el tono adecuado, de amable a firme.",
  },
  "/privacy": {
    title: "Privacidad — Chasa",
    description:
      "Qué hace Chasa con tus datos: qué recopilamos, por qué, qué subencargados lo tratan, cuánto tiempo se conserva y cómo pedir su eliminación o exportación.",
  },
  "/terms": {
    title: "Términos — Chasa",
    description:
      "Cómo funciona Chasa, explicado en lenguaje sencillo: qué hace el servicio, qué cuesta, tus responsabilidades y las condiciones de tu cuenta.",
  },
  "/blog/": {
    title: "Guías de facturas y recordatorios de pago | Blog Chasa",
    description:
      "Guías prácticas para hacer seguimiento de facturas vencidas, escribir recordatorios de pago y construir una política de cuentas por cobrar.",
  },
};

function extractMain(html) {
  const match = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  if (!match) throw new Error("No <main> found");
  return match[1].trim();
}

function extractJsonLd(html) {
  const match = html.match(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/i);
  return match ? match[1].trim() : null;
}

/** aria-label lives on the SAME tag as data-i18n-aria — no closing-tag matching needed. */
function translateAriaLabels(html) {
  return html.replace(/<([a-zA-Z][^>]*?)\sdata-i18n-aria="([\w.]+)"([^>]*?)(\/?)>/g, (m, pre, key, post, selfClose) => {
    const val = esCatalog[key];
    if (val == null) return m;
    const cleaned = (pre + post).replace(/\s*aria-label="[^"]*"/g, "");
    return `<${cleaned} data-i18n-aria="${key}" aria-label="${escapeHtml(val)}"${selfClose}>`;
  });
}

/** data-i18n-html values are pre-authored HTML (e.g. inline <a> links) — inserted raw. */
function translateHtmlBlocks(html) {
  return html.replace(/<(\w+)([^>]*?)\sdata-i18n-html="([\w.]+)"([^>]*)>[\s\S]*?<\/\1>/g, (m, tag, pre, key, post) => {
    const val = esCatalog[key];
    if (val == null) return m;
    return `<${tag}${pre} data-i18n-html="${key}"${post}>${val}</${tag}>`;
  });
}

/** Plain data-i18n text nodes never contain nested tags — [^<]* is a safe, exact match. */
function translateTextNodes(html) {
  return html.replace(/<(\w+)([^>]*?)\sdata-i18n="([\w.]+)"([^>]*)>[^<]*<\/\1>/g, (m, tag, pre, key, post) => {
    const val = esCatalog[key];
    if (val == null) return m;
    return `<${tag}${pre} data-i18n="${key}"${post}>${escapeHtml(val)}</${tag}>`;
  });
}

function translateToSpanish(html) {
  return translateTextNodes(translateHtmlBlocks(translateAriaLabels(html)));
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Nav/footer links that point at a page with a real ES counterpart should point at it —
 *  everything else (no counterpart yet) correctly keeps pointing at the EN version. The
 *  negative lookbehind keeps this from also matching inside data-en-href/data-es-href,
 *  which end in the same "href=" substring. */
function rewriteInternalLinks(html) {
  let out = html;
  for (const [en, es] of Object.entries(EN_TO_ES)) {
    out = out.replace(new RegExp(`(?<![\\w-])href="${escapeRegex(en)}"`, "g"), `href="${es}"`);
  }
  return out;
}

mkdirSync(join(publicDir, "es"), { recursive: true });

for (const [enPath, esPath] of ES_PAGE_PAIRS) {
  const srcFile = enPath === "/" ? "index.html" : `${enPath.replace(/^\//, "").replace(/\/$/, "")}${enPath.endsWith("/") ? "/index.html" : ".html"}`;
  const srcPath = join(publicDir, srcFile);
  if (!existsSync(srcPath)) {
    console.warn(`Skipping ${enPath} → ${esPath}: ${srcFile} not found`);
    continue;
  }
  const enHtml = readFileSync(srcPath, "utf8");
  const seo = SEO_ES[enPath];
  if (!seo) throw new Error(`No SEO_ES entry for ${enPath} — add one before generating it.`);

  let outHtml;
  if (enPath === "/") {
    // Homepage bypasses chrome() (bespoke hero layout) — translate the whole file in place.
    outHtml = enHtml
      .replace(/<html lang="en">/, `<html lang="es">`)
      .replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(seo.title)}</title>`)
      .replace(/(<meta name="description" content=")[^"]*(")/, `$1${escapeHtml(seo.description)}$2`)
      .replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${escapeHtml(seo.title)}$2`)
      .replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${escapeHtml(seo.description)}$2`)
      .replace(/(<meta name="twitter:title" content=")[^"]*(")/, `$1${escapeHtml(seo.title)}$2`)
      .replace(/(<meta name="twitter:description" content=")[^"]*(")/, `$1${escapeHtml(seo.description)}$2`)
      .replace(
        /<link rel="canonical" href="https:\/\/chasa\.io\/">\n<link rel="alternate" hreflang="en" href="https:\/\/chasa\.io\/">\n<link rel="alternate" hreflang="es" href="https:\/\/chasa\.io\/es\/">\n<link rel="alternate" hreflang="x-default" href="https:\/\/chasa\.io\/">/,
        `<link rel="canonical" href="https://chasa.io${esPath}">
<link rel="alternate" hreflang="en" href="https://chasa.io/">
<link rel="alternate" hreflang="es" href="https://chasa.io${esPath}">
<link rel="alternate" hreflang="x-default" href="https://chasa.io/">`
      )
      .replace(`data-i18n-aria="nav.language" data-es-href="/es/"`, `data-i18n-aria="nav.language" data-en-href="/"`);
    outHtml = translateToSpanish(outHtml);
  } else {
    // Translate AFTER chrome() wraps the page, not before — mainHtml alone excludes the
    // header/footer chrome, which also carries data-i18n attributes (nav links, footer
    // columns) that need translating too.
    outHtml = chrome({
      title: seo.title,
      description: seo.description,
      canonical: esPath,
      mainHtml: extractMain(enHtml),
      jsonLd: extractJsonLd(enHtml),
      lang: "es",
    });
    outHtml = translateToSpanish(outHtml);
  }

  outHtml = rewriteInternalLinks(outHtml);

  const destFile = esPath.slice(1) + (esPath.endsWith("/") ? "index.html" : ".html");
  const destPath = join(publicDir, destFile);
  mkdirSync(dirname(destPath), { recursive: true });
  writeFileSync(destPath, outHtml, "utf8");
  console.log(`Generated ${destFile}`);
}
