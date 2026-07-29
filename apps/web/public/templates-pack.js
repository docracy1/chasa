/**
 * Email-gated PDF pack download on /free-templates/.
 * Collects email → POST /api/leads/templates-pack → download PDF + welcome email.
 */
(function () {
  var API = "/api/leads";
  var form = document.getElementById("templates-pack-form");
  if (!form) return;

  var emailInput = document.getElementById("templates-pack-email");
  var statusEl = document.getElementById("templates-pack-status");
  var submitBtn = document.getElementById("templates-pack-submit");
  var turnstileHost = document.getElementById("templates-pack-turnstile");
  var turnstileToken = null;
  var turnstileWidgetId = null;
  var turnstileRequired = false;

  function setStatus(msg, isError) {
    if (!statusEl) return;
    statusEl.textContent = msg || "";
    statusEl.className = "tpl-pack-status" + (isError ? " is-error" : msg ? " is-ok" : "");
  }

  function loadTurnstile(siteKey) {
    if (!turnstileHost || !siteKey) return;
    turnstileRequired = true;
    function render() {
      if (!window.turnstile || turnstileWidgetId !== null) return;
      turnstileWidgetId = window.turnstile.render(turnstileHost, {
        sitekey: siteKey,
        callback: function (token) {
          turnstileToken = token;
        },
        "expired-callback": function () {
          turnstileToken = null;
        },
      });
    }
    if (window.turnstile) {
      render();
      return;
    }
    var s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.onload = render;
    document.head.appendChild(s);
  }

  fetch(API + "/config")
    .then(function (r) {
      return r.json();
    })
    .then(function (cfg) {
      if (cfg && cfg.turnstileRequired && cfg.turnstileSiteKey) {
        loadTurnstile(cfg.turnstileSiteKey);
      }
    })
    .catch(function () {});

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var email = (emailInput && emailInput.value ? emailInput.value : "").trim();
    if (!email) {
      setStatus("Enter your email to get the PDF.", true);
      return;
    }
    if (turnstileRequired && !turnstileToken) {
      setStatus("Please complete the security check.", true);
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Sending…";
    }
    setStatus("");

    fetch(API + "/templates-pack", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ email: email, turnstileToken: turnstileToken || undefined }),
    })
      .then(function (r) {
        return r.json().then(function (data) {
          return { ok: r.ok, status: r.status, data: data };
        });
      })
      .then(function (res) {
        if (!res.ok) {
          setStatus((res.data && res.data.error) || "Something went wrong. Try again.", true);
          return;
        }
        var url = res.data.downloadUrl || "/free-templates/chasa-polite-invoice-templates.pdf";
        setStatus(
          res.data.welcomeEmail
            ? "PDF unlocked — download starting. We also emailed you a copy with a few useful reads."
            : "PDF unlocked — download starting. Check your inbox if you need the link again."
        );
        var a = document.createElement("a");
        a.href = url;
        a.download = "chasa-polite-invoice-templates.pdf";
        a.rel = "noopener";
        document.body.appendChild(a);
        a.click();
        a.remove();
      })
      .catch(function () {
        setStatus("Network error. Try again in a moment.", true);
      })
      .finally(function () {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = "Email me the PDF";
        }
        turnstileToken = null;
        if (window.turnstile && turnstileWidgetId !== null) {
          try {
            window.turnstile.reset(turnstileWidgetId);
          } catch (_) {}
        }
      });
  });
})();
