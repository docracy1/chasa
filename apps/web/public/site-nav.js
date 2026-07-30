(function () {
  var btn = document.querySelector("[data-menu-toggle]");
  var panel = document.querySelector("[data-mobile-panel]");
  var backdrop = document.querySelector("[data-mobile-backdrop]");
  var closeBtn = document.querySelector("[data-mobile-close]");
  if (!btn || !panel) return;

  function openPanel() {
    panel.classList.add("is-open");
    if (backdrop) backdrop.classList.add("is-open");
    btn.setAttribute("aria-expanded", "true");
    btn.setAttribute("aria-label", "Close menu");
  }

  function closePanel() {
    panel.classList.remove("is-open");
    if (backdrop) backdrop.classList.remove("is-open");
    btn.setAttribute("aria-expanded", "false");
    btn.setAttribute("aria-label", "Open menu");
  }

  btn.addEventListener("click", function () {
    if (panel.classList.contains("is-open")) closePanel();
    else openPanel();
  });

  if (closeBtn) closeBtn.addEventListener("click", closePanel);
  if (backdrop) backdrop.addEventListener("click", closePanel);

  panel.querySelectorAll("a").forEach(function (a) {
    a.addEventListener("click", closePanel);
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closePanel();
  });
})();

(function () {
  if (window.__chasaAssistant || document.querySelector('script[src="/assistant.js"]')) return;
  function inject() {
    if (!document.body) return;
    var s = document.createElement("script");
    s.src = "/assistant.js";
    s.defer = true;
    document.body.appendChild(s);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", inject);
  } else {
    inject();
  }
})();
