(function () {
  if (window.__chasaAssistant) return;
  window.__chasaAssistant = true;

  var SALES = "sales@" + "chasa.io";
  var JOKES = [
    "Why did the freelancer chase the invoice? Because it was outstanding.",
    "I told my unpaid invoice a joke. Still no response — tough crowd.",
    "What's a freelancer's favorite cardio? Chase-ups.",
    "Accounting tip: if the check is in the mail, check your spam — and your patience.",
  ];
  var JOKES_ES = [
    "¿Por qué el freelancer persiguió la factura? Porque estaba outstanding.",
    "Le conté un chiste a mi factura impaga. Todavía no responde — público difícil.",
    "¿El cardio favorito de un freelancer? Los follow-ups.",
  ];

  var CSS =
    ".chasa-asst{position:fixed;right:20px;bottom:20px;z-index:99999;font-family:Inter,system-ui,-apple-system,sans-serif;}" +
    ".chasa-asst-fab{width:56px;height:56px;border-radius:999px;border:0;background:#C24A28;color:#fff;cursor:pointer;" +
    "display:grid;place-items:center;box-shadow:0 8px 24px rgba(194,74,40,.28);padding:0;line-height:1;}" +
    ".chasa-asst-fab img{display:block;width:22px;height:22px;}" +
    ".chasa-asst-fab.is-open{background:#EC683C;font-size:28px;font-weight:300;}" +
    ".chasa-asst-panel{position:absolute;right:0;bottom:70px;width:min(360px,calc(100vw - 32px));" +
    "background:#fff;border-radius:16px;box-shadow:0 16px 48px rgba(42,20,16,.22);" +
    "overflow:hidden;border:1px solid rgba(42,20,16,.08);}" +
    ".chasa-asst-panel[hidden]{display:none!important;}" +
    ".chasa-asst-head{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;background:#C24A28;color:#fff;}" +
    ".chasa-asst-title{display:flex;align-items:center;gap:8px;font-weight:700;font-size:14px;}" +
    ".chasa-asst-title img{width:18px;height:18px;border-radius:999px;background:#fff;padding:2px;box-sizing:border-box;}" +
    ".chasa-asst-x{background:none;border:0;color:#fff;font-size:22px;cursor:pointer;line-height:1;opacity:.85;padding:0 2px;}" +
    ".chasa-asst-x:hover{opacity:1;}" +
    ".chasa-asst-body{padding:14px;max-height:min(460px,62vh);overflow:auto;display:flex;flex-direction:column;gap:10px;background:#F7F3F0;}" +
    ".chasa-asst-msg{padding:10px 12px;border-radius:12px;font-size:13.5px;line-height:1.45;max-width:95%;}" +
    ".chasa-asst-msg.bot{background:#fff;color:#2A1410;align-self:flex-start;}" +
    ".chasa-asst-msg.user{background:#EC683C;color:#fff;align-self:flex-end;}" +
    ".chasa-asst-msg a{color:#C24A28;font-weight:700;}" +
    ".chasa-asst-msg.user a{color:#fff;text-decoration:underline;}" +
    ".chasa-asst-chips{display:flex;flex-direction:column;gap:8px;}" +
    ".chasa-asst-chips button,.chasa-asst-link{display:block;width:100%;text-align:left;padding:10px 12px;" +
    "border:1px solid #e8ddd6;border-radius:10px;background:#fff;font:inherit;font-size:13.5px;" +
    "cursor:pointer;color:#2A1410;text-decoration:none;box-sizing:border-box;}" +
    ".chasa-asst-chips button:hover,.chasa-asst-link:hover{border-color:#EC683C;}" +
    ".chasa-asst-form{display:flex;flex-direction:column;gap:8px;margin-top:4px;}" +
    ".chasa-asst-form input,.chasa-asst-form textarea{width:100%;box-sizing:border-box;border:1px solid #e8ddd6;" +
    "border-radius:10px;padding:10px 12px;font:inherit;font-size:13.5px;color:#2A1410;background:#fff;}" +
    ".chasa-asst-form textarea{min-height:72px;resize:vertical;}" +
    ".chasa-asst-form input:focus,.chasa-asst-form textarea:focus{outline:2px solid rgba(236,104,60,.35);border-color:#EC683C;}" +
    ".chasa-asst-form button[type=submit]{border:0;border-radius:10px;padding:10px 12px;font:inherit;font-size:13.5px;" +
    "font-weight:700;cursor:pointer;background:#00E8A8;color:#04241C;}" +
    ".chasa-asst-form button[type=submit]:disabled{opacity:.6;cursor:wait;}" +
    ".chasa-asst-err{color:#b42318;font-size:12.5px;}";

  function t(key, fallback) {
    try {
      var lang = window.chasaSiteLang;
      if (lang && typeof lang.t === "function") {
        var v = lang.t(key);
        if (v && v !== key) return v;
      }
    } catch (e) {}
    return fallback;
  }

  function isEs() {
    try {
      return window.chasaSiteLang && window.chasaSiteLang.locale() === "es";
    } catch (e) {
      return false;
    }
  }

  function ensureStyles() {
    if (document.getElementById("chasa-asst-css")) return;
    var style = document.createElement("style");
    style.id = "chasa-asst-css";
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function mount() {
    if (!document.body) return;
    ensureStyles();
    if (document.querySelector(".chasa-asst")) return;

    var root = document.createElement("div");
    root.className = "chasa-asst";
    root.innerHTML =
      '<button type="button" class="chasa-asst-fab" aria-label="Open Chasa Assistant" data-asst-toggle>' +
      '<img src="/brand/chasa-icon.png" alt="" width="22" height="22" />' +
      "</button>" +
      '<div class="chasa-asst-panel" hidden data-asst-panel>' +
      '<div class="chasa-asst-head">' +
      '<div class="chasa-asst-title"><img src="/brand/chasa-icon.png" alt="" width="18" height="18" /> ' +
      '<span data-asst-title>Chasa Assistant</span></div>' +
      '<button type="button" class="chasa-asst-x" aria-label="Close" data-asst-toggle>×</button>' +
      "</div>" +
      '<div class="chasa-asst-body" data-asst-body></div>' +
      "</div>";
    document.body.appendChild(root);

    var panel = root.querySelector("[data-asst-panel]");
    var body = root.querySelector("[data-asst-body]");
    var fab = root.querySelector(".chasa-asst-fab");
    var titleEl = root.querySelector("[data-asst-title]");
    var open = false;
    var formVisible = false;

    function bubble(text, who, opts) {
      var d = document.createElement("div");
      d.className = "chasa-asst-msg " + (who || "bot");
      if (opts && opts.href && opts.hrefLabel) {
        d.appendChild(document.createTextNode(text + " "));
        var a = document.createElement("a");
        a.href = opts.href;
        a.textContent = opts.hrefLabel;
        d.appendChild(a);
      } else {
        d.textContent = text;
      }
      body.appendChild(d);
      body.scrollTop = body.scrollHeight;
    }

    function chips(items) {
      var wrap = document.createElement("div");
      wrap.className = "chasa-asst-chips";
      items.forEach(function (item) {
        var b = document.createElement("button");
        b.type = "button";
        b.textContent = item.label;
        b.addEventListener("click", function () {
          wrap.remove();
          bubble(item.label, "user");
          item.fn();
        });
        wrap.appendChild(b);
      });
      body.appendChild(wrap);
      body.scrollTop = body.scrollHeight;
    }

    function linkBtn(label, href) {
      var a = document.createElement("a");
      a.className = "chasa-asst-link";
      a.href = href;
      a.textContent = label;
      body.appendChild(a);
    }

    function showContactForm() {
      if (formVisible) return;
      formVisible = true;
      var form = document.createElement("form");
      form.className = "chasa-asst-form";
      form.innerHTML =
        '<input type="email" name="email" required autocomplete="email" placeholder="' +
        t("chat.emailPlaceholder", "you@email.com") +
        '" aria-label="' +
        t("chat.yourEmail", "Your email") +
        '" />' +
        '<textarea name="message" required placeholder="' +
        t("chat.messagePlaceholder", "What's on your mind") +
        '" aria-label="' +
        t("chat.yourMessage", "Your message") +
        '"></textarea>' +
        '<button type="submit">' +
        t("chat.send", "Send message") +
        "</button>" +
        '<div class="chasa-asst-err" hidden data-asst-err></div>';

      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var email = String(form.email.value || "").trim();
        var message = String(form.message.value || "").trim();
        var err = form.querySelector("[data-asst-err]");
        var btn = form.querySelector('button[type="submit"]');
        if (!email || !message) return;
        err.hidden = true;
        btn.disabled = true;
        btn.textContent = t("chat.sending", "Sending…");

        fetch("/api/leads/contact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email, message: message }),
        })
          .then(function (res) {
            return res.json().then(function (data) {
              if (!res.ok) throw new Error((data && data.error) || t("chat.error", "Something went wrong."));
              return data;
            });
          })
          .then(function () {
            form.remove();
            formVisible = false;
            bubble(message, "user");
            bubble(t("chat.thanks", "Thanks — got it. We'll reply by email."));
          })
          .catch(function (errObj) {
            // Fallback: open mail client if API unavailable
            var subject = encodeURIComponent("Chasa sales inquiry");
            var bodyText = encodeURIComponent("From: " + email + "\n\n" + message);
            window.location.href = "mailto:" + SALES + "?subject=" + subject + "&body=" + bodyText;
            form.remove();
            formVisible = false;
            bubble(message, "user");
            bubble(t("chat.thanks", "Thanks — got it. We'll reply by email."));
            if (err) {
              /* ignore — mailto fallback */
            }
            void errObj;
          })
          .finally(function () {
            btn.disabled = false;
            btn.textContent = t("chat.send", "Send message");
          });
      });

      body.appendChild(form);
      body.scrollTop = body.scrollHeight;
      form.querySelector("input").focus();
    }

    function showSalesFlow(opts) {
      opts = opts || {};
      formVisible = false;
      body.innerHTML = "";
      if (titleEl) titleEl.textContent = t("chat.title", "Chasa Assistant");

      if (opts.skipGreeting) {
        bubble(t("chat.greeting", "Hey there 👋 I can help you find the right thing:"));
        bubble(t("chat.sales", "I want to talk to sales"), "user");
      }

      bubble(t("chat.salesReply", "Reach the team directly and we'll get back to you fast:"), "bot", {
        href: "mailto:" + SALES + "?subject=" + encodeURIComponent("Chasa sales"),
        hrefLabel: SALES,
      });
      showContactForm();
    }

    function showHome() {
      formVisible = false;
      body.innerHTML = "";
      if (titleEl) titleEl.textContent = t("chat.title", "Chasa Assistant");
      bubble(t("chat.greeting", "Hey there 👋 I can help you find the right thing:"));
      chips([
        {
          label: t("chat.sales", "I want to talk to sales"),
          fn: function () {
            bubble(t("chat.salesReply", "Reach the team directly and we'll get back to you fast:"), "bot", {
              href: "mailto:" + SALES + "?subject=" + encodeURIComponent("Chasa sales"),
              hrefLabel: SALES,
            });
            showContactForm();
          },
        },
        {
          label: t("chat.support", "I need customer support"),
          fn: function () {
            bubble(t("chat.formReply", "Sure — leave your email and what's up, and we'll get back to you."));
            showContactForm();
          },
        },
        {
          label: t("chat.joke", "Tell me a joke"),
          fn: function () {
            var list = isEs() ? JOKES_ES : JOKES;
            bubble(list[Math.floor(Math.random() * list.length)]);
            chips([
              {
                label: t("chat.anotherJoke", "Another joke"),
                fn: function () {
                  bubble(list[Math.floor(Math.random() * list.length)]);
                },
              },
              { label: t("chat.back", "Back to menu"), fn: showHome },
            ]);
          },
        },
        {
          label: t("chat.other", "I need something else"),
          fn: function () {
            bubble(t("chat.formReply", "Sure — leave your email and what's up, and we'll get back to you."));
            linkBtn(t("chat.tryFree", "Try Chasa free"), "/app/");
            showContactForm();
          },
        },
      ]);
    }

    function setOpen(v, opts) {
      open = v;
      panel.hidden = !open;
      fab.classList.toggle("is-open", open);
      fab.setAttribute(
        "aria-label",
        open ? t("chat.close", "Close chat") : t("chat.open", "Open chat")
      );
      fab.innerHTML = open
        ? "×"
        : '<img src="/brand/chasa-icon.png" alt="" width="22" height="22" />';
      if (open) {
        if (opts && opts.intent === "sales") {
          showSalesFlow({ skipGreeting: true });
        } else if (!body.childNodes.length) {
          showHome();
        }
      }
    }

    function openAssistant(opts) {
      setOpen(true, opts || {});
    }

    root.querySelectorAll("[data-asst-toggle]").forEach(function (el) {
      el.addEventListener("click", function () {
        if (open) setOpen(false);
        else openAssistant();
      });
    });

    window.addEventListener("chasa:open-chat", function (ev) {
      var detail = (ev && ev.detail) || {};
      openAssistant({ intent: detail.intent || null });
    });

    window.chasaAssistant = {
      open: openAssistant,
      close: function () {
        setOpen(false);
      },
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();
