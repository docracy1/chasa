# Docstoc.com — Usable Template Pool & Weekly Generation Pipeline

Answers the question: out of the 1.8M documents docstoc ever had crawled by the Wayback
Machine, how many represent genuinely usable, distinct template *types* — enough for a 1,000+
launch batch plus an ongoing 10/week cadence?

## Pipeline (what was actually done)

1. Started from the 1,809,668 distinct `/docs/{id}/{slug}` document IDs recovered via Wayback
   CDX (see `docstoc-content-gap-map.md` for the original full-corpus word-frequency pass).
2. **Whitelist filter**: kept only slugs containing a document-type word (agreement, contract,
   letter, template, form, notice, invoice, policy, plan, resume, nda, promissory note, etc. —
   ~90 words). → **172,522 candidate docs** (9.5% of the corpus — confirms most of the 1.8M is
   patents/junk/unrelated UGC, not real templates).
3. **Canonicalization**: stripped trailing "---COMPANY-NAME----MM-DD-YYYY" SEC-filing-style
   suffixes and numbers, lowercased, collapsed whitespace, so e.g. `Employment-Agreement---
   APPLIED-DNA-SCIENCES-INC---12-9-2011` and `EMPLOYMENT-AGREEMENT` both roll up into one
   canonical family `employment agreement`. → **144,643 canonical families**.
4. **Second-pass exclusion**: removed families that survived step 2 by accident but aren't real
   business/legal document templates — product user manuals (BlackBerry/Nokia/appliance service
   manuals), academic "chapter study guides," numbered glossary/definition series. → excluded
   5,133 families; 19 bare category words (e.g. "letter," "agreement" alone — too vague to be a
   single buildable page, kept as category labels, not counted below) → **139,491 clean,
   specific, buildable template families** remain.

## The actual numbers you asked about

| Tier | Threshold | Count | Weeks of runway at 10/week |
|---|---|---|---|
| **Launch batch** | docstoc had ≥5 real separate uploads of this exact template type | **1,367** | — (this IS the launch batch) |
| Extended pool | 2–4 uploads | +8,849 (10,216 cumulative) | ~885 weeks (~17 years) cumulative |
| Full long tail | exactly 1 upload | +129,275 (139,491 cumulative) | effectively unlimited, but noise ratio rises sharply (see caveat) |

**Direct answer: yes — 1,367 template types clear the "≥1,000 to start" bar on their own**, using
only the highest-confidence tier (each one had at least 5 independent real docstoc uploads,
i.e. real, repeated demand signal, not a one-off fluke). That tier alone is enough for the
weekly-10 cadence to run for **~2.6 years** before touching the noisier long tail at all.

Two CSV files were generated alongside this report for direct use:
- `launch_batch_top1500.csv` — the 1,367-row launch batch, ranked by docstoc upload count
- `weekly_pool_count2to4.csv` — the 8,849-row extended pool for weeks ~137 onward

## Quality spot-check (top vs. deep tail)

**Top 60** (ranks 1–60, counts 48–198): essentially clean — employment agreement, power of
attorney, press release, cover letter, business plan, letter of intent, application form,
memorandum of understanding, promissory note, confidentiality agreement, lease agreement, loan
agreement, purchase order, etc. This is a genuinely good "core 60" and matches what any real
document-template marketplace would want as its foundation.

**Ranks 100–160** (counts 16–22): still strongly usable — offer letter, startup business plan,
informed consent, cash flow statement, separation agreement, security agreement, deed of trust,
severance agreement, employment contract, hold-harmless agreement, letter of resignation, rent
receipt. A few noise items slipped through here too (two appliance-manual entries, "irs
administrative forms form," "chart form print a pdf%b%d") — roughly 5-10% noise at this depth.

**Deep tail** (ranks ~900–960, count=6, i.e. the bottom of even the "launch batch" tier): quality
drops noticeably — real usable items (tenancy agreement, vacation rental, model release, deed of
donation, guaranty agreement) mixed with clear noise (more appliance manuals, a Nissan repair
manual, company-specific merger-filing titles like "agreement miller industries inc," foreign-
language entries, stray artifacts like "ppt" and "application number"). Estimate **~25-30% noise
at the bottom edge of the 1,367 launch batch** — i.e. realistically closer to ~1,000 genuinely
clean template types in that tier, not all 1,367. This is exactly why the launch batch was sized
with headroom above the 1,000 minimum rather than exactly at it.

## Recommended rollout

1. **Launch with the top ~1,000 of `launch_batch_top1500.csv`** (ranks 1–~1,000, counts ≥6-ish) —
   this is the cleanest slice; the bottom ~300-400 rows of that file are where noise starts
   creeping in, so treat rows past ~1,000 as a buffer/backup rather than assuming all 1,367 are
   launch-ready as-is.
2. **Weekly batch of 10**: pull the next 10 rows from `launch_batch_top1500.csv` in rank order;
   once exhausted (~week 100-136), move to `weekly_pool_count2to4.csv`.
3. **Do not fully automate publishing from this list** — every row is a *topic name* mined from
   old URLs, not reviewed content. Given the ~5-25% noise rate observed even after two filter
   passes, each week's 10 should get a quick human/AI sanity check before a page is built (is
   this actually a coherent, distinct template type, or noise that slipped through?) — cheap to
   do at 10/week, not cheap to discover after 1,000 pages are live.
4. **Reuse the "why it's an actual gap" framing from `docstoc-content-gap-map.md`**: the 5
   Chasa-specific angles already identified there (formal collection letter, bad-check notice,
   promissory note, installment agreement, past-due Type A/B letter pair) are already inside this
   launch batch and should be prioritized first, ahead of generic business templates, since they
   map directly to Chasa's actual product (vs. Docracy's broader legal-template scope).
5. **Never copy docstoc's document text** — same caveat as before: these are topic names only,
   mined from URLs. Every template's actual wording needs to be written fresh.

## Files in this delivery

- `docstoc-template-pipeline.md` — this report
- `launch_batch_top1500.csv` — 1,367 ranked template families, count ≥5 (the launch batch)
- `weekly_pool_count2to4.csv` — 8,849 ranked template families, count 2-4 (extended weekly pool)
- (raw intermediate data — `good_families.json`, `ranked_families.json`, `docs_cdx.json` — kept
  in the scratch working directory, not copied into the repo; regenerable from the CDX API if
  ever needed again)
