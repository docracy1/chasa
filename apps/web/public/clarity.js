/** Microsoft Clarity — load only after analytics cookie consent. Project: Chasa (xtl7mhg00w). */
(function () {
  var PROJECT_ID = "xtl7mhg00w";
  var CONSENT_KEY = "chasa_cookie_consent";
  var EXCLUDE_KEY = "chasa_exclude_self";

  function hasConsent() {
    try {
      return localStorage.getItem(CONSENT_KEY) === "accepted";
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

  function loadClarity() {
    if (!hasConsent() || excludeSelf()) return;
    if (document.querySelector('script[data-chasa-clarity]')) return;
    if (typeof window.clarity === "function") return;

    (function (c, l, a, r, i, t, y) {
      c[a] =
        c[a] ||
        function () {
          (c[a].q = c[a].q || []).push(arguments);
        };
      t = l.createElement(r);
      t.async = 1;
      t.src = "https://www.clarity.ms/tag/" + i;
      t.setAttribute("data-chasa-clarity", "1");
      y = l.getElementsByTagName(r)[0];
      y.parentNode.insertBefore(t, y);
    })(window, document, "clarity", "script", PROJECT_ID);
  }

  window.chasaLoadClarity = loadClarity;
  loadClarity();
})();
