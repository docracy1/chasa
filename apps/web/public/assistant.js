(function () {
  if (window.__chasaAssistant) return;
  window.__chasaAssistant = true;

  var JOKES = [
    "Why did the freelancer chase the invoice? Because it was outstanding.",
    "I told my unpaid invoice a joke. Still no response — tough crowd.",
    "What's a freelancer's favorite cardio? Chase-ups.",
    "Accounting tip: if the check is in the mail, check your spam — and your patience.",
  ];

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
    bubble("Hey there — I can help you find the right thing:");
    chips([
      {
        label: "I want to talk to sales",
        fn: function () {
          bubble("Happy to help. Email Odo for Solo, Pro, or Enterprise:");
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
            { label: "Another joke", fn: function () {
              bubble(JOKES[Math.floor(Math.random() * JOKES.length)]);
            }},
            { label: "Back to menu", fn: showHome },
          ]);
        },
      },
      {
        label: "I need something else",
        fn: function () {
          bubble("Tell us what you need — or jump into the product:");
          linkBtn("Try Chasa free", "/app/");
          linkBtn("Email Odo", "mailto:founder@chasa.io?subject=Chasa%20question");
          chips([{ label: "Back to menu", fn: showHome }]);
        },
      },
    ]);
  }

  function setOpen(v) {
    open = v;
    panel.hidden = !open;
    fab.setAttribute("aria-label", open ? "Close Chasa Assistant" : "Open Chasa Assistant");
    fab.classList.toggle("is-open", open);
    if (open && !body.childNodes.length) showHome();
  }

  root.querySelectorAll("[data-asst-toggle]").forEach(function (el) {
    el.addEventListener("click", function () {
      setOpen(!open);
    });
  });
})();
