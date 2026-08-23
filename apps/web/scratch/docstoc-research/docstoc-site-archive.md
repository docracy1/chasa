# Docstoc.com — Internal Site Archive (via Wayback CDX)

Reconstructed via the Internet Archive's free CDX API (`web.archive.org/cdx/search/cdx`), no auth needed. Queries run against `docstoc.com/*` (blog, browse, premium, article, video prefixes) and the separate `blog.docstoc.com` subdomain, which turned out to hold the real company blog.

## Summary

- The company blog lived on a **separate subdomain, `blog.docstoc.com`**, not `docstoc.com/blog` (which is mostly noise/legacy paths). Recovered **127 distinct real blog post titles** spanning 2007–2014, from the private-beta launch through the Intuit acquisition announcement — a near-complete growth-tactics timeline (see below).
- The `/browse/` faceted taxonomy is enormous: a 3,000-row CDX sample (capped) already surfaced **2,708 distinct category × business-type × state × doc-type combinations**, confirming this was large-scale programmatic/faceted SEO, not a curated taxonomy. The true total is almost certainly in the tens of thousands.
- `/premium/` (the paid "Docstoc Premium" subscription tier) had a small, curated set of **22 real category pages** — a deliberate contrast to the sprawling free `/browse/` matrix.
- `/article/` and `/video/` each returned **760+ and 798+ distinct real titles** respectively (capped at the 3,000-row query limit — true totals are higher), confirming both were substantial content verticals in their own right, not afterthoughts.

## Blog posts (blog.docstoc.com — real titles, 2007–2014)

127 distinct post slugs recovered. Selected chronological highlights (full list of 127 was reviewed; this is the representative set — ask if the complete raw list is wanted):

| Date | Title (from URL slug) |
|---|---|
| 2007-03-22 | Sneak peek video tour |
| 2007-03-22 | User generated content |
| 2007-03-25 | Community features |
| 2007-03-25 | Sample business documents |
| 2007-05-15 | Sample legal forms |
| 2007-05-15 | Request a document |
| 2007-07-02 | Docstoc is now in private beta |
| 2007-08-21 | Invitations to private beta |
| 2007-08-21 | Docstoc private beta written up in TechCrunch |
| 2007-10-13 | Docstoc goes Hollywood |
| 2007-10-13 | Docstoc raises Series A round |
| 2007-10-13 | Docstoc selected for TechCrunch40 |
| 2007-11-11 | iPod Touch give-away (weekly contest, ran several weeks) |
| 2007-11-14 | Embed documents on Docstoc into your blog or website |
| 2007-11-25 | Featured document: The Social Media Manual |
| 2008-01-16 | New document display templates — pick your own style |
| 2008-01-16 | New feature: RSS feeds |
| 2008-02-18 | Get business leads by sharing your documents |
| 2008-02-25 | Get your documents indexed by search engines |
| 2008-02-25 | Store your documents privately online for free |
| 2008-04-03 | Digg submissions on Docstoc |
| 2008-04-08 | Use the Digg button to gain more visibility for your content |
| 2008-05-02 | Docstoc.com secures $3.25M in Series B |
| 2008-05-06 | Content partnership program |
| 2009-05-17 | Docstoc powers Google Docs and Templates |
| 2009-08-15 | Docstoc launches DocStore — online marketplace to buy and sell premium professional documents |
| 2009-08-21 | Docstoc out of public beta, launching DocCash — get paid for uploading documents |
| 2009-09-29 | Docstoc at TechCrunch50 |
| 2010-02-10 | Docstoc releases public API |
| 2010-02-28 | Announcing the new marketplace for professional documents |
| 2010-05-14 | New partnership with Inc. Magazine |
| 2010-09-28 | Simplified add-to-cart and checkout |
| 2011-02-07 | New Docstoc homepage, tools and features |
| 2011-09-28 | Check out Docstoc's new Articles section |
| 2011-09-28 | Docstoc partners with online retailer Etsy |
| 2012-02-05 | 2 new apps released: copyright and SEO |
| 2012-03-13 | Docstoc unveils License123, wins award at launch |
| 2012-04-15 | Announcing weekly "DocDeals" |
| 2012-05-22 | Docstoc chosen for Windows 8 launch |
| 2014-04-09 | Intuit to acquire Docstoc |

**Pattern**: the blog is essentially a company-growth diary — product launches, funding announcements, weekly user contests (iPod Touch give-aways, "Featured Doc of the Day," "DocDeals"), viral/growth mechanics (embeds, Digg button, RSS), and a steady stream of distribution partnerships (Google Docs, Etsy, Inc. Magazine, Windows 8, Princeton Review/Sylvan/Living Language). Monetization evolves visibly over time: DocCash (2009, pay uploaders) → DocStore marketplace (2009) → License123 (2012, a spun-out legal-doc product) → acquisition (2014).

## Category / browse landing pages

Confirmed real facet values from the sample (capped at 3,000 rows / 2,708 distinct combos):

- **By state**: all 50 US states appear as top-level slugs (`alabama`, `alaska`, … ) and combined with doc-type (`alabama_legal-contract-agreement`, `alabama_sample-document`, `alabama_template-or-form`).
- **By business type**: `any-business-type` as a default/wildcard facet, crossed with every state AND with document type (`any-business-type_guide`, `any-business-type_report`, `any-business-type_legal-contract-agreement`, `any-business-type_sample-document`, `any-business-type_template-or-form`).
- **Document type facet values seen**: Legal Contract/Agreement, Sample Document, Template/Form, Guide, Report.
- This confirms the state × business-type × doc-type triple-facet matrix described in the earlier research report — at real scale, not just as an inferred pattern.

## Premium category pages (curated, "Docstoc Premium" subscription tier)

22 real category slugs recovered — a much smaller, curated set than the free `/browse/` matrix:

- Career Development and Finding a Job
- Contracting and Consulting
- Do-It-Yourself Legal — Business Affairs
- Do-It-Yourself Legal — Personal Affairs
- Estate Planning and Family Law
- Finance and Accounting
- Fundraising and Investing
- Personal and Professional Development
- Personal Finance and Financial Planning
- Real Estate Investing
- Running a Small Business
- Sales and Marketing
- Small Business HR
- Starting a Business
- Technology Resources
- Working in Online Businesses
- (plus utility pages: `confirmation`, `launch`, `offer(s)`, `questions`, `desktop`)

## Article & video pages

- `/article/{id}/{slug}`: **761+ distinct titles** recovered in a capped sample. Representative real titles: "4 Tips to Help Your Organization Deliver Results," "Electronic Payments for Small Business," "Implementing the 'Lean Startup' Method to Your Business," "Effective Ways to Increase Your Network on LinkedIn," "Elements of a Good Sales Proposal," "Employee vs Independent Contractor," "Advantages of an LLC over a Corporation," "First Steps in Getting a Bank Loan," "Building a Daily/Weekly/Monthly Cash Flow Sheet." Clear pattern: short, practical small-business/finance/legal explainer articles — adjacent to, but distinct from, the raw document templates.
- `/video/{id}/{slug}`: **798+ distinct titles** recovered. Representative: "How to Create a Site Map for Your Company Website," "4 Secrets to Creating the Perfect Logo," "3 Tips to Effectively Manage Offshore Talent," "Structuring a Board of Directors," "Earn-Outs: Selling Your Business," "Using Eventbrite to Promote Your Small Business." Same small-business/startup-advice focus as the articles, in video form — a real third content pillar alongside documents and articles.
- Some slugs in both sets are noise (`fonts`, raw CloudFront asset hashes) — filtered out of the representative lists above but present in the raw CDX data if needed.

## Notes

- CDX queries were capped at limit=2000–3000 per call to stay within a reasonable single-request size; several prefixes (`/browse`, `/article`, `/video`) hit the cap, meaning the true counts are higher than what's listed here — this is a representative sample, not an exhaustive census.
- The `archiveteam_docstoc` Internet Archive item was not fetched in this pass (time/budget-constrained) — it's a WARC-level capture that could contain the full raw HTML if deeper page-content analysis is wanted later.
- `docstoc.com/blog` (as opposed to `blog.docstoc.com`) is mostly legacy/dead paths (old `.aspx` blog system, RSS feeds, a couple of stray `/blogs/{username}/{date}/{slug}` user-blog posts from 2009–2010) — the real editorial blog is unambiguously on the subdomain.
