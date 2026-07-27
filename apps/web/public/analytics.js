(function () {
  var CONSENT_KEY = "chasa_cookie_consent";
  var VISITOR_KEY = "chasa_vid";
  var REFERRAL_KEY = "chasa_ref_tracked";
  var EXCLUDE_KEY = "chasa_exclude_self";

  function hasConsent() {
    try {
      return localStorage.getItem(CONSENT_KEY) === "accepted";
    } catch (e) {
      return false;
    }
  }

  if (!hasConsent()) return;

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

  window.chasaTrack = track;
  window.chasaExcludeSelf = excludeSelf;

  var path = location.pathname.replace(/\/+$/, "") || "/";
  var slug = path.split("/").pop() || "";

  pageview();
  track("page_viewed", { path: path });

  function detectReferral() {
    try {
      if (sessionStorage.getItem(REFERRAL_KEY)) return;
      sessionStorage.setItem(REFERRAL_KEY, "1");
    } catch (e) {}

    var params = new URLSearchParams(location.search);
    var utm = params.get("utm_source");
    var ref = document.referrer || "";
    var source = "direct";
    var lower = ref.toLowerCase();
    if (utm) source = utm.toLowerCase();
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

  document.addEventListener("click", function (e) {
    var el = e.target && e.target.closest ? e.target.closest("a, button") : null;
    if (!el) return;
    var href = (el.getAttribute("href") || "").toLowerCase();
    var text = (el.textContent || "").trim().toLowerCase();
    var isCta =
      el.classList.contains("nav-cta") ||
      href.indexOf("/app") === 0 ||
      text.indexOf("try free") !== -1 ||
      text.indexOf("start free") !== -1 ||
      text.indexOf("get solo") !== -1 ||
      text.indexOf("get pro") !== -1 ||
      text.indexOf("get enterprise") !== -1;

    if (path.indexOf("/blog") === 0 && isCta) {
      track("blog_cta_clicked", { href: href || undefined, text: text.slice(0, 80) });
      return;
    }
    if (isCta) {
      track("landingpage_cta_clicked", { href: href || undefined, text: text.slice(0, 80) });
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
})();
