(function () {
  var CONSENT_KEY = "docstoc_cookie_consent";
  var VISITOR_KEY = "docstoc_vid";
  var REFERRAL_KEY = "docstoc_ref_tracked";
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

  // Aggregate page-view counting (just the path and the day — no cookie, no visitor ID, no IP
  // stored) doesn't need cookie consent under ePrivacy's anonymous-statistics carve-out, so this
  // fires unconditionally, on every load of this script. Everything in initConsented() below
  // carries a per-browser visitor ID (track()) or is a full session recording (Clarity), so it
  // stays behind the consent gate and only runs once consent actually exists.
  pageview();

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

    function detectReferral() {
      try {
        if (sessionStorage.getItem(REFERRAL_KEY)) return;
        sessionStorage.setItem(REFERRAL_KEY, "1");
      } catch (e) {}

      var params = new URLSearchParams(location.search);
      var utm = params.get("utm_source");
      var refParam = params.get("ref") || params.get("who");
      var ref = document.referrer || "";
      var source = "direct";
      var lower = ref.toLowerCase();
      if (utm) source = utm.toLowerCase();
      else if (refParam) source = String(refParam).toLowerCase().slice(0, 64);
      else if (lower.indexOf("linkedin.com") !== -1) source = "linkedin";
      else if (lower.indexOf("google.") !== -1) source = "google";
      else if (ref && lower.indexOf(location.host) === -1) source = "referral";
      else if (ref) source = "internal";

      track("referral_source_detected", {
        source: source,
        referrer: ref ? ref.slice(0, 200) : undefined,
        utm_source: utm || undefined,
        utm_medium: params.get("utm_medium") || undefined,
        utm_campaign: params.get("utm_campaign") || undefined,
        who: params.get("who") || undefined,
      });
    }

    detectReferral();

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
              track("chase_sent", { method: "copy", source: "template", slug: slug });
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
