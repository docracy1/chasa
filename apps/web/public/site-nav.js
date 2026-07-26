(function () {
  var btn = document.querySelector("[data-menu-toggle]");
  var menu = document.querySelector("[data-mobile-menu]");
  if (!btn || !menu) return;
  btn.addEventListener("click", function () {
    var open = menu.classList.toggle("is-open");
    btn.setAttribute("aria-expanded", open ? "true" : "false");
    btn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  });
  menu.querySelectorAll("a").forEach(function (a) {
    a.addEventListener("click", function () {
      menu.classList.remove("is-open");
      btn.setAttribute("aria-expanded", "false");
    });
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
