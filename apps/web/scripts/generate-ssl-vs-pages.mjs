#!/usr/bin/env node
/**
 * Generates one "docstoc vs {Provider}" SEO landing page per TLS/SSL certificate provider —
 * comparing docstoc's free, bundled, ACME-automated SSL feature (issues real Let's Encrypt
 * certificates for a customer's own domain, no separate purchase or dashboard) against dedicated
 * certificate authorities and resellers. Pricing/feature figures below are sourced from each
 * provider's own pricing pages and cross-checked third-party trackers as of August 2026 — several
 * of these providers don't publish uniform pricing, so figures are phrased as typical ranges
 * where the source material itself disagreed. Re-verify before relying on any specific number.
 * Run: node apps/web/scripts/generate-ssl-vs-pages.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chrome, escapeHtml } from "./lib/chrome.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "../public");

/** @type {Array<{
 *  slug: string; name: string; pricingUrl: string; bestFit: string; pricing: string;
 *  certTypes: string; automation: string; setup: string; bundled: string; freeTier: string;
 *  summary: string; faq: Array<{q: string; a: string}>;
 * }>} */
const COMPETITORS = [
  {
    slug: "zerossl",
    name: "ZeroSSL",
    pricingUrl: "https://zerossl.com/pricing",
    bestFit: "Developers who want a GUI dashboard on top of free ACME certs",
    pricing: "Free (3 certs), then $14.99–$219.99/mo for annual certs & wildcards",
    certTypes: "Free 90-day DV via ACME, plus paid 1-year DV and wildcard certs",
    automation: "✓ ACME-automated, or manual CSR upload via dashboard",
    setup: "Low — but still a separate cert-management dashboard to learn",
    bundled: "✗ standalone certificate product, not part of a broader business platform",
    freeTier: "3 free 90-day certs, renewable indefinitely",
    summary:
      "ZeroSSL and docstoc are both free, ACME-based DV certificate issuers — functionally similar backends. The real difference isn't price, it's exposure: ZeroSSL is a dedicated certificate-management product with its own dashboard and account you maintain separately, while docstoc's SSL automation is invisible plumbing inside a small-business platform you're already using for invoicing and documents — no separate cert dashboard, no ACME client to understand.",
    faq: [
      {
        q: "Is docstoc's SSL automation the same technology as ZeroSSL's?",
        a: "Similar — both automate free DV certificates via the ACME protocol. docstoc issues real Let's Encrypt certificates specifically; ZeroSSL runs its own CA infrastructure. Neither is \"more secure\" than the other for a standard DV cert.",
      },
      {
        q: "Why use docstoc instead of ZeroSSL if they're both free?",
        a: "If you just need a certificate and are comfortable running a dedicated cert dashboard, ZeroSSL works well. docstoc's advantage is that the certificate is one feature inside a platform you're already using for invoicing, document templates, and certification — no separate account or ACME client to manage.",
      },
      {
        q: "Does ZeroSSL charge for anything docstoc includes free?",
        a: "ZeroSSL's core DV automation is free like docstoc's. ZeroSSL charges for annual (non-90-day) certs and wildcards ($14.99/mo and up) — docstoc's SSL automation is a flat feature of the Pro plan with no extra per-certificate charge.",
      },
    ],
  },
  {
    slug: "letsencrypt",
    name: "Let's Encrypt",
    pricingUrl: "https://letsencrypt.org/",
    bestFit: "Anyone running their own ACME client and renewal automation",
    pricing: "Free, always — a nonprofit certificate authority",
    certTypes: "DV only, 90-day default (6-day short-lived certs also available)",
    automation: "Requires an ACME client (certbot, acme.sh, or a hand-rolled client) you run yourself",
    setup: "Requires someone to set up and maintain the ACME client and renewal job",
    bundled: "✗ it's the certificate authority itself, not a product with a dashboard or support desk",
    freeTier: "Unlimited free certificates, no account needed",
    summary:
      "Let's Encrypt is the certificate authority docstoc's SSL automation is actually built on — this isn't really a competing product, it's the backend. The honest comparison: Let's Encrypt gives the certificate for free, but you (or your host) still need an ACME client, DNS or HTTP validation automation, and a renewal job configured and maintained. docstoc runs all of that for you as part of the platform, so you never touch an ACME client, a cron job, or a validation record beyond adding one DNS TXT entry once.",
    faq: [
      {
        q: "Is docstoc's SSL feature different from just using Let's Encrypt directly?",
        a: "The certificate itself is identical — docstoc issues real Let's Encrypt certificates. The difference is entirely in automation: using Let's Encrypt directly means running your own ACME client and renewal job; docstoc does that for you inside the same platform you use for invoicing and documents.",
      },
      {
        q: "Is docstoc more secure than Let's Encrypt?",
        a: "No — the certificate is the same Let's Encrypt-issued certificate either way. docstoc's value is automation and zero setup, not a security difference.",
      },
      {
        q: "Why not just use Let's Encrypt for free instead of docstoc?",
        a: "You can — if you're comfortable running certbot or another ACME client yourself and maintaining the renewal automation. docstoc is for small businesses who want that handled without any DevOps work.",
      },
    ],
  },
  {
    slug: "sectigo",
    name: "Sectigo",
    pricingUrl: "https://www.sectigo.com/ssl-certificates-tls/compare",
    bestFit: "Mid-market/enterprise IT teams needing OV/EV or insurance-backed certs",
    pricing: "Typically $70–$460+/yr for DV/wildcard; OV/EV priced higher, via resellers",
    certTypes: "DV, OV, EV, and wildcard/multi-domain (SAN) certificates",
    automation: "ACME supported via Sectigo Certificate Manager, but OV/EV still need manual business vetting",
    setup: "DV can be automated; OV/EV vetting (business docs, phone verification) can take days",
    bundled: "✗ a standalone commercial CA, typically sold through resellers",
    freeTier: "✗ no free tier",
    summary:
      "Sectigo is a top commercial certificate authority (formerly Comodo CA) selling DV, OV, EV, and wildcard certificates, mostly through resellers, with organization-vetted OV/EV taking days to issue. For a plain DV certificate — which covers the HTTPS padlock need for most small business sites — docstoc's free, automated cert is a straightforward cost and effort win over Sectigo's $70–460+/yr pricing. The legitimate exception: a business that specifically needs OV or EV organization-validated trust (e.g. a procurement or compliance requirement) still needs a CA like Sectigo, since docstoc only issues DV certificates.",
    faq: [
      {
        q: "Is docstoc a Sectigo alternative?",
        a: "For a standard DV certificate on your own domain, yes — free and automated versus Sectigo's paid, reseller-priced certs. If you specifically need OV or EV organization validation, docstoc doesn't offer that; Sectigo does.",
      },
      {
        q: "Why would someone still pay for Sectigo instead of using docstoc's free SSL?",
        a: "If a partner, procurement policy, or compliance requirement mandates an organization-validated (OV) or extended-validation (EV) certificate, which docstoc's DV-only automation can't provide.",
      },
      {
        q: "Does Sectigo automate certificate renewal like docstoc?",
        a: "Sectigo's Certificate Manager supports ACME automation for enterprise customers managing many certificates, but it's a paid enterprise platform — not a bundled, zero-setup feature the way docstoc's SSL automation is.",
      },
    ],
  },
  {
    slug: "digicert",
    name: "DigiCert",
    pricingUrl: "https://www.digicert.com/",
    bestFit: "Large enterprises needing audited trust chains, warranties, and PKI at scale",
    pricing: "OV often exceeds $300/yr; wildcard ~$560–$759/yr; EV priced highest, via resellers",
    certTypes: "DV, OV, EV, wildcard, plus PKI/IoT device certificates",
    automation: "ACME + ARI supported via Trust Lifecycle Manager for enterprise cert fleets",
    setup: "Enterprise-oriented — centralized policy/inventory management, not a quick self-serve flow",
    bundled: "✗ a standalone enterprise CA platform sold to large organizations",
    freeTier: "✗ no free tier",
    summary:
      "DigiCert is the dominant enterprise certificate authority by trust relationships — used by the large majority of the Fortune 500 and major banks for organization-validated trust, insurance-backed warranties, and PKI beyond web TLS (device certs, code signing, S/MIME). It isn't really priced or positioned for small businesses at all. docstoc's free, automated DV certificate solves a different, simpler problem — a small business just needing the HTTPS padlock — not the audited-trust-chain and warranty requirements DigiCert's enterprise customers are actually buying.",
    faq: [
      {
        q: "Is docstoc a DigiCert alternative?",
        a: "Only in the narrow sense that both issue TLS certificates. DigiCert serves large enterprises needing organizational vetting, warranties, and PKI at scale — a different problem than what a small business using docstoc needs solved.",
      },
      {
        q: "Should a small business use DigiCert instead of docstoc's free SSL?",
        a: "Usually not — DigiCert's pricing and vetting process are built for enterprise trust and compliance requirements a typical small business doesn't have. docstoc's free automated DV cert covers the everyday HTTPS need.",
      },
      {
        q: "Does docstoc offer the same warranty/insurance backing as DigiCert?",
        a: "No — docstoc issues standard Let's Encrypt DV certificates with no warranty program. DigiCert's paid certs include warranty coverage as part of their enterprise pricing.",
      },
    ],
  },
  {
    slug: "cloudflare-ssl",
    name: "Cloudflare SSL",
    pricingUrl: "https://developers.cloudflare.com/ssl/edge-certificates/universal-ssl/",
    bestFit: "Sites already routing DNS/traffic through Cloudflare's proxy",
    pricing: "Free (root + one subdomain level); Advanced Certificate Manager ~$10/mo/domain",
    certTypes: "Free Universal SSL at the edge; paid tiers add multi-level subdomains & custom validity",
    automation: "✓ automatic once DNS is proxied through Cloudflare — no ACME client needed",
    setup: "Trivial if already on Cloudflare; requires re-architecting DNS through Cloudflare otherwise",
    bundled: "Bundled with Cloudflare's CDN/proxy, not with a small-business invoicing/documents platform",
    freeTier: "Free on every Cloudflare plan, limited to root domain + first-level subdomains",
    summary:
      "Cloudflare's free Universal SSL is automatic and requires no ACME client — but only if you're already routing your domain's DNS and traffic through Cloudflare's proxy network, and it only covers the root domain plus one subdomain level (deeper subdomains need the paid Advanced Certificate Manager, ~$10/mo). docstoc issues a certificate for a customer's actual hosting setup directly, without requiring them to re-architect their DNS through a CDN they may not otherwise want.",
    faq: [
      {
        q: "Is docstoc's SSL automation the same as Cloudflare's free SSL?",
        a: "No — Cloudflare's free SSL only covers traffic between visitors and Cloudflare's edge, and requires your domain's DNS to be proxied through Cloudflare. docstoc issues a certificate for your actual server/hosting setup directly, with no DNS proxy required.",
      },
      {
        q: "Should I use Cloudflare instead of docstoc for SSL?",
        a: "If you're already using Cloudflare as your CDN/DNS proxy, its free Universal SSL is a reasonable option for root-domain coverage. docstoc is the better fit if you don't want to route your domain through a third-party proxy just to get HTTPS.",
      },
      {
        q: "Does Cloudflare's free SSL cover all my subdomains?",
        a: "No — free Universal SSL covers the root domain and first-level subdomains only. Deeper subdomains require Cloudflare's paid Advanced Certificate Manager (~$10/mo/domain).",
      },
    ],
  },
  {
    slug: "ssl-com",
    name: "SSL.com",
    pricingUrl: "https://www.ssl.com/products/website-security/acme/",
    bestFit: "Developers wanting free ACME DV with broad device compatibility, or paid OV/EV",
    pricing: "Free DV via ACME; paid wildcard DV from ~$224/yr, multi-domain OV from ~$142/yr",
    certTypes: "Free 90-day DV via ACME (including wildcards), plus paid DV/OV/EV",
    automation: "✓ ACME-automated for DV; OV/EV issuance is still manual/portal-based today",
    setup: "Low for the free ACME DV tier; manual verification required for paid OV/EV",
    bundled: "✗ standalone certificate authority with its own ACME/dashboard product",
    freeTier: "Free 90-day DV certs via ACME, including wildcards, no issuance rate limit",
    summary:
      "SSL.com is unusual among commercial CAs in also running a genuinely free ACME DV program — functionally close to what docstoc offers. The honest comparison here is the same as with Let's Encrypt or ZeroSSL: docstoc's real edge isn't \"free\" (SSL.com is also free at the DV tier), it's zero setup — no separate SSL.com account, ACME client, or dashboard to learn, because the certificate is one feature inside the small-business platform you're already using.",
    faq: [
      {
        q: "Is SSL.com actually free like docstoc's SSL automation?",
        a: "For standard DV certificates via ACME, yes — SSL.com's free tier is comparable to Let's Encrypt or ZeroSSL. docstoc's advantage is bundling that automation into a broader platform with no separate account or ACME client needed.",
      },
      {
        q: "When would I need SSL.com's paid tiers instead of docstoc?",
        a: "If you specifically need an OV or EV certificate with organization validation — docstoc only issues DV certificates, while SSL.com sells paid OV/EV for businesses that need that level of validation.",
      },
      {
        q: "Does SSL.com auto-renew certificates like docstoc?",
        a: "Its free ACME DV tier can be automated with a client the same way Let's Encrypt can. docstoc's difference is that the whole lifecycle — issuance and renewal — runs invisibly inside the platform with no separate ACME client to set up.",
      },
    ],
  },
  {
    slug: "globalsign",
    name: "GlobalSign",
    pricingUrl: "https://shop.globalsign.com/en/ssl/domain-ssl",
    bestFit: "Enterprises and device manufacturers needing a full PKI platform",
    pricing: "Typically $180–$400+/yr for OV, $250+/yr for DV, $300–$1,500+/yr for EV",
    certTypes: "DV, OV, EV, IntranetSSL, plus IoT device certificates",
    automation: "ACME/SCEP supported via GlobalSign's Atlas platform — an enterprise PKI feature, not self-serve",
    setup: "Enterprise integration work required; OV/EV still need business-verification paperwork",
    bundled: "✗ a standalone enterprise PKI platform, not part of a small-business suite",
    freeTier: "✗ no free tier",
    summary:
      "GlobalSign sells a full PKI platform — DV/OV/EV/IntranetSSL and IoT device certificates — aimed at enterprises and manufacturers, with ACME automation available as a paid enterprise feature rather than a self-serve flow. It isn't priced or built for a small business wanting a single domain secured quickly. docstoc's free, zero-setup DV automation covers that need directly, without the enterprise PKI integration work GlobalSign's automation still requires.",
    faq: [
      {
        q: "Is docstoc a GlobalSign alternative?",
        a: "For a single small-business domain needing standard HTTPS, yes — free and automatic versus GlobalSign's paid, enterprise-oriented certificates. GlobalSign is built for organizations managing many certificates or IoT device fleets, not a single small-business site.",
      },
      {
        q: "Does GlobalSign automate renewal like docstoc?",
        a: "GlobalSign's Atlas platform supports ACME/SCEP automation, but it's a paid enterprise PKI feature requiring integration work — not a zero-setup, bundled feature the way docstoc's SSL automation is.",
      },
      {
        q: "Why would a business choose GlobalSign over docstoc's free SSL?",
        a: "If they need OV/EV organization validation, IoT device certificates, or a centralized PKI platform for managing many certificates across an organization — none of which docstoc's single-domain DV automation covers.",
      },
    ],
  },
  {
    slug: "sslforfree",
    name: "SSL For Free (sslforfree.com)",
    pricingUrl: "https://www.sslforfree.com/",
    bestFit: "Hobbyists and developers comfortable repeating manual steps every 90 days",
    pricing: "Free tier available; paid convenience tiers $13.99–$149.99/mo",
    certTypes: "Free, automated DV via ACME (built on ZeroSSL's CA infrastructure), 90-day validity",
    automation: "Requires manually completing domain validation and reinstalling the cert every ~90 days unless you separately script it",
    setup: "Free tier: manual domain validation (email/HTTP/DNS) and manual cert installation each cycle",
    bundled: "✗ a standalone free-certificate tool with a separate account",
    freeTier: "Free 90-day DV certs via a web app or Certbot/ACME client",
    summary:
      "SSL For Free issues genuinely free DV certificates (running on ZeroSSL's ACME infrastructure) but its free tier means the customer manually repeats domain validation and cert installation roughly every 90 days, forever, unless they separately set up their own automation. docstoc's SSL feature handles the full lifecycle — the customer adds one DNS TXT record once, and docstoc issues and reissues the certificate automatically from then on, inside the same platform used for invoicing and documents.",
    faq: [
      {
        q: "Is SSL For Free actually free, or is docstoc's SSL automation better?",
        a: "SSL For Free's certificates are genuinely free. The difference is ongoing effort — its free tier requires manually repeating validation and installation every ~90 days, where docstoc automates renewal indefinitely after one initial DNS record.",
      },
      {
        q: "Does docstoc use the same certificate authority as SSL For Free?",
        a: "No — SSL For Free issues certificates through ZeroSSL's CA infrastructure. docstoc issues real Let's Encrypt certificates directly.",
      },
      {
        q: "Why would I pay SSL For Free's paid tiers instead of using docstoc?",
        a: "SSL For Free's paid tiers add convenience (larger cert allotments, 1-year and wildcard certs) for people managing many certificates outside any particular business platform. docstoc's SSL automation is bundled free into the Pro plan for a single business domain.",
      },
    ],
  },
  {
    slug: "freessl-org",
    name: "FreeSSL.org",
    pricingUrl: "https://freessl.org/",
    bestFit: "Developers wanting a quick ACME-based cert with an API/nicer UI than raw Certbot",
    pricing: "Free tier available; paid tiers at $9.90/mo (Basic) and $99.90/mo (Pro)",
    certTypes: "90-day DV, wildcard, and multi-domain certificates via ACME/API",
    automation: "ACME and REST API available; free tier still requires the customer to run renewal",
    setup: "Low to moderate — the backing certificate authority isn't disclosed on their own site",
    bundled: "✗ a standalone certificate tool with its own account and API",
    freeTier: "Free tier advertised, with paid tiers for higher allotments/automation",
    freeTierNote: "unverified CA backing",
    summary:
      "FreeSSL.org offers ACME-based DV, wildcard, and multi-domain certificates with a free tier and paid plans from $9.90/mo, but doesn't disclose which certificate authority actually backs its issued certificates — worth confirming directly before relying on it for anything business-critical. docstoc discloses its backend plainly (real Let's Encrypt certificates) and bundles the automation free into a business platform the customer already uses, with no separate account.",
    faq: [
      {
        q: "Is docstoc's SSL automation more transparent than FreeSSL.org's?",
        a: "docstoc discloses that it issues real Let's Encrypt certificates. FreeSSL.org's own marketing pages don't clearly state which certificate authority backs the certificates it issues — worth confirming directly with them before relying on it.",
      },
      {
        q: "Is FreeSSL.org free like docstoc's SSL feature?",
        a: "FreeSSL.org advertises a free tier, with paid plans starting at $9.90/mo for higher allotments. docstoc's SSL automation has no separate per-certificate charge — it's included in the Pro plan.",
      },
      {
        q: "Do I need a separate account with FreeSSL.org?",
        a: "Yes — it's a standalone certificate tool with its own account and dashboard. docstoc's SSL automation lives inside the same account you already use for invoicing and documents.",
      },
    ],
  },
  {
    slug: "certum",
    name: "Certum",
    pricingUrl: "https://shop.certum.eu/ssl.html",
    bestFit: "Budget-conscious buyers wanting a cheap paid cert with a financial guarantee",
    pricing: "DV from ~€25/yr, OV from ~€109/yr, EV from ~€309/yr (confirm current pricing directly)",
    certTypes: "DV, OV, EV website certs, plus code-signing and document-signing certificates",
    automation: "No consumer-facing ACME automation — manual CSR generation and renewal/re-purchase",
    setup: "Manual — CSR generation, domain validation, and (for OV/EV) business-document submission",
    bundled: "✗ a standalone commercial CA, popular with resellers",
    freeTier: "✗ no free tier",
    summary:
      "Certum is a Polish commercial CA selling cheap DV certificates (from roughly €25/yr) with a real financial guarantee, plus OV/EV and code/document-signing certificates — a diversified vendor, not SSL-only. Certum's certs are manually issued and manually renewed, with no consumer ACME automation. For plain DV — the vast majority of small-business HTTPS needs — docstoc's free, automatic, never-re-purchased certificate is simpler; Certum's edge is the financial guarantee and OV/EV options docstoc doesn't offer.",
    faq: [
      {
        q: "Is docstoc a Certum alternative?",
        a: "For a standard DV certificate, yes — free and automatic versus Certum's cheap-but-manual paid DV certs. If you want a financial-guarantee-backed cert or need OV/EV/code-signing, Certum offers products docstoc doesn't.",
      },
      {
        q: "Does Certum auto-renew certificates like docstoc?",
        a: "No — Certum's certificates require manual CSR generation and re-purchase/re-validation at renewal. docstoc's SSL automation reissues the certificate automatically once the initial DNS record is in place.",
      },
      {
        q: "Why would someone pay Certum instead of using docstoc's free SSL?",
        a: "For the financial guarantee backing, or because they specifically need an OV/EV certificate or a code/document-signing certificate — none of which docstoc's DV-only automation provides.",
      },
    ],
  },
  {
    slug: "godaddy-ssl",
    name: "GoDaddy SSL",
    pricingUrl: "https://www.godaddy.com/web-security/ssl-certificate",
    bestFit: "GoDaddy hosting/domain customers wanting one vendor for everything",
    pricing: "Promotional pricing from ~$69.99–$99.99/yr, with renewal commonly 67–130% higher",
    certTypes: "DV, OV, EV, wildcard, and multi-domain (SAN) — reseller/commercial certs, not free",
    automation: "Even \"Managed SSL\" requires initial setup; base certs are not auto-renewing by default",
    setup: "Manual CSR/setup; OV/EV require business-verification paperwork",
    bundled: "Bundled with GoDaddy hosting/domains, not with invoicing or document tooling",
    freeTier: "✗ no free tier",
    summary:
      "GoDaddy sells SSL certificates as an upsell alongside its domains and hosting, with promotional first-term pricing that's widely reported to jump 67–130% at renewal — the single most common customer complaint about GoDaddy's SSL product across review sites. Certificates aren't auto-renewing by default, so customers have to actively repurchase or risk a lapse. docstoc's certificate is free and auto-renews indefinitely as long as the domain's DNS stays configured — there's no renewal price to be surprised by, because there isn't a renewal purchase at all.",
    faq: [
      {
        q: "Is docstoc a GoDaddy SSL alternative?",
        a: "Yes, and the contrast is sharper than with most CAs — GoDaddy SSL is known for steep renewal-price increases after a low introductory rate, while docstoc's certificate is free and auto-renews indefinitely with no repurchase ever required.",
      },
      {
        q: "Why do GoDaddy SSL renewal prices jump so much?",
        a: "GoDaddy prices SSL certificates with low promotional first-term rates and significantly higher renewal rates — a pattern widely documented across independent review sites, not specific to any one plan.",
      },
      {
        q: "Does docstoc's SSL automation ever need to be repurchased?",
        a: "No — once a domain is set up, docstoc reissues the certificate automatically before it expires, for as long as the Pro plan is active. There's no separate renewal purchase or price to track.",
      },
    ],
  },
];

function buildJsonLd(c) {
  return JSON.stringify(
    {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: "https://chasa.io/" },
            {
              "@type": "ListItem",
              position: 2,
              name: `docstoc vs ${c.name}`,
              item: `https://chasa.io/chasa-vs-${c.slug}`,
            },
          ],
        },
        {
          "@type": "FAQPage",
          mainEntity: c.faq.map((item) => ({
            "@type": "Question",
            name: item.q,
            acceptedAnswer: { "@type": "Answer", text: item.a },
          })),
        },
      ],
    },
    null,
    2
  );
}

function buildMain(c) {
  const title = `docstoc vs ${c.name}`;
  const rows = [
    ["Best fit", "Small businesses wanting one domain secured, zero setup", c.bestFit],
    ["Pricing", "Free, bundled into the Pro plan", c.pricing],
    ["Certificate types", "Domain-validated (DV) only", c.certTypes],
    ["Automation", "✓ fully automated — one DNS TXT record, then hands-off", c.automation],
    ["Setup", "Add a domain, add one DNS record, done", c.setup],
    ["Bundled with a business platform", "✓ part of the same platform as invoicing & documents", c.bundled],
    ["Free tier", "Free as part of the Pro plan, no separate purchase", c.freeTier],
  ];

  const tableRows = rows
    .map(
      ([label, chasaVal, otherVal]) =>
        `          <tr>
            <td>${escapeHtml(label)}</td>
            <td class="col-chasa">${chasaVal}</td>
            <td>${escapeHtml(otherVal)}</td>
          </tr>`
    )
    .join("\n");

  const faqHtml = c.faq
    .map(
      (item) =>
        `<details class="faq-item"><summary>${escapeHtml(item.q)}</summary>\n<p>${escapeHtml(item.a)}</p>\n</details>`
    )
    .join("\n");

  return `<p class="crumb"><a href="/">Home</a> / ${escapeHtml(title)}</p>
<h1>${escapeHtml(title)} — free automated SSL, compared</h1>
  <p class="lede">${c.summary}</p>

  <h2>docstoc vs ${escapeHtml(c.name)} at a glance</h2>
  <div class="compare-table-wrap">
    <table class="compare-table">
      <thead>
        <tr>
          <th scope="col"></th>
          <th scope="col" class="col-chasa">docstoc</th>
          <th scope="col">${escapeHtml(c.name)}</th>
        </tr>
      </thead>
      <tbody>
${tableRows}
      </tbody>
    </table>
  </div>
  <p class="pc-note">Pricing and feature figures reflect publicly available information as of August 2026 — several certificate authorities don't publish uniform pricing, so check <a href="${c.pricingUrl}" target="_blank" rel="noopener noreferrer">${escapeHtml(c.name)}'s own site</a> directly before you buy, as plans and prices change.</p>

  <p style="margin-top:28px"><a href="/app/login?start=1" class="nav-cta">Try docstoc free</a></p>

  <h2>FAQ</h2>
  ${faqHtml}`;
}

mkdirSync(publicDir, { recursive: true });

for (const c of COMPETITORS) {
  const slug = `chasa-vs-${c.slug}`;
  const title = `docstoc vs ${c.name} — Free Automated SSL Compared | docstoc`;
  const description = `docstoc vs ${c.name}: pricing, automation, and setup effort compared for securing a small-business domain with SSL/TLS.`;

  const html = chrome({
    title,
    description,
    canonical: `/${slug}`,
    activeNav: "",
    mainHtml: buildMain(c),
    jsonLd: buildJsonLd(c),
    depth: 0,
  });

  writeFileSync(join(publicDir, `${slug}.html`), html, "utf8");
  console.log(`Generated ${slug}.html`);
}

console.log(`Done — ${COMPETITORS.length} SSL/TLS provider vs-competitor pages.`);
