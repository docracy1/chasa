# Docstoc.com — Document/Template Content-Gap Map (via Wayback CDX)

Built from a full CDX enumeration of `docstoc.com/docs/*` — the individual document/template
detail-page URL family. This does **not** contain the actual document text/content (see caveat
at the bottom) — only titles/slugs, which is enough to map what topics existed and how popular
each cluster was, without reproducing anyone's uploaded content.

## Scale

- Raw CDX rows returned for `/docs/*` prefix: **2,961,939**
- Rows matching the `/docs/{id}/{slug}` pattern: 2,366,592
- **Distinct document IDs recovered: 1,809,668**
- This is a large but partial slice of docstoc's claimed 20M+ documents — only what the Wayback
  crawler happened to capture, mostly 2009–2014.

## What's actually in there

The overall top-100 word frequency across all 1.8M slugs is dominated by:
- **Patent filings** (`patent`, `method`, `apparatus`, `application` all rank in the top 15) —
  docstoc evidently absorbed a large bulk upload of patent-database text at some point. This is
  a huge chunk of the corpus and has zero relevance to Chasa/Docracy.
- Generic business/office documents (`report`, `form`, `agreement`, `plan`, `guide`, `manual`,
  `letter`, `template`, `sample`) — this is the real template-library core.
- A long multilingual tail (`de`, `la` in the top 20 suggest Spanish/French/German/Portuguese
  content mixed in).

**Practical implication**: docstoc's real "document library" was a small, valuable core buried
in a much larger pile of bulk-uploaded, low-relevance UGC (patents, random spreadsheets, PDFs of
unrelated reports). Chasa should not try to replicate the *volume* — the useful signal is the
*title patterns* below, which show what specific template types people searched for and
docstoc served.

## Keyword cluster counts (docs matching, by topic)

| Cluster | Count | Relevance |
|---|---|---|
| `form` (generic) | 47,147 | too broad to be useful alone |
| `contract`/`agreement` | 22,221 | Docracy-relevant |
| `nda` / `non-disclosure` / `confidentiality` (fixed match) | 589 | Docracy-relevant |
| `letter` (generic) | 15,098 | too broad alone |
| `template` | 12,850 | — |
| `sample` | 9,725 | — |
| `notice` | 3,722 | Chasa-relevant (final/past-due notices) |
| `freelance`/`freelancer` | 278 | Chasa-relevant audience signal |
| `collection`/`collections`/`dunning` | 1,611 | mostly false positives (data-collection, museum collections) — see samples |
| `demand` (as in demand letter) | 1,414 | mostly false positives (economics "supply and demand") |
| `invoice` | 1,174 | **Chasa core** |
| `receipt` | 872 | Chasa-adjacent |
| `promissory note` | 511 | Chasa-adjacent (debt instrument) |
| `payment plan`/`installment` | 341 | **Chasa core** |
| `payment reminder` | 146 | **Chasa core** |
| `overdue` | 71 | **Chasa core** |
| `collection letter` (exact phrase) | 51 | **Chasa core** |
| `past due` | 36 | **Chasa core** |
| `final notice` | 9 | **Chasa core** |
| `late fee` | 5 | too small to matter |

Note on false positives: bare keyword matching over-triggers on generic English words inside
unrelated titles (e.g. `nda` bare-substring matched "Rwanda" and "STANDARDS"; `collection` matched
museum/data collections; `demand` matched macroeconomics essays). Counts above marked
"mostly false positives" should be read as an upper bound, not a real topic count — the curated
title samples below are the reliable part.

## Curated title samples — Chasa-relevant clusters (real examples, ID + slug)

**Invoice** (1,174 total, sample):
- `service-invoice-template-excel`, `Invoice-Format`, `Tax-Invoice-Template`, `Commercial_Invoice`,
  `Download-Lease-Invoice-Template`, `vat-invoice`, `Supplier-Invoice-Requirements`

**Payment reminder / reminder letters** (curated, exact-phrase matches):
- `Payment-Reminder-Letter`, `PAYMENT-REMINDER-LETTER`, `Overdue-Payment-Reminder-Letter`,
  `Second-overdue-payment-reminder-letter-template`, `Payment-Past-Due-Reminder-Letter-Template`,
  `First-reminder-letter-friendly`, `REMINDER-LETTER-FOR-UNPAID-INVOICE`,
  `Business-Collections-Past-Due-Reminder-Letter-(Type-A)`, `Business-Collections-Past-Due-Reminder-Letter-(Type-B)`

**Past due / overdue notices**:
- `Past-Due-Notice-Template`, `Sample-Past-Due-Invoice-Notice`, `Past-Due-Final-Notice`,
  `Past-Due_-first-notice`, `Notice-of-Past-Due-Alimony` (adjacent, not directly relevant),
  `Payment-Past-Due-Reminder-Letter-Template`, `Past-Due-Notice---DOC`

**Collection letters** (curated, exact-phrase):
- `Sample-of-a-Collection-Letter-Using-Full-Block-Format`, `Bad-Debts-Collection-Letter`,
  `Sample-Collection-Letter-Templates`, `Final-Notice-Before-Collection-Letter`,
  `Collection-Letter-Templates`, `Download-Legal-Collection-Letter`,
  `How-to-write-sales-collection-letter-for-customers`

**Final notice**:
- `FINAL-NOTICE-BEFORE-LEGAL-ACTION`, `Final-Notice-Before-Collection-Letter`,
  `Final-Notice-Of-Overdue-Account`, `Payment-Demand-Letter-Final-Notice`,
  `Bad-Check-Notice-Final-Notice`

**Promissory note**:
- `Sample-Promissory-Note`, `Free-Promissory-Note-Template`, `Promissory-Note-Template`,
  `PROMISSORY-NOTE-PAYABLE-ON-DEMAND`, `Convertible-Promissory-Note`,
  `Sample-Promissory-Note-Letter-for-Late-Payment-of-Tuition-Fee`

**Payment plan / installment**:
- `Installment-payment-plans-fact-sheet`, `Electronic-Installment-Agreement`,
  `Form-9465---Installment-Agreement-Request` (IRS form), `Alaska-Installment-Sale-and-Security-Agreement`

**Freelance-audience signal** (not templates, but shows the audience existed on docstoc too):
- `Top-5-Online-Invoicing-Apps-Freelancers-Enjoy`, `Freelance-Writers-Dont-Waste-Your-Time-with-Query-Letters`,
  `Meet-Stefanie---Your-Freelance-Copywriter-On-Demand`

## Curated title samples — Docracy-relevant clusters

**NDA / Confidentiality** (589 total, fixed match):
- `MUTUAL-NDA`, `NDA-NON-DISCLOSURE`, `Non-Disclosure-Agreement-(NDA)-Template`,
  `Mutual-Nondisclosure-Agreement`, `Confidentiality-Agreement`,
  `Confidentiality-Agreement-for-Consultants-Contractors`

**Consulting/freelance agreements** (222 total, sample):
- `consulting-agreement`, `Business-Consulting-Agreement`, `Marketing-Consultant-Agreement`,
  `PROFESSIONAL-SERVICES-CONSULTING-AGREEMENT`, `Term-Sheet-Consulting-Agreement`

## Content-gap takeaways for Chasa

Cross-referencing against Chasa's current 28 free-template pages (as of this session):
already covered — polite/firm/30-day reminders, retainer/milestone/final agency follow-ups,
corporate escalation, ghosted-client, formal notices, disputes, payments-received.

**Titles/angles docstoc had that Chasa doesn't yet, worth adding**:
1. A **"Collection Letter" / "Full Block Format" business-letter-style** template — docstoc's
   most-duplicated title pattern in this space. Chasa's templates are all email-first; a formal
   printable-letter format variant could capture different search intent ("collection letter
   template" vs "payment reminder email").
2. **Bad-check notice** — a specific, recurring sub-case not currently covered.
3. **Promissory note (for a payment plan / settling a debt)** — bridges Chasa's "payment plan
   offer" template with a more formal, signable instrument; natural upsell tie-in to Docracy's
   e-signature capability.
4. **Installment/payment-plan agreement** (more formal than Chasa's current "payment plan offer"
   email) — another Docracy e-signature cross-sell angle.
5. A **"Business Collections — Past Due" letter, Type A/B variant pattern** — docstoc had two
   parallel versions of the same letter (presumably different tone/severity), matching the
   two-CTA structure ("polite" vs "firm") Chasa already uses elsewhere — validates that pattern
   and suggests extending it to the collection-letter format too.

## Important caveat — reuse

This file lists **titles and topic clusters only**, deliberately, not scraped document body text.
The underlying documents were user-uploaded UGC on docstoc, not docstoc's own IP — copying their
actual wording verbatim would raise copyright questions unless a specific doc was explicitly
public-domain licensed (docstoc did show per-doc license tags; not verified at scale here).
Treat every title above as an indicator of "this topic had real search demand," and write
Chasa's own original wording for any new template built from it.

## Method notes

- Data source: Internet Archive Wayback Machine CDX API, `url=docstoc.com/docs&matchType=prefix`,
  `filter=statuscode:200`, deduped by canonical URL key. No login/paid tool used.
- Keyword clustering done locally via Python regex over the 1.8M slug list — bare substring
  matching over-triggers on some generic English words (see false-positive note above); the
  curated title lists were manually spot-checked against that risk.
- Did not attempt to fetch/extract actual document body text for any of the 1.8M IDs — see
  caveat above. If ever needed, the next step would be sampling actual Wayback snapshots for a
  small, deliberately chosen set of IDs (e.g. the ones listed above), same technique used for the
  single "service-invoice-template-excel" example in the earlier research pass.
