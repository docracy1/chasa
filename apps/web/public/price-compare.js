(function () {
  var root = document.querySelector("[data-price-compare]");
  if (!root) return;

  var CHASA = 14.99;
  var GBP_USD = 1.28;

  function chaser(n) {
    if (n <= 4) {
      return {
        title: "Chaser Compact",
        total: 259,
        formula: "From $259/mo · Compact includes up to 4 users (revenue-tiered)",
      };
    }
    return {
      title: "Chaser Core",
      total: 779,
      formula: "From $779/mo · Core for unlimited users (revenue-tiered)",
    };
  }

  function paidnice(n) {
    if (n <= 2) {
      return {
        title: "Paidnice Essentials",
        total: 69,
        formula: "$69/mo · Essentials includes up to 2 team members",
      };
    }
    return {
      title: "Paidnice Pro",
      total: 99,
      formula: "$99/mo · Pro · unlimited users, no per-seat fee",
    };
  }

  function duefy(n) {
    if (n <= 1) {
      return {
        title: "Duefy Solo",
        total: 19,
        formula: "$19/mo · Solo flat plan",
      };
    }
    if (n <= 4) {
      return {
        title: "Duefy Pro",
        total: 49,
        formula: "$49/mo · Pro flat plan",
      };
    }
    var extra = Math.max(0, n - 5);
    var total = 99 + extra * 10;
    return {
      title: "Duefy Team",
      total: total,
      formula:
        extra === 0
          ? "$99/mo · Team · 5 seats included"
          : "$99 + $" + extra * 10 + " ($10 × " + extra + " extra seats) · " + n + " seats",
    };
  }

  function satago(n) {
    if (n <= 2) {
      var basic = Math.round(45 * GBP_USD);
      return {
        title: "Satago Basic",
        total: basic,
        formula: "£45/mo (~$" + basic + ") · Basic · published GBP pricing",
      };
    }
    var premium = Math.round(80 * GBP_USD);
    return {
      title: "Satago Premium",
      total: premium,
      formula: "£80/mo (~$" + premium + ") · Premium · unlimited email reminders",
    };
  }

  function chaseai() {
    return {
      title: "ChaseAI Starter",
      total: 9,
      formula: "$9/mo · Starter flat workspace (Pro $19)",
    };
  }

  var calculators = {
    chaser: chaser,
    paidnice: paidnice,
    duefy: duefy,
    satago: satago,
    chaseai: function () {
      return chaseai();
    },
  };

  var slider = root.querySelector("[data-pc-slider]");
  var countEl = root.querySelector("[data-pc-count]");

  function render() {
    var n = parseInt(slider.value, 10) || 1;
    countEl.textContent = String(n);
    var pct = ((n - 1) / 19) * 100;
    slider.style.setProperty("--pct", pct + "%");

    root.querySelectorAll("[data-pc-comp]").forEach(function (row) {
      var key = row.getAttribute("data-pc-comp");
      var calc = calculators[key];
      if (!calc) return;
      var result = calc(n);
      var titleEl = row.querySelector("[data-pc-title]");
      var formulaEl = row.querySelector("[data-pc-formula]");
      var deltaEl = row.querySelector("[data-pc-delta]");
      var totalEl = row.querySelector("[data-pc-total]");
      if (titleEl) titleEl.textContent = result.title;
      if (formulaEl) formulaEl.textContent = result.formula;
      var delta = result.total - CHASA;
      if (deltaEl) {
        deltaEl.textContent = (delta >= 0 ? "+$" : "-$") + Math.abs(delta) + "/mo";
        deltaEl.classList.toggle("is-zero", delta === 0);
      }
      if (totalEl) {
        totalEl.innerHTML = "$" + result.total + "<small>/mo</small>";
      }
    });
  }

  slider.addEventListener("input", render);
  render();
})();
