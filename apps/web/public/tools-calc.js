/**
 * Shared calculators for /tools/* pages.
 * Late payment interest + chase savings / cash unlocked estimates.
 */
(function () {
  function money(n, currency) {
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: currency || "USD",
        maximumFractionDigits: 2,
      }).format(n);
    } catch {
      return (currency || "USD") + " " + n.toFixed(2);
    }
  }

  function daysBetween(a, b) {
    const ms = Date.parse(b) - Date.parse(a);
    if (!Number.isFinite(ms)) return 0;
    return Math.max(0, Math.round(ms / 86400000));
  }

  function bindLatePayment(root) {
    const amountEl = root.querySelector("[data-lp-amount]");
    const overdueEl = root.querySelector("[data-lp-overdue]");
    const paidEl = root.querySelector("[data-lp-paid]");
    const rateEl = root.querySelector("[data-lp-rate]");
    const feeEl = root.querySelector("[data-lp-fee]");
    const currencyEl = root.querySelector("[data-lp-currency]");
    const outDays = root.querySelector("[data-lp-out-days]");
    const outInterest = root.querySelector("[data-lp-out-interest]");
    const outFee = root.querySelector("[data-lp-out-fee]");
    const outTotal = root.querySelector("[data-lp-out-total]");
    const outRateLabel = root.querySelector("[data-lp-rate-label]");

    function recalc() {
      const amount = Math.max(0, Number(amountEl.value) || 0);
      const rate = Math.max(0, Number(rateEl.value) || 0);
      const feePct = Math.max(0, Number(feeEl.value) || 0);
      const currency = (currencyEl && currencyEl.value) || "USD";
      const overdue = overdueEl.value;
      const paid = paidEl.value || new Date().toISOString().slice(0, 10);
      const days = daysBetween(overdue, paid);
      const interest = amount * (rate / 100) * (days / 365);
      const fee = amount * (feePct / 100);
      const total = amount + interest + fee;
      if (outRateLabel) outRateLabel.textContent = rate.toFixed(1) + "%";
      if (outDays) outDays.textContent = String(days);
      if (outInterest) outInterest.textContent = money(interest, currency);
      if (outFee) outFee.textContent = money(fee, currency);
      if (outTotal) outTotal.textContent = money(total, currency);
    }

    [amountEl, overdueEl, paidEl, rateEl, feeEl, currencyEl].forEach((el) => {
      if (!el) return;
      el.addEventListener("input", recalc);
      el.addEventListener("change", recalc);
    });
    if (!overdueEl.value) {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      overdueEl.value = d.toISOString().slice(0, 10);
    }
    if (!paidEl.value) paidEl.value = new Date().toISOString().slice(0, 10);
    recalc();
  }

  function bindSavings(root) {
    const arEl = root.querySelector("[data-sv-ar]");
    const dsoEl = root.querySelector("[data-sv-dso]");
    const reduceEl = root.querySelector("[data-sv-reduce]");
    const hoursEl = root.querySelector("[data-sv-hours]");
    const wageEl = root.querySelector("[data-sv-wage]");
    const currencyEl = root.querySelector("[data-sv-currency]");
    const outCash = root.querySelector("[data-sv-out-cash]");
    const outHours = root.querySelector("[data-sv-out-hours]");
    const outTimeCost = root.querySelector("[data-sv-out-timecost]");
    const outRoi = root.querySelector("[data-sv-out-roi]");
    const outReduceLabel = root.querySelector("[data-sv-reduce-label]");
    const SOLO_ANNUAL = 7 * 12;

    function recalc() {
      const ar = Math.max(0, Number(arEl.value) || 0);
      const dso = Math.max(1, Number(dsoEl.value) || 45);
      const reduce = Math.min(dso - 1, Math.max(0, Number(reduceEl.value) || 0));
      const hoursWeek = Math.max(0, Number(hoursEl.value) || 0);
      const wage = Math.max(0, Number(wageEl.value) || 0);
      const currency = (currencyEl && currencyEl.value) || "USD";
      const daily = ar / dso;
      const cashUnlocked = daily * reduce;
      // Assume consistent follow-ups cut chase time ~50% for freelancers/SMBs
      const hoursYear = hoursWeek * 52 * 0.5;
      const timeCost = hoursYear * wage;
      const totalBenefit = cashUnlocked + timeCost;
      const roi = SOLO_ANNUAL > 0 ? ((totalBenefit - SOLO_ANNUAL) / SOLO_ANNUAL) * 100 : 0;
      if (outReduceLabel) outReduceLabel.textContent = String(reduce);
      if (outCash) outCash.textContent = money(cashUnlocked, currency);
      if (outHours) outHours.textContent = Math.round(hoursYear).toLocaleString() + " hrs/yr";
      if (outTimeCost) outTimeCost.textContent = money(timeCost, currency);
      if (outRoi) outRoi.textContent = (roi >= 0 ? Math.round(roi).toLocaleString() + "%" : "—");
    }

    [arEl, dsoEl, reduceEl, hoursEl, wageEl, currencyEl].forEach((el) => {
      if (!el) return;
      el.addEventListener("input", recalc);
      el.addEventListener("change", recalc);
    });
    recalc();
  }

  document.querySelectorAll("[data-calc='late-payment']").forEach(bindLatePayment);
  document.querySelectorAll("[data-calc='chase-savings']").forEach(bindSavings);
})();
