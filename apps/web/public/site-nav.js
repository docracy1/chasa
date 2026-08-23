(function () {
  var btn = document.querySelector("[data-menu-toggle]");
  var panel = document.querySelector("[data-mobile-panel]");
  var backdrop = document.querySelector("[data-mobile-backdrop]");
  var closeBtn = document.querySelector("[data-mobile-close]");
  if (btn && panel) {
    function menuAriaLabel(open) {
      var lang = window.chasaSiteLang;
      if (lang && lang.t) return lang.t(open ? "nav.closeMenu" : "nav.openMenu");
      return open ? "Close menu" : "Open menu";
    }

    function openPanel() {
      panel.classList.add("is-open");
      if (backdrop) backdrop.classList.add("is-open");
      btn.setAttribute("aria-expanded", "true");
      btn.setAttribute("aria-label", menuAriaLabel(true));
    }

    function closePanel() {
      panel.classList.remove("is-open");
      if (backdrop) backdrop.classList.remove("is-open");
      btn.setAttribute("aria-expanded", "false");
      btn.setAttribute("aria-label", menuAriaLabel(false));
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
  }
})();

/* Header mega-menus (Features / Use Cases / Resources) — hover-intent open, click toggles for touch. */
(function () {
  var OPEN_CLASS = "is-open";

  function closeMenu(root) {
    var panel = root.querySelector("[data-mega-panel]");
    var trigger = root.querySelector("[data-mega-trigger]");
    var chevron = root.querySelector(".nav-megamenu-chevron");
    if (panel) panel.hidden = true;
    if (trigger) trigger.setAttribute("aria-expanded", "false");
    if (chevron) chevron.classList.remove("is-open");
    root.classList.remove(OPEN_CLASS);
  }

  function closeAll(except) {
    document.querySelectorAll("[data-mega-menu]").forEach(function (root) {
      if (root !== except) closeMenu(root);
    });
  }

  function openMenu(root) {
    closeAll(root);
    var panel = root.querySelector("[data-mega-panel]");
    var trigger = root.querySelector("[data-mega-trigger]");
    var chevron = root.querySelector(".nav-megamenu-chevron");
    if (panel) panel.hidden = false;
    if (trigger) trigger.setAttribute("aria-expanded", "true");
    if (chevron) chevron.classList.add("is-open");
    root.classList.add(OPEN_CLASS);
  }

  document.querySelectorAll("[data-mega-menu]").forEach(function (root) {
    var trigger = root.querySelector("[data-mega-trigger]");
    if (!trigger) return;
    var closeTimer = null;

    function clearCloseTimer() {
      if (closeTimer) {
        clearTimeout(closeTimer);
        closeTimer = null;
      }
    }

    root.addEventListener("mouseenter", function () {
      clearCloseTimer();
      openMenu(root);
    });
    root.addEventListener("mouseleave", function () {
      clearCloseTimer();
      closeTimer = setTimeout(function () {
        closeMenu(root);
      }, 150);
    });
    trigger.addEventListener("click", function (e) {
      e.stopPropagation();
      var isOpen = root.classList.contains(OPEN_CLASS);
      if (isOpen) closeMenu(root);
      else openMenu(root);
    });
  });

  document.addEventListener("click", function (e) {
    if (!e.target.closest || !e.target.closest("[data-mega-menu]")) closeAll();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeAll();
  });
})();

/* Contact sales → open docstoc Assistant with sales intent (Docracy pattern). */
(function () {
  function openSalesChat(e) {
    if (e) e.preventDefault();
    window.dispatchEvent(new CustomEvent("chasa:open-chat", { detail: { intent: "sales" } }));
  }

  function bind(selector) {
    document.querySelectorAll(selector).forEach(function (el) {
      el.setAttribute("href", "#contact-sales");
      el.addEventListener("click", openSalesChat);
    });
  }

  bind(".header-nav-sales");
  bind(".mobile-panel-ctas a[data-i18n='nav.contactSales']");
  bind("a[data-i18n='home.pricing.contactSales']");
  bind("[data-sales-mail]");
})();

(function () {
  if (window.__chasaAssistant || document.querySelector('script[src*="assistant.js"]')) return;
  function inject() {
    if (!document.body) return;
    var selfScript = document.querySelector('script[src*="site-nav.js"]');
    var vMatch = selfScript && selfScript.src && selfScript.src.match(/[?&]v=([^&]+)/);
    var s = document.createElement("script");
    s.src = "/assistant.js" + (vMatch ? "?v=" + vMatch[1] : "");
    s.defer = true;
    document.body.appendChild(s);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", inject);
  } else {
    inject();
  }
})();
