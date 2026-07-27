(function () {
  var CONSENT_KEY = "chasa_cookie_consent";
  var STYLE_ID = "chasa-cookie-consent-style";

  function getConsent() {
    try {
      return localStorage.getItem(CONSENT_KEY);
    } catch (e) {
      return null;
    }
  }

  function setConsent(value) {
    try {
      localStorage.setItem(CONSENT_KEY, value);
    } catch (e) {}
  }

  function loadAnalytics() {
    if (document.querySelector('script[data-chasa-analytics]')) return;
    var s = document.createElement("script");
    s.src = "/analytics.js";
    s.async = true;
    s.setAttribute("data-chasa-analytics", "1");
    document.body.appendChild(s);
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent =
      ".chasa-cookie-banner{position:fixed;bottom:0;left:0;right:0;z-index:9999;padding:16px 20px;background:var(--ink,#1a1a1a);color:var(--white,#fff);box-shadow:0 -4px 24px rgba(0,0,0,.18);font-family:Inter,sans-serif;font-size:14px;line-height:1.5}" +
      ".chasa-cookie-inner{max-width:1100px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}" +
      ".chasa-cookie-inner p{margin:0;flex:1;min-width:220px;color:color-mix(in srgb,var(--white,#fff) 88%,transparent)}" +
      ".chasa-cookie-inner a{color:var(--accent,#c45c26);font-weight:600;text-decoration:none}" +
      ".chasa-cookie-inner a:hover{text-decoration:underline}" +
      ".chasa-cookie-actions{display:flex;gap:10px;flex-shrink:0}" +
      ".chasa-cookie-btn{font-family:Inter,sans-serif;font-size:13px;font-weight:600;padding:10px 16px;border-radius:4px;border:1.5px solid transparent;cursor:pointer}" +
      ".chasa-cookie-accept{background:var(--accent,#c45c26);color:var(--white,#fff);border-color:var(--accent,#c45c26)}" +
      ".chasa-cookie-decline{background:transparent;color:var(--white,#fff);border-color:color-mix(in srgb,var(--white,#fff) 35%,transparent)}";
    document.head.appendChild(style);
  }

  function showBanner() {
    injectStyles();
    var banner = document.createElement("div");
    banner.className = "chasa-cookie-banner";
    banner.setAttribute("role", "dialog");
    banner.setAttribute("aria-modal", "true");
    banner.innerHTML =
      '<div class="chasa-cookie-inner">' +
      '<p>We use cookies for anonymous analytics to improve Chasa. See our <a href="/privacy">Privacy policy</a>.</p>' +
      '<div class="chasa-cookie-actions">' +
      '<button type="button" class="chasa-cookie-btn chasa-cookie-decline">Decline</button>' +
      '<button type="button" class="chasa-cookie-btn chasa-cookie-accept">Accept</button>' +
      "</div></div>";
    document.body.appendChild(banner);
    var acceptBtn = banner.querySelector(".chasa-cookie-accept");
    if (acceptBtn && acceptBtn.focus) acceptBtn.focus();
    banner.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        setConsent("declined");
        banner.remove();
      }
    });

    banner.querySelector(".chasa-cookie-accept").addEventListener("click", function () {
      setConsent("accepted");
      banner.remove();
      loadAnalytics();
    });
    banner.querySelector(".chasa-cookie-decline").addEventListener("click", function () {
      setConsent("declined");
      banner.remove();
    });
  }

  var consent = getConsent();
  if (consent === "accepted") {
    loadAnalytics();
  } else if (!consent) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", showBanner);
    } else {
      showBanner();
    }
  }
})();
