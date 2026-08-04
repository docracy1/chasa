(function () {
  if (window.__chasaAssistant) return;
  window.__chasaAssistant = true;

  var JOKES = [
    "Why did the freelancer chase the invoice? Because it was outstanding.",
    "I told my unpaid invoice a joke. Still no response — tough crowd.",
    "What's a freelancer's favorite cardio? Chase-ups.",
    "Accounting tip: if the check is in the mail, check your spam — and your patience.",
  ];

  var CSS =
    ".chasa-asst{position:fixed;right:20px;bottom:20px;z-index:99999;font-family:Inter,system-ui,-apple-system,sans-serif;}" +
    ".chasa-asst-fab{width:56px;height:56px;border-radius:999px;border:0;background:#C24A28;color:#fff;cursor:pointer;" +
    "display:grid;place-items:center;box-shadow:0 8px 24px rgba(194,74,40,.28);padding:0;line-height:1;}" +
    ".chasa-asst-fab img{display:block;width:22px;height:22px;}" +
    ".chasa-asst-fab.is-open{background:#EC683C;font-size:28px;font-weight:300;}" +
    ".chasa-asst-panel{position:absolute;right:0;bottom:70px;width:min(340px,calc(100vw - 32px));" +
    "background:#fff;border-radius:16px;box-shadow:0 16px 48px rgba(42,20,16,.22);" +
    "overflow:hidden;border:1px solid rgba(42,20,16,.08);}" +
    ".chasa-asst-panel[hidden]{display:none!important;}" +
    ".chasa-asst-head{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;background:#C24A28;color:#fff;}" +
    ".chasa-asst-title{display:flex;align-items:center;gap:8px;font-weight:700;font-size:14px;}" +
    ".chasa-asst-title img{width:18px;height:18px;border-radius:999px;background:#fff;padding:2px;box-sizing:border-box;}" +
    ".chasa-asst-x{background:none;border:0;color:#fff;font-size:22px;cursor:pointer;line-height:1;opacity:.85;padding:0 2px;}" +
    ".chasa-asst-x:hover{opacity:1;}" +
    ".chasa-asst-body{padding:14px;max-height:min(420px,60vh);overflow:auto;display:flex;flex-direction:column;gap:10px;background:#F7F3F0;}" +
    ".chasa-asst-msg{padding:10px 12px;border-radius:12px;font-size:13.5px;line-height:1.45;max-width:95%;}" +
    ".chasa-asst-msg.bot{background:#fff;color:#2A1410;align-self:flex-start;}" +
    ".chasa-asst-msg.user{background:#fde8e0;color:#2A1410;align-self:flex-end;}" +
    ".chasa-asst-chips{display:flex;flex-direction:column;gap:8px;}" +
    ".chasa-asst-chips button,.chasa-asst-link{display:block;width:100%;text-align:left;padding:10px 12px;" +
    "border:1px solid #e8ddd6;border-radius:10px;background:#fff;font:inherit;font-size:13.5px;" +
    "cursor:pointer;color:#2A1410;text-decoration:none;box-sizing:border-box;}" +
    ".chasa-asst-chips button:hover,.chasa-asst-link:hover{border-color:#EC683C;}";

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
      '<div class="chasa-asst-title"><img src="/brand/chasa-icon.png" alt="" width="18" height="18" /> Chasa Assistant</div>' +
      '<button type="button" class="chasa-asst-x" aria-label="Close" data-asst-toggle>×</button>' +
      "</div>" +
      '<div class="chasa-asst-body" data-asst-body></div>' +
      "</div>";
    document.body.appendChild(root);

    var panel = root.querySelector("[data-asst-panel]");
    var body = root.querySelector("[data-asst-body]");
    var fab = root.querySelector(".chasa-asst-fab");
    var open = false;

    function bubble(text, who) {
      var d = document.createElement("div");
      d.className = "chasa-asst-msg " + (who || "bot");
      d.textContent = text;
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

    function showHome() {
      body.innerHTML = "";
      bubble("Hey there 👋 I can help you find the right thing:");
      chips([
        {
          label: "I want to talk to sales",
          fn: function () {
            bubble("Happy to help. Email us for Solo, Pro, or Enterprise:");
            linkBtn("Email founder@chasa.io", "mailto:founder@chasa.io?subject=Chasa%20sales");
            chips([{ label: "Back to menu", fn: showHome }]);
          },
        },
        {
          label: "I need customer support",
          fn: function () {
            bubble("Shoot us a note — we usually reply within a day:");
            linkBtn("Email support", "mailto:founder@chasa.io?subject=Chasa%20support");
            chips([{ label: "Back to menu", fn: showHome }]);
          },
        },
        {
          label: "Tell me a joke",
          fn: function () {
            bubble(JOKES[Math.floor(Math.random() * JOKES.length)]);
            chips([
              {
                label: "Another joke",
                fn: function () {
                  bubble(JOKES[Math.floor(Math.random() * JOKES.length)]);
                },
              },
              { label: "Back to menu", fn: showHome },
            ]);
          },
        },
        {
          label: "I need something else",
          fn: function () {
            bubble("Tell us what you need — or jump into the product:");
            linkBtn("Try Chasa free", "/app/");
            linkBtn("Email founder@chasa.io", "mailto:founder@chasa.io?subject=Chasa%20question");
            chips([{ label: "Back to menu", fn: showHome }]);
          },
        },
      ]);
    }

    function setOpen(v) {
      open = v;
      panel.hidden = !open;
      fab.classList.toggle("is-open", open);
      fab.setAttribute("aria-label", open ? "Close Chasa Assistant" : "Open Chasa Assistant");
      fab.innerHTML = open
        ? "×"
        : '<img src="/brand/chasa-icon.png" alt="" width="22" height="22" />';
      if (open && !body.childNodes.length) showHome();
    }

    root.querySelectorAll("[data-asst-toggle]").forEach(function (el) {
      el.addEventListener("click", function () {
        setOpen(!open);
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();
