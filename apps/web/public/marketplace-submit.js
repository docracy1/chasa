/**
 * Community template submission — /free-templates/submit.
 * POST /api/marketplace/submit. No sign-in required; every submission is reviewed by an admin
 * before it appears on /free-templates/ — nothing here publishes automatically.
 */
(function () {
  var API = "/api/marketplace";
  var form = document.getElementById("marketplace-submit-form");
  if (!form) return;

  var nameInput = document.getElementById("mkt-name");
  var categoryInput = document.getElementById("mkt-category");
  var stageInput = document.getElementById("mkt-stage");
  var toneInput = document.getElementById("mkt-tone");
  var descriptionInput = document.getElementById("mkt-description");
  var subjectInput = document.getElementById("mkt-subject");
  var bodyInput = document.getElementById("mkt-body");
  var emailInput = document.getElementById("mkt-email");
  var statusEl = document.getElementById("mkt-status");
  var submitBtn = document.getElementById("mkt-submit");
  var turnstileHost = document.getElementById("mkt-turnstile");
  var turnstileToken = null;
  var turnstileWidgetId = null;
  var turnstileRequired = false;
  var defaultBtnLabel = (submitBtn && submitBtn.textContent) || "Submit template";

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

  fetch("/api/leads/config")
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
    var name = (nameInput && nameInput.value ? nameInput.value : "").trim();
    var subject = (subjectInput && subjectInput.value ? subjectInput.value : "").trim();
    var body = (bodyInput && bodyInput.value ? bodyInput.value : "").trim();

    if (!name) {
      setStatus("Give your template a short name.", true);
      if (nameInput) nameInput.focus();
      return;
    }
    if (!subject) {
      setStatus("Add an email subject line.", true);
      if (subjectInput) subjectInput.focus();
      return;
    }
    if (!body) {
      setStatus("Add the email body.", true);
      if (bodyInput) bodyInput.focus();
      return;
    }
    if (turnstileRequired && !turnstileToken) {
      setStatus("Please complete the security check.", true);
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Submitting…";
    }
    setStatus("");

    fetch(API + "/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        name: name,
        description: (descriptionInput && descriptionInput.value ? descriptionInput.value : "").trim() || undefined,
        stage: (stageInput && stageInput.value ? stageInput.value : "").trim() || undefined,
        tone: (toneInput && toneInput.value ? toneInput.value : "").trim() || undefined,
        category: (categoryInput && categoryInput.value ? categoryInput.value : "").trim() || undefined,
        subject: subject,
        body: body,
        submitterEmail: (emailInput && emailInput.value ? emailInput.value : "").trim() || undefined,
        turnstileToken: turnstileToken || undefined,
      }),
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
        form.hidden = true;
        var doneEl = document.getElementById("mkt-done");
        if (doneEl) doneEl.hidden = false;
      })
      .catch(function () {
        setStatus("Network error. Try again in a moment.", true);
      })
      .finally(function () {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = defaultBtnLabel;
        }
        turnstileToken = null;
        if (window.turnstile && turnstileWidgetId !== null) {
          window.turnstile.reset(turnstileWidgetId);
        }
      });
  });
})();
