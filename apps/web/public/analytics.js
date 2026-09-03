(function () {
  var CONSENT_KEY = "docstoc_cookie_consent";
  var VISITOR_KEY = "docstoc_vid";
  var EXCLUDE_KEY = "docstoc_exclude_self";
  var initedConsented = false;

  function hasConsent() {
    try {
      if (localStorage.getItem(CONSENT_KEY) === "accepted") return true;
      if (localStorage.getItem("chasa_cookie_consent") === "accepted") {
        localStorage.setItem(CONSENT_KEY, "accepted");
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  function excludeSelf() {
    try {
      if (document.cookie.indexOf("docstoc_notrack=1") !== -1) return true;
      return localStorage.getItem(EXCLUDE_KEY) === "1";
    } catch (e) {
      return false;
    }
  }

  function visitorId() {
    try {
      var id = localStorage.getItem(VISITOR_KEY);
      if (!id) {
        id = (crypto.randomUUID && crypto.randomUUID()) || String(Date.now());
        localStorage.setItem(VISITOR_KEY, id);
      }
      return id;
    } catch (e) {
      return "anon";
    }
  }

  function track(name, properties) {
    if (excludeSelf()) return;
    var body = JSON.stringify({
      name: name,
      properties: properties || undefined,
      visitorId: visitorId(),
      path: location.pathname,
    });
    try {
      if (navigator.sendBeacon) {
        var blob = new Blob([body], { type: "application/json" });
        if (navigator.sendBeacon("/api/analytics/track", blob)) return;
      }
    } catch (e) {}
    fetch("/api/analytics/track", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: body,
      keepalive: true,
    }).catch(function () {});
  }

  function pageview() {
    if (excludeSelf()) return;
    var body = JSON.stringify({ path: location.pathname + location.search });
    try {
      if (navigator.sendBeacon) {
        var blob = new Blob([body], { type: "application/json" });
        if (navigator.sendBeacon("/api/analytics/pageview", blob)) return;
      }
    } catch (e) {}
    fetch("/api/analytics/pageview", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: body,
      keepalive: true,
    }).catch(function () {});
  }

  window.docstocTrack = track;
  window.docstocExcludeSelf = excludeSelf;

  // Marketing HTML is counted edge-side (Pages middleware → /api/analytics/pageview with
  // Referer) so Google/SEO landings show without cookie consent — same as Docracy. The
  // anonymous beacon here is only for the SPA (/app), which middleware does not track.
  if (location.pathname.indexOf("/app") === 0) {
    pageview();
  }

  function isAppLink(href) {
    if (!href) return false;
    try {
      var u = new URL(href, location.href);
      return u.pathname.indexOf("/app") === 0;
    } catch (e) {
      return href.indexOf("/app") === 0;
    }
  }

  /** Docracy-style seo-* campaign slug from the current marketing URL. */
  function seoCampaignFromPath(path) {
    var p = (path || location.pathname).replace(/\/+$/, "") || "/";
    if (p === "/") return null;
    var segs = p.split("/").filter(Boolean);
    var last = segs[segs.length - 1] || "";
    if (p.indexOf("/document-templates/") === 0 && segs.length >= 2 && last !== "document-templates") {
      return "seo-" + last.replace(/-template$/, "");
    }
    if (p.indexOf("/blog/") === 0 && segs.length >= 2) return "seo-blog-" + last;
    if (p.indexOf("/free-templates/") === 0 && segs.length >= 2) return "seo-" + last.replace(/\.html$/, "");
    if (p.indexOf("/guides/") === 0 && segs.length >= 2) return "seo-" + last;
    if (p.indexOf("/tools/") === 0 && segs.length >= 2) return "seo-tool-" + last.replace(/\.html$/, "");
    if (p.indexOf("/compare/") === 0 && segs.length >= 2) return "seo-compare-" + last;
    if (p.indexOf("/industry/") === 0 && segs.length >= 2) return "seo-industry-" + last;
    if (p.indexOf("/import-from-") === 0) return "seo-" + last;
    if (/-alternative$/.test(last)) return "seo-" + last;
    if (p.indexOf("/use-cases/") === 0 && segs.length >= 2) return "seo-" + last;
    if (p.indexOf("/features/") === 0 && segs.length >= 2) return "seo-" + last;
    return null;
  }

  function withSeoCampaign(href, campaign) {
    if (!campaign || !href) return href;
    try {
      var u = new URL(href, location.href);
      if (u.pathname.indexOf("/app") !== 0) return href;
      if (!u.searchParams.get("utm_source")) u.searchParams.set("utm_source", campaign);
      return u.pathname + u.search + u.hash;
    } catch (e) {
      return href;
    }
  }

  function campaignForCta(el, pageTag) {
    var tagged = el.closest ? el.closest("[data-cta-source]") : null;
    if (tagged) {
      var raw = tagged.getAttribute("data-cta-source") || "";
      if (raw) return "seo-" + raw.replace(/_/g, "-");
    }
    return pageTag;
  }

  /** Tag /app CTAs on SEO pages so signup carries utm_source=seo-{slug} (Docracy parity). */
  function wireSeoCampaignCtAs() {
    var pageTag = seoCampaignFromPath(location.pathname);
    if (!pageTag) return;

    function decorate(el) {
      var href = el.getAttribute("href");
      if (!isAppLink(href)) return;
      var next = withSeoCampaign(href, campaignForCta(el, pageTag));
      if (next !== href) el.setAttribute("href", next);
    }

    document.querySelectorAll("a[href]").forEach(decorate);

    document.addEventListener(
      "click",
      function (e) {
        var el = e.target && e.target.closest ? e.target.closest("a[href]") : null;
        if (!el) return;
        if (!isAppLink(el.getAttribute("href"))) return;
        decorate(el);
      },
      true
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wireSeoCampaignCtAs);
  } else {
    wireSeoCampaignCtAs();
  }

  /** Everything that needs consent — called immediately if consent already exists at load time,
   *  and re-callable (via window.docstocInitAnalytics) from the cookie banner's Accept handler for
   *  a visitor who consents mid-session, since this script itself now always loads regardless of
   *  consent state and only runs this once. */
  function initConsented() {
    if (initedConsented || !hasConsent()) return;
    initedConsented = true;

    // Microsoft Clarity (session heatmaps) — same consent gate as first-party event analytics.
    if (!document.querySelector('script[data-docstoc-clarity-loader],script[data-docstoc-clarity]')) {
      var clarityLoader = document.createElement("script");
      clarityLoader.src = "/clarity.js";
      clarityLoader.async = true;
      clarityLoader.setAttribute("data-docstoc-clarity-loader", "1");
      document.body.appendChild(clarityLoader);
    } else if (typeof window.docstocLoadClarity === "function") {
      window.docstocLoadClarity();
    }

    var path = location.pathname.replace(/\/+$/, "") || "/";
    var slug = path.split("/").pop() || "";

    track("page_viewed", { path: path });

    // referral_source_detected is written edge-side from the Pages middleware (x-referrer +
    // utm query) so organic Google / SEO clicks appear without accepting cookies. Do not
    // re-fire it here or consented visitors would double-count in Admin → Traffic sources.

    if (path === "/") {
      track("landingpage_loaded");
    } else if (path.indexOf("/blog") === 0) {
      track("blog_article_loaded", { slug: slug });
    }

    var scrollMarks = { 25: false, 50: false, 75: false, 100: false };

    function scrollDepth() {
      var doc = document.documentElement;
      var scrollTop = window.pageYOffset || doc.scrollTop || 0;
      var height = Math.max(doc.scrollHeight - window.innerHeight, 1);
      var pct = Math.min(100, Math.round((scrollTop / height) * 100));
      [25, 50, 75, 100].forEach(function (mark) {
        if (!scrollMarks[mark] && pct >= mark) {
          scrollMarks[mark] = true;
          track("scroll_depth_reached", { depth: mark, path: path });
        }
      });
    }

    window.addEventListener("scroll", scrollDepth, { passive: true });
    scrollDepth();

    /** Which placement a CTA click came from, so one spot's pull can be compared against another's
     *  — the click events on their own only say that *something* on the page was clicked. Marketing
     *  pages opt in with data-cta-source; the header and footer are shared chrome on every page. */
    function ctaSource(el) {
      var tagged = el.closest ? el.closest("[data-cta-source]") : null;
      if (tagged) return tagged.getAttribute("data-cta-source") || "body";
      if (el.closest && el.closest("header")) return "nav";
      if (el.closest && el.closest("footer")) return "footer";
      return "body";
    }

    document.addEventListener("click", function (e) {
      var el = e.target && e.target.closest ? e.target.closest("a, button") : null;
      if (!el) return;
      var href = (el.getAttribute("href") || "").toLowerCase();
      var text = (el.textContent || "").trim().toLowerCase();
      // data-cta / data-cta-source is an explicit opt-in, checked first: the keyword matching
      // below silently misses any CTA that isn't worded like the ones that existed when it was
      // written (the hero's templates link went untracked for exactly that reason), and renaming
      // a button should never quietly delete a metric.
      var isCta =
        (el.closest && el.closest("[data-cta], [data-cta-source]") !== null) ||
        el.classList.contains("nav-cta") ||
        href.indexOf("/app") === 0 ||
        text.indexOf("try free") !== -1 ||
        text.indexOf("start free") !== -1 ||
        text.indexOf("get solo") !== -1 ||
        text.indexOf("get pro") !== -1 ||
        text.indexOf("get enterprise") !== -1;

      if (path.indexOf("/blog") === 0 && isCta) {
        track("blog_cta_clicked", { href: href || undefined, text: text.slice(0, 80), source: ctaSource(el) });
        return;
      }
      if (isCta) {
        track("landingpage_cta_clicked", { href: href || undefined, text: text.slice(0, 80), source: ctaSource(el) });
      }
    });

    if (path === "/free-templates") {
      track("template_category_viewed", { category: "invoice-reminders" });
    } else if (path.indexOf("/free-templates/") === 0) {
      var used = false;
      track("template_opened", { slug: slug });
      track("template_preview_opened", { slug: slug });

      document.querySelectorAll(".btn-copy").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var text = decodeURIComponent(btn.getAttribute("data-copy") || "");
          navigator.clipboard.writeText(text).then(
            function () {
              used = true;
              btn.textContent = "Copied";
              setTimeout(function () {
                btn.textContent = "Copy subject + body";
              }, 1500);
              track("template_used", { slug: slug });
              track("template_started", { slug: slug });
              track("template_completed", { slug: slug, method: "copy" });
            },
            function () {
              track("send_failed", { source: "template_copy", slug: slug });
            }
          );
        });
      });

      window.addEventListener("pagehide", function () {
        if (!used) track("template_abandoned", { slug: slug });
      });
    }
  }

  window.docstocInitAnalytics = initConsented;
  initConsented();
})();
