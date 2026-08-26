/**
 * Homepage (and blog) price comparison calculator.
 * Multi-product mode: pick a docstoc product → compare top 5 peers.
 * Default product: Templates (top-of-funnel / brand core).
 * Legacy mode: static [data-pc-comp] rows (chase blog) still work.
 */
(function () {
  var DOCSTOC_PRO = 14.99;
  var GBP_USD = 1.28;

  function money(n) {
    var rounded = Math.round(n * 100) / 100;
    return rounded % 1 === 0 ? String(rounded) : rounded.toFixed(2);
  }

  function flat(title, total, formula) {
    return { title: title, total: total, formula: formula };
  }

  /* ---------- Chase / AR (existing models) ---------- */
  function chaser(n) {
    if (n <= 4) {
      return flat(
        "Chaser Compact",
        259,
        "From $259/mo · Compact includes up to 4 users (revenue-tiered)"
      );
    }
    return flat(
      "Chaser Core",
      779,
      "From $779/mo · Core for unlimited users (revenue-tiered)"
    );
  }

  function paidnice(n) {
    if (n <= 2) {
      return flat(
        "Paidnice Essentials",
        69,
        "$69/mo · Essentials includes up to 2 team members"
      );
    }
    return flat(
      "Paidnice Pro",
      99,
      "$99/mo · Pro · unlimited users, no per-seat fee"
    );
  }

  function duefy(n) {
    if (n <= 1) {
      return flat("Duefy Solo", 19, "$19/mo · Solo flat plan");
    }
    if (n <= 4) {
      return flat("Duefy Pro", 49, "$49/mo · Pro flat plan");
    }
    var extra = Math.max(0, n - 5);
    var total = 99 + extra * 10;
    return flat(
      "Duefy Team",
      total,
      extra === 0
        ? "$99/mo · Team · 5 seats included"
        : "$99 + $" +
            extra * 10 +
            " ($10 × " +
            extra +
            " extra seats) · " +
            n +
            " seats"
    );
  }

  function satago(n) {
    if (n <= 2) {
      var basic = Math.round(45 * GBP_USD);
      return flat(
        "Satago Basic",
        basic,
        "£45/mo (~$" + basic + ") · Basic · published GBP pricing"
      );
    }
    var premium = Math.round(80 * GBP_USD);
    return flat(
      "Satago Premium",
      premium,
      "£80/mo (~$" + premium + ") · Premium · unlimited email reminders"
    );
  }

  function chaseai() {
    return flat("ChaseAI Starter", 9, "$9/mo · Starter flat workspace (Pro $19)");
  }

  /* ---------- Invoicing ---------- */
  function invoicely(n) {
    if (n <= 1) {
      return flat(
        "Invoicely Free",
        0,
        "$0 · Free · 5 invoices / 3 clients (no team seats)"
      );
    }
    if (n <= 2) {
      return flat(
        "Invoicely Basic",
        9.99,
        "$9.99/mo · Basic · up to 2 team members"
      );
    }
    if (n <= 10) {
      return flat(
        "Invoicely Professional",
        19.99,
        "$19.99/mo · Professional · up to 10 team members"
      );
    }
    return flat(
      "Invoicely Enterprise",
      29.99,
      "$29.99/mo · Enterprise · up to 25 team members"
    );
  }

  function wave() {
    return flat(
      "Wave Starter",
      0,
      "$0 · Free invoicing & bookkeeping (payment processing fees apply)"
    );
  }

  function freshbooks(n) {
    if (n <= 1) {
      return flat("FreshBooks Lite", 19, "$19/mo · Lite · up to 5 clients");
    }
    if (n <= 3) {
      return flat("FreshBooks Plus", 33, "$33/mo · Plus · up to 50 clients");
    }
    return flat(
      "FreshBooks Premium",
      60,
      "$60/mo · Premium · unlimited clients"
    );
  }

  function quickbooks(n) {
    if (n <= 1) {
      return flat(
        "QuickBooks Simple Start",
        35,
        "$35/mo · Simple Start · 1 user"
      );
    }
    if (n <= 3) {
      return flat(
        "QuickBooks Essentials",
        65,
        "$65/mo · Essentials · up to 3 users"
      );
    }
    if (n <= 5) {
      return flat("QuickBooks Plus", 99, "$99/mo · Plus · up to 5 users");
    }
    return flat(
      "QuickBooks Advanced",
      235,
      "$235/mo · Advanced · up to 25 users"
    );
  }

  function zohoInvoice(n) {
    if (n <= 1) {
      return flat(
        "Zoho Invoice Free",
        0,
        "$0 · Free · 1 user, unlimited invoices"
      );
    }
    var total = Math.round(15 * n * 100) / 100;
    return flat(
      "Zoho Invoice Standard",
      total,
      "$15/user/mo · Standard · × " + n + " users"
    );
  }

  /* ---------- SSL ---------- */
  function zerossl(domains) {
    if (domains <= 3) {
      return flat(
        "ZeroSSL Free",
        0,
        "$0 · Free · up to 3 × 90-day certificates"
      );
    }
    if (domains <= 10) {
      return flat(
        "ZeroSSL Basic",
        10,
        "~$10/mo · Basic (billed yearly) · more certs / automation"
      );
    }
    return flat(
      "ZeroSSL Premium",
      55,
      "From ~$55/mo · Premium tier for higher volume / wildcards"
    );
  }

  function letsencrypt() {
    return flat(
      "Let's Encrypt (DIY)",
      0,
      "$0 · Free CA · you run ACME / renewals yourself"
    );
  }

  function digicertSsl(domains) {
    var perMo = 17;
    var total = Math.round(perMo * domains * 100) / 100;
    return flat(
      "DigiCert DV (est.)",
      total,
      "~$" +
        perMo +
        "/domain/mo · ≈ $" +
        money(200) +
        "/yr retail DV × " +
        domains
    );
  }

  function sectigoSsl(domains) {
    var perMo = 5;
    var total = Math.round(perMo * domains * 100) / 100;
    return flat(
      "Sectigo DV (est.)",
      total,
      "~$" +
        perMo +
        "/domain/mo · ≈ $" +
        money(60) +
        "/yr mid-market DV × " +
        domains
    );
  }

  function cloudflareSsl() {
    return flat(
      "Cloudflare Universal SSL",
      0,
      "$0 · Free with Cloudflare proxy (CDN path)"
    );
  }

  /* ---------- Templates ---------- */
  function legalzoom() {
    return flat(
      "LegalZoom Business Attorney",
      39,
      "From ~$39/mo · attorney plan / document access (not free library)"
    );
  }

  function rocketLawyer() {
    return flat(
      "Rocket Lawyer Standard",
      12.42,
      "~$12.42/mo · $149/yr Standard membership (unlimited docs)"
    );
  }

  function pandadoc(n) {
    var seat = 19;
    var total = Math.round(seat * n * 100) / 100;
    return flat(
      "PandaDoc Starter",
      total,
      "$" + seat + "/user/mo (annual) · × " + n + " seats"
    );
  }

  function googleWorkspace(n) {
    var seat = 7;
    var total = Math.round(seat * n * 100) / 100;
    return flat(
      "Google Workspace Starter",
      total,
      "~$" + seat + "/user/mo · Business Starter × " + n
    );
  }

  function bonsai() {
    return flat(
      "Bonsai",
      21,
      "From ~$21/mo · freelancer contracts + invoices"
    );
  }

  /* ---------- Document certificates (file integrity) ---------- */
  function adobeAcrobat(n) {
    if (n <= 1) {
      return flat(
        "Adobe Acrobat Standard",
        23,
        "~$23/mo · Individual · PDF certify / protect"
      );
    }
    var seat = 24;
    return flat(
      "Adobe Acrobat for Teams",
      Math.round(seat * n * 100) / 100,
      "~$" + seat + "/user/mo · Teams × " + n
    );
  }

  function digicertDoc() {
    return flat(
      "DigiCert Document Trust",
      50,
      "From ~$50/mo est. · enterprise document signing / trust"
    );
  }

  function docusign(n) {
    if (n <= 1) {
      return flat("DocuSign Personal", 10, "$10/mo · Personal · e-sign");
    }
    if (n <= 3) {
      return flat(
        "DocuSign Standard",
        Math.round(25 * n * 100) / 100,
        "$25/user/mo · Standard × " + n
      );
    }
    return flat(
      "DocuSign Business Pro",
      Math.round(40 * n * 100) / 100,
      "$40/user/mo · Business Pro × " + n
    );
  }

  function originstamp() {
    return flat(
      "OriginStamp",
      15,
      "From ~$15/mo est. · blockchain timestamp API"
    );
  }

  function opentimestamps() {
    return flat(
      "OpenTimestamps",
      0,
      "$0 · Open protocol · DIY Bitcoin timestamps"
    );
  }

  var LEGACY_CALCS = {
    chaser: chaser,
    paidnice: paidnice,
    duefy: duefy,
    satago: satago,
    chaseai: function () {
      return chaseai();
    },
  };

  /** Product order: Templates first (most important), chase last. */
  var PRODUCTS = [
    {
      id: "templates",
      label: "Templates",
      lede: "Free business & legal templates are the core of docstoc. Here’s what document tools people compare us to cost for the same team size.",
      sliderLabel: "Team size",
      sliderUnit: "people",
      sliderMin: 1,
      sliderMax: 20,
      sliderDefault: 5,
      docstocFormula:
        "1,000+ free templates on Free · Pro $14.99 adds invoices, SSL, chase & more",
      docstocTotal: DOCSTOC_PRO,
      note: 'Figures use published list prices (approx., mid-2026). LegalZoom/Rocket Lawyer sell memberships & attorney access — not a free copy library. <a href="/document-templates/">Browse free templates →</a>',
      competitors: [
        { id: "legalzoom", calc: legalzoom, href: "/docstoc-vs-legalzoom", link: "vs LegalZoom →" },
        { id: "rocket-lawyer", calc: rocketLawyer, href: "/docstoc-vs-rocket-lawyer", link: "vs Rocket Lawyer →" },
        { id: "pandadoc", calc: pandadoc, href: "/docstoc-vs-pandadoc", link: "vs PandaDoc →" },
        { id: "google-workspace", calc: googleWorkspace, href: "/docstoc-vs-google-workspace", link: "vs Google Workspace →" },
        { id: "bonsai", calc: bonsai, href: "/docstoc-vs-bonsai", link: "vs Bonsai →" },
      ],
    },
    {
      id: "invoices",
      label: "Invoices",
      lede: "Create and send invoices in docstoc. Compare Pro’s flat workspace fee to the invoicing tools people shop against most.",
      sliderLabel: "Team size",
      sliderUnit: "people",
      sliderMin: 1,
      sliderMax: 20,
      sliderDefault: 5,
      docstocFormula: "Flat workspace fee · Business is $39.99/mo, also flat",
      docstocTotal: DOCSTOC_PRO,
      note: 'Figures use published list prices (approx., mid-2026). Wave/Zoho Free are strong on price alone; docstoc bundles templates, file certificates, SSL, and chase drafts. <a href="/invoices">Invoices product →</a>',
      competitors: [
        { id: "invoicely", calc: invoicely, href: "/invoices", link: "about Invoicely →" },
        { id: "wave", calc: wave, href: "/docstoc-vs-wave", link: "vs Wave →" },
        { id: "freshbooks", calc: freshbooks, href: "/docstoc-vs-freshbooks", link: "vs FreshBooks →" },
        { id: "quickbooks", calc: quickbooks, href: "/docstoc-vs-quickbooks", link: "vs QuickBooks →" },
        { id: "zoho-invoice", calc: zohoInvoice, href: "/docstoc-vs-zoho-invoice", link: "vs Zoho Invoice →" },
      ],
    },
    {
      id: "ssl",
      label: "SSL",
      lede: "Real Let’s Encrypt certificates on your domain, renewed automatically. Compare Pro to dedicated SSL products.",
      sliderLabel: "Domains",
      sliderUnit: "domains",
      sliderMin: 1,
      sliderMax: 20,
      sliderDefault: 1,
      docstocFormula:
        "Pro includes 1 SSL domain · Business $39.99 for more — no separate cert fee",
      docstocTotal: DOCSTOC_PRO,
      docstocTotalFor: function (n) {
        return n <= 1 ? DOCSTOC_PRO : 39.99;
      },
      docstocFormulaFor: function (n) {
        return n <= 1
          ? "Pro $14.99 · 1 SSL domain included — no separate cert fee"
          : "Business $39.99 · multiple SSL domains — no separate cert fee";
      },
      note: 'Figures use published list prices (approx., mid-2026). DigiCert/Sectigo are retail DV estimates converted monthly; OV/EV cost more. <a href="/ssl">SSL product →</a> · <a href="/docstoc-vs-zerossl">vs ZeroSSL →</a>',
      competitors: [
        { id: "zerossl", calc: zerossl, href: "/docstoc-vs-zerossl", link: "vs ZeroSSL →" },
        { id: "letsencrypt", calc: letsencrypt, href: "/docstoc-vs-letsencrypt", link: "vs Let’s Encrypt →" },
        { id: "digicert", calc: digicertSsl, href: "/docstoc-vs-digicert", link: "vs DigiCert →" },
        { id: "sectigo", calc: sectigoSsl, href: "/docstoc-vs-sectigo", link: "vs Sectigo →" },
        { id: "cloudflare-ssl", calc: cloudflareSsl, href: "/docstoc-vs-cloudflare-ssl", link: "vs Cloudflare →" },
      ],
    },
    {
      id: "certificates",
      label: "Certificates",
      lede: "Tamper-evident file certificates (hash proof). Compare Pro to the brands people know for “prove this file” or “prove who signed.”",
      sliderLabel: "Team size",
      sliderUnit: "people",
      sliderMin: 1,
      sliderMax: 20,
      sliderDefault: 5,
      docstocFormula:
        "Free hash certificates on Free · Pro adds the rest of the workspace",
      docstocTotal: DOCSTOC_PRO,
      note: 'Figures are approximate public list prices (mid-2026). DocuSign proves who signed; Adobe/DigiCert lean PDF/signing — docstoc proves file bytes haven’t changed. <a href="/certificate">Document certificates →</a>',
      competitors: [
        { id: "adobe", calc: adobeAcrobat, href: "/certificate", link: "about certs →" },
        { id: "digicert-doc", calc: digicertDoc, href: "/docstoc-vs-digicert", link: "vs DigiCert →" },
        { id: "docusign", calc: docusign, href: "/certificate", link: "about certs →" },
        { id: "originstamp", calc: originstamp, href: "/certificate", link: "about certs →" },
        { id: "opentimestamps", calc: opentimestamps, href: "/certificate", link: "about certs →" },
      ],
    },
    {
      id: "chase",
      label: "Invoice chasing",
      lede: "AI tone-matched follow-up drafts you send yourself. Compare Pro to dedicated AR chase tools.",
      sliderLabel: "Team size",
      sliderUnit: "people",
      sliderMin: 1,
      sliderMax: 20,
      sliderDefault: 5,
      docstocFormula: "Flat workspace fee · Business is $39.99/mo, also flat",
      docstocTotal: DOCSTOC_PRO,
      note: 'Figures use published list prices (USD where available; Satago converted from GBP at ~$1.28). Competitors often include auto-send, SMS, or payment portals docstoc does not. <a href="/blog/invoice-chase-software-comparison/">Full chase comparison →</a>',
      competitors: [
        { id: "chaser", calc: chaser, href: "/docstoc-vs-chaser", link: "vs Chaser →" },
        { id: "paidnice", calc: paidnice, href: "/docstoc-vs-paidnice", link: "vs Paidnice →" },
        { id: "duefy", calc: duefy, href: "/docstoc-vs-duefy", link: "vs Duefy →" },
        { id: "satago", calc: satago, href: "/docstoc-vs-satago", link: "vs Satago →" },
        { id: "chaseai", calc: chaseai, href: "/docstoc-vs-chaseai", link: "vs ChaseAI →" },
      ],
    },
  ];

  function productById(id) {
    for (var i = 0; i < PRODUCTS.length; i++) {
      if (PRODUCTS[i].id === id) return PRODUCTS[i];
    }
    return PRODUCTS[0];
  }

  function applyDelta(deltaEl, totalEl, result, anchor) {
    var delta = result.total - anchor;
    if (deltaEl) {
      deltaEl.textContent =
        (delta >= 0 ? "+$" : "-$") + money(Math.abs(delta)) + "/mo";
      deltaEl.classList.toggle("is-zero", delta === 0);
      deltaEl.classList.toggle("is-cheaper", delta < 0);
      deltaEl.classList.toggle("is-costlier", delta > 0);
    }
    if (totalEl) {
      totalEl.innerHTML = "$" + money(result.total) + "<small>/mo</small>";
    }
  }

  function renderLegacy(root) {
    var slider = root.querySelector("[data-pc-slider]");
    var countEl = root.querySelector("[data-pc-count]");
    if (!slider) return;

    function render() {
      var n = parseInt(slider.value, 10) || 1;
      if (countEl) countEl.textContent = String(n);
      var min = parseInt(slider.min, 10) || 1;
      var max = parseInt(slider.max, 10) || 20;
      var pct = ((n - min) / Math.max(1, max - min)) * 100;
      slider.style.setProperty("--pct", pct + "%");

      root.querySelectorAll("[data-pc-comp]").forEach(function (row) {
        var key = row.getAttribute("data-pc-comp");
        var calc = LEGACY_CALCS[key];
        if (!calc) return;
        var result = calc(n);
        var titleEl = row.querySelector("[data-pc-title]");
        var formulaEl = row.querySelector("[data-pc-formula]");
        var deltaEl = row.querySelector("[data-pc-delta]");
        var totalEl = row.querySelector("[data-pc-total]");
        if (titleEl) titleEl.textContent = result.title;
        if (formulaEl) formulaEl.textContent = result.formula;
        applyDelta(deltaEl, totalEl, result, DOCSTOC_PRO);
      });
    }

    slider.addEventListener("input", render);
    render();
  }

  function renderMulti(root) {
    var defaultId = root.getAttribute("data-pc-default") || "templates";
    var product = productById(defaultId);
    var tabsEl = root.querySelector("[data-pc-tabs]");
    var ledeEl = root.querySelector("[data-pc-lede]");
    var sliderLabelEl = root.querySelector("[data-pc-slider-label]");
    var countEl = root.querySelector("[data-pc-count]");
    var unitEl = root.querySelector("[data-pc-unit]");
    var slider = root.querySelector("[data-pc-slider]");
    var endsEl = root.querySelector("[data-pc-ends]");
    var formulaEl = root.querySelector("[data-pc-docstoc-formula]");
    var docstocTotalEl = root.querySelector("[data-pc-docstoc-total]");
    var rowsEl = root.querySelector("[data-pc-rows]");
    var noteEl = root.querySelector("[data-pc-note]");

    if (tabsEl) {
      tabsEl.innerHTML = "";
      PRODUCTS.forEach(function (p) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "pc-tab";
        btn.setAttribute("role", "tab");
        btn.setAttribute("data-pc-product", p.id);
        btn.textContent = p.label;
        if (p.id === product.id) btn.setAttribute("aria-selected", "true");
        btn.addEventListener("click", function () {
          product = p;
          tabsEl.querySelectorAll(".pc-tab").forEach(function (t) {
            t.setAttribute(
              "aria-selected",
              t.getAttribute("data-pc-product") === p.id ? "true" : "false"
            );
          });
          setupProduct();
          render();
        });
        tabsEl.appendChild(btn);
      });
    }

    function setupProduct() {
      if (ledeEl) ledeEl.textContent = product.lede;
      if (sliderLabelEl) sliderLabelEl.textContent = product.sliderLabel;
      if (unitEl) unitEl.textContent = product.sliderUnit;
      if (slider) {
        slider.min = String(product.sliderMin);
        slider.max = String(product.sliderMax);
        slider.value = String(product.sliderDefault);
        slider.setAttribute("aria-label", product.sliderLabel);
      }
      if (endsEl) {
        endsEl.innerHTML =
          "<span>" +
          product.sliderMin +
          "</span><span>" +
          product.sliderMax +
          "</span>";
      }
      if (formulaEl) formulaEl.textContent = product.docstocFormula;
      if (docstocTotalEl) {
        docstocTotalEl.innerHTML =
          "$" + money(product.docstocTotal) + "<small>/mo</small>";
      }
      if (noteEl) noteEl.innerHTML = product.note;

      if (rowsEl) {
        rowsEl.innerHTML = "";
        product.competitors.forEach(function (c) {
          var row = document.createElement("div");
          row.className = "pc-row";
          row.setAttribute("data-pc-comp", c.id);
          row.innerHTML =
            '<div class="pc-row-main">' +
            '<div class="pc-row-name">' +
            '<span data-pc-title></span>' +
            '<a class="pc-row-link" href="' +
            c.href +
            '">' +
            c.link +
            "</a>" +
            "</div>" +
            '<div class="pc-row-formula" data-pc-formula></div>' +
            "</div>" +
            '<div class="pc-row-nums">' +
            '<span class="pc-delta" data-pc-delta></span>' +
            '<div class="pc-total" data-pc-total></div>' +
            "</div>";
          rowsEl.appendChild(row);
        });
      }
    }

    function render() {
      if (!slider) return;
      var n = parseInt(slider.value, 10) || product.sliderMin;
      if (countEl) countEl.textContent = String(n);
      var min = product.sliderMin;
      var max = product.sliderMax;
      var pct = ((n - min) / Math.max(1, max - min)) * 100;
      slider.style.setProperty("--pct", pct + "%");

      var anchor =
        typeof product.docstocTotalFor === "function"
          ? product.docstocTotalFor(n)
          : product.docstocTotal;
      if (formulaEl && typeof product.docstocFormulaFor === "function") {
        formulaEl.textContent = product.docstocFormulaFor(n);
      }
      if (docstocTotalEl) {
        docstocTotalEl.innerHTML = "$" + money(anchor) + "<small>/mo</small>";
      }

      root.querySelectorAll("[data-pc-comp]").forEach(function (row) {
        var key = row.getAttribute("data-pc-comp");
        var comp = null;
        for (var i = 0; i < product.competitors.length; i++) {
          if (product.competitors[i].id === key) {
            comp = product.competitors[i];
            break;
          }
        }
        if (!comp) return;
        var result = comp.calc(n);
        var titleEl = row.querySelector("[data-pc-title]");
        var fEl = row.querySelector("[data-pc-formula]");
        var deltaEl = row.querySelector("[data-pc-delta]");
        var totalEl = row.querySelector("[data-pc-total]");
        if (titleEl) titleEl.textContent = result.title;
        if (fEl) fEl.textContent = result.formula;
        applyDelta(deltaEl, totalEl, result, anchor);
      });
    }

    setupProduct();
    if (slider) slider.addEventListener("input", render);
    render();
  }

  document.querySelectorAll("[data-price-compare]").forEach(function (root) {
    if (root.querySelector("[data-pc-tabs]")) {
      renderMulti(root);
    } else {
      renderLegacy(root);
    }
  });
})();
