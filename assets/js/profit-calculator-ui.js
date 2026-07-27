// Homepage "Check Real Profit" modal — uses CoinNavigatorNetProfit (no duplicated math).
(function attachProfitCalculatorUi(global) {
  'use strict';

  var STALE_MS = 20 * 60 * 1000; // warn when snapshot older than ~20 min (refresh is ~15)
  var state = {
    opportunity: null,
    triggerEl: null,
    lastVerdict: null,
    advancedOpenedTracked: false,
    focusables: [],
    prevFocus: null,
  };

  function engine() {
    return global.CoinNavigatorNetProfit || null;
  }

  function track(name, params) {
    try {
      if (typeof global.track === 'function') global.track(name, params || {});
    } catch (_e) {}
  }

  function affiliateUrl(exchange) {
    var aff = global.CoinNavigatorAffiliate;
    if (aff && typeof aff.buildUrl === 'function') {
      return aff.buildUrl(exchange, 'profit_calculator', 'check_real_profit');
    }
    var map = global.AFFILIATE_LINKS_GLOBAL || {};
    return map[exchange] || null;
  }

  function $(id) {
    return document.getElementById(id);
  }

  function formatUsd(n, signed) {
    var eng = engine();
    if (eng && eng.formatUsd) return eng.formatUsd(n, !!signed);
    if (!Number.isFinite(n)) return '—';
    return (signed && n > 0 ? '+' : '') + (n < 0 ? '−$' : '$') + Math.abs(n).toFixed(2);
  }

  function formatPct(n, signed) {
    var eng = engine();
    if (eng && eng.formatPct) return eng.formatPct(n, !!signed);
    if (!Number.isFinite(n)) return '—';
    return (signed && n > 0 ? '+' : '') + n.toFixed(4) + '%';
  }

  function formatQty(n) {
    var eng = engine();
    if (eng && eng.formatQty) return eng.formatQty(n);
    if (!Number.isFinite(n)) return '—';
    return String(n);
  }

  function verdictLabel(v) {
    var eng = engine();
    if (eng && eng.verdictLabel) return eng.verdictLabel(v);
    return v;
  }

  function parseField(id) {
    var el = $(id);
    if (!el) return null;
    var eng = engine();
    if (eng && eng.parseOptionalNumber) return eng.parseOptionalNumber(el.value);
    var n = Number(el.value);
    return Number.isFinite(n) ? n : null;
  }

  function setText(id, text) {
    var el = $(id);
    if (el) el.textContent = text;
  }

  function setHtml(id, html) {
    var el = $(id);
    if (el) el.innerHTML = html;
  }

  function show(id, on) {
    var el = $(id);
    if (el) el.hidden = !on;
  }

  function feeEstimate(exchange) {
    var eng = engine();
    if (!eng || typeof eng.getEstimatedTakerFeePct !== 'function') return null;
    return eng.getEstimatedTakerFeePct(exchange);
  }

  function feeRecord(exchange) {
    var eng = engine();
    if (!eng || typeof eng.getExchangeFeeEstimate !== 'function') return null;
    return eng.getExchangeFeeEstimate(exchange);
  }

  function isStale(ts) {
    if (!ts) return false;
    var t = Date.parse(ts);
    if (!Number.isFinite(t)) return false;
    return (Date.now() - t) > STALE_MS;
  }

  function buildOpportunityLabel(opp) {
    var parts = [];
    parts.push(opp.ticker || opp.symbol || '—');
    parts.push('Buy ' + (opp.buyExchange || '—') + ' → Sell ' + (opp.sellExchange || '—'));
    if (Number.isFinite(opp.rawSpreadPct)) {
      parts.push('Raw spread ' + opp.rawSpreadPct.toFixed(4) + '%');
    }
    if (opp.updatedAt) {
      try {
        parts.push('Data ' + new Date(opp.updatedAt).toLocaleString());
      } catch (_e) {
        parts.push('Data ' + opp.updatedAt);
      }
    }
    return parts.join(' · ');
  }

  function prefillFees(opp) {
    var buyFee = feeEstimate(opp.buyExchange);
    var sellFee = feeEstimate(opp.sellExchange);
    var buyInput = $('calc-fee-buy');
    var sellInput = $('calc-fee-sell');
    if (buyInput) {
      buyInput.value = buyFee === null || buyFee === undefined ? '' : String(buyFee);
      buyInput.dataset.estimated = buyFee === null ? '0' : '1';
    }
    if (sellInput) {
      sellInput.value = sellFee === null || sellFee === undefined ? '' : String(sellFee);
      sellInput.dataset.estimated = sellFee === null ? '0' : '1';
    }
    updateFeeHints(opp);
  }

  function updateFeeHints(opp) {
    var buyKnown = feeEstimate(opp.buyExchange) !== null;
    var sellKnown = feeEstimate(opp.sellExchange) !== null;
    var buyRec = feeRecord(opp.buyExchange);
    var sellRec = feeRecord(opp.sellExchange);
    setText(
      'calc-fee-buy-hint',
      buyKnown
        ? 'Estimated · ' + (buyRec ? buyRec.sourceNote : 'default retail taker')
        : 'Unknown exchange fee — enter manually before calculating'
    );
    setText(
      'calc-fee-sell-hint',
      sellKnown
        ? 'Estimated · ' + (sellRec ? sellRec.sourceNote : 'default retail taker')
        : 'Unknown exchange fee — enter manually before calculating'
    );
    show('calc-fee-unknown-warn', !(buyKnown && sellKnown));
    if (!(buyKnown && sellKnown)) {
      setText(
        'calc-fee-unknown-warn',
        'Missing fee estimate for ' +
          (!buyKnown ? opp.buyExchange : '') +
          (!buyKnown && !sellKnown ? ' and ' : '') +
          (!sellKnown ? opp.sellExchange : '') +
          '. Enter the fee % manually — we will not assume 0.1%.'
      );
    }
  }

  function collectUiWarnings(opp, input, result) {
    var warnings = (result && result.warnings ? result.warnings.slice() : []);
    if (feeEstimate(opp.buyExchange) !== null || feeEstimate(opp.sellExchange) !== null) {
      warnings.unshift('Trading fees shown are estimates (not live VIP / promotional rates).');
    }
    if ((input.withdrawalFeeAsset || 0) === 0) {
      warnings.push('Withdrawal fee is 0 — real transfers usually cost more than zero.');
    }
    if ((input.networkFeeAsset || 0) === 0 && (input.buySlippagePct || 0) === 0 && (input.sellSlippagePct || 0) === 0) {
      warnings.push('Slippage is 0 — thin books can erase a paper spread.');
    } else if ((input.buySlippagePct || 0) === 0 && (input.sellSlippagePct || 0) === 0) {
      warnings.push('Slippage is 0 — thin books can erase a paper spread.');
    }
    if (isStale(opp.updatedAt)) {
      warnings.push('Prices may be older than the usual refresh interval — verify on live order books.');
    }
    if (result && result.verdict === 'marginal') {
      warnings.push('Marginal result — small buffer; any extra cost can flip this to a loss.');
    }
    return warnings;
  }

  function buildInputFromForm(opp) {
    var eng = engine();
    var amount = parseField('calc-amount');
    var buyFee = parseField('calc-fee-buy');
    var sellFee = parseField('calc-fee-sell');
    var wd = parseField('calc-fee-withdraw');
    var net = parseField('calc-fee-network');
    var buySlip = parseField('calc-slip-buy');
    var sellSlip = parseField('calc-slip-sell');
    var additional = parseField('calc-additional');

    var errors = [];
    if (!eng) errors.push('Profit engine failed to load. Refresh the page.');
    if (amount === null || !(amount > 0)) errors.push('Enter a trade amount greater than zero.');
    if (buyFee === null || buyFee < 0) errors.push('Enter a valid buy trading fee % (0 or higher).');
    if (sellFee === null || sellFee < 0) errors.push('Enter a valid sell trading fee % (0 or higher).');
    if (feeEstimate(opp.buyExchange) === null && (buyFee === null || $('calc-fee-buy').value.trim() === '')) {
      errors.push('Buy exchange fee is unknown — enter it before calculating.');
    }
    if (feeEstimate(opp.sellExchange) === null && (sellFee === null || $('calc-fee-sell').value.trim() === '')) {
      errors.push('Sell exchange fee is unknown — enter it before calculating.');
    }
    if (wd === null || wd < 0) errors.push('Withdrawal fee must be 0 or a positive asset amount.');
    if (net === null || net < 0) errors.push('Network fee must be 0 or a positive asset amount.');
    if (buySlip === null || buySlip < 0) errors.push('Buy slippage must be 0 or higher.');
    if (sellSlip === null || sellSlip < 0) errors.push('Sell slippage must be 0 or higher.');
    if (additional === null || additional < 0) errors.push('Additional cost must be 0 or higher.');
    if (!Number.isFinite(opp.buyPrice) || opp.buyPrice <= 0) errors.push('Buy price is missing.');
    if (!Number.isFinite(opp.sellPrice) || opp.sellPrice <= 0) errors.push('Sell price is missing.');

    if (errors.length) {
      return { ok: false, errors: errors };
    }

    return {
      ok: true,
      input: {
        investmentUsd: amount,
        buyExchange: opp.buyExchange,
        sellExchange: opp.sellExchange,
        assetSymbol: opp.ticker || opp.symbol,
        buyPrice: opp.buyPrice,
        sellPrice: opp.sellPrice,
        buyTradingFeePct: buyFee,
        sellTradingFeePct: sellFee,
        withdrawalFeeAsset: wd,
        networkFeeAsset: net,
        buySlippagePct: buySlip,
        sellSlippagePct: sellSlip,
        additionalCostUsd: additional,
      },
    };
  }

  function renderError(errors) {
    var box = $('calc-form-error');
    if (!box) return;
    box.hidden = false;
    box.innerHTML = '<ul>' + errors.map(function (e) { return '<li>' + escapeHtml(e) + '</li>'; }).join('') + '</ul>';
    show('calc-result-panel', false);
    show('calc-aff-actions', false);
  }

  function clearError() {
    var box = $('calc-form-error');
    if (box) {
      box.hidden = true;
      box.innerHTML = '';
    }
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderResult(opp, input, result) {
    clearError();
    show('calc-result-panel', true);

    var panel = $('calc-result-panel');
    if (panel) {
      panel.className = 'calc-result-panel verdict-' + result.verdict;
    }

    setText('calc-verdict-badge', verdictLabel(result.verdict));
    var badge = $('calc-verdict-badge');
    if (badge) badge.setAttribute('data-verdict', result.verdict);

    setText('calc-out-net', formatUsd(result.estimatedNetProfitUsd, true));
    var netEl = $('calc-out-net');
    if (netEl) {
      netEl.className = 'calc-metric-value ' + (result.estimatedNetProfitUsd > 0 ? 'net-pos' : result.estimatedNetProfitUsd < 0 ? 'net-neg' : '');
    }
    setText('calc-out-net-pct', formatPct(result.netProfitPct, true));
    setText('calc-out-gross', formatPct(result.grossSpreadPct));
    setText('calc-out-costs', formatUsd(result.totalEstimatedCostsUsd));
    setText('calc-out-be', formatPct(result.breakEvenSpreadPct));
    setText('calc-out-purchased', formatQty(result.purchasedQty));
    setText('calc-out-sellable', formatQty(result.sellableQty));
    setText('calc-out-proceeds', formatUsd(result.netProceedsUsd));

    setText('calc-bk-buy-fee', formatUsd(result.buyTradingFeeUsd));
    setText('calc-bk-sell-fee', formatUsd(result.sellTradingFeeUsd));
    setText('calc-bk-wd', formatUsd(result.withdrawalCostUsd) + ' (' + formatQty(result.withdrawalCostAsset) + ' asset)');
    setText('calc-bk-network', formatUsd(result.networkCostUsd));
    setText('calc-bk-slip', formatUsd(result.estimatedSlippageCostUsd));
    setText('calc-bk-additional', formatUsd(result.additionalCostUsd));

    var warnings = collectUiWarnings(opp, input, result);
    var wEl = $('calc-warnings');
    if (wEl) {
      if (warnings.length) {
        wEl.hidden = false;
        wEl.innerHTML = warnings.map(function (w) {
          return '<div class="calc-warn-item"><i class="fas fa-triangle-exclamation" aria-hidden="true"></i> ' + escapeHtml(w) + '</div>';
        }).join('');
      } else {
        wEl.hidden = true;
        wEl.innerHTML = '';
      }
    }

    renderAffiliateActions(opp, result);
    state.lastVerdict = result.verdict;
  }

  function renderAffiliateActions(opp, result) {
    var wrap = $('calc-aff-actions');
    if (!wrap) return;
    if (!result || result.verdict === 'invalid') {
      wrap.hidden = true;
      wrap.innerHTML = '';
      return;
    }
    var buyUrl = affiliateUrl(opp.buyExchange);
    var sellUrl = affiliateUrl(opp.sellExchange);
    var html = '<div class="calc-aff-label">Next step (optional)</div><div class="calc-aff-row">';
    if (buyUrl) {
      html += '<a class="btn-mini calc-aff-btn" href="' + escapeHtml(buyUrl) + '" target="_blank" rel="sponsored noopener noreferrer" data-ex="' + escapeHtml(opp.buyExchange) + '" data-aff-side="buy">Open ' + escapeHtml(opp.buyExchange) + '</a>';
    }
    if (sellUrl) {
      html += '<a class="btn-mini calc-aff-btn" href="' + escapeHtml(sellUrl) + '" target="_blank" rel="sponsored noopener noreferrer" data-ex="' + escapeHtml(opp.sellExchange) + '" data-aff-side="sell">Open ' + escapeHtml(opp.sellExchange) + '</a>';
    }
    html += '</div>';
    wrap.innerHTML = html;
    wrap.hidden = false;
    wrap.querySelectorAll('[data-ex]').forEach(function (a) {
      a.addEventListener('click', function () {
        track('affiliate_exchange_clicked', {
          exchange: a.getAttribute('data-ex'),
          asset: opp.ticker || opp.symbol,
          context: 'profit_calculator',
          verdict: result.verdict,
        });
      });
    });
  }

  function runCalc() {
    var opp = state.opportunity;
    if (!opp) return;
    var built = buildInputFromForm(opp);
    if (!built.ok) {
      renderError(built.errors);
      return;
    }
    var eng = engine();
    var result = eng.calculateNetProfit(built.input);
    renderResult(opp, built.input, result);

    var amount = built.input.investmentUsd;
    track('arbitrage_profit_calculated', {
      asset: opp.ticker || opp.symbol,
      buy_exchange: opp.buyExchange,
      sell_exchange: opp.sellExchange,
      amount_bucket: (global.CoinNavigatorTracking && global.CoinNavigatorTracking.bucketAmountUsd)
        ? global.CoinNavigatorTracking.bucketAmountUsd(amount)
        : (eng.bucketAmountUsd ? eng.bucketAmountUsd(amount) : 'unknown'),
      verdict: result.verdict,
      gross_spread_bucket: eng.bucketSpreadPct ? eng.bucketSpreadPct(result.grossSpreadPct) : 'unknown',
      net_profit_bucket: eng.bucketNetProfitUsd ? eng.bucketNetProfitUsd(result.estimatedNetProfitUsd) : 'unknown',
    });
  }

  function getFocusable(modal) {
    return Array.prototype.slice.call(
      modal.querySelectorAll('a[href], button:not([disabled]), textarea, input:not([disabled]), select, [tabindex]:not([tabindex="-1"])')
    ).filter(function (el) {
      return el.offsetParent !== null || el === document.activeElement;
    });
  }

  function onKeydown(e) {
    var modal = $('calc-modal');
    if (!modal || !modal.classList.contains('open')) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      return;
    }
    if (e.key !== 'Tab') return;
    var list = getFocusable(modal);
    if (!list.length) return;
    var first = list[0];
    var last = list[list.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  function open(opportunity, triggerEl) {
    var modal = $('calc-modal');
    if (!modal || !opportunity) return;
    if (!engine()) {
      console.warn('CoinNavigatorNetProfit engine not loaded');
    }

    state.opportunity = opportunity;
    state.triggerEl = triggerEl || null;
    state.prevFocus = document.activeElement;
    state.advancedOpenedTracked = false;

    setText('calc-coin-label', buildOpportunityLabel(opportunity));
    setText('calc-price-meta',
      'Buy @ ' + formatUsd(opportunity.buyPrice) + ' on ' + opportunity.buyExchange +
      ' · Sell @ ' + formatUsd(opportunity.sellPrice) + ' on ' + opportunity.sellExchange
    );

    prefillFees(opportunity);

    // Defaults for advanced (only reset when opening)
    var wd = $('calc-fee-withdraw');
    var net = $('calc-fee-network');
    var sb = $('calc-slip-buy');
    var ss = $('calc-slip-sell');
    var add = $('calc-additional');
    if (wd && !wd.dataset.userTouched) wd.value = '0';
    if (net && !net.dataset.userTouched) net.value = '0';
    if (sb && !sb.dataset.userTouched) sb.value = '0';
    if (ss && !ss.dataset.userTouched) ss.value = '0';
    if (add && !add.dataset.userTouched) add.value = '0';

    show('calc-zero-cost-warn', true);
    clearError();
    show('calc-result-panel', false);
    show('calc-aff-actions', false);

    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');

    var amount = $('calc-amount');
    if (amount) {
      amount.focus();
      amount.select();
    }

    track('arbitrage_profit_check_opened', {
      asset: opportunity.ticker || opportunity.symbol,
      buy_exchange: opportunity.buyExchange,
      sell_exchange: opportunity.sellExchange,
      raw_spread_pct: Number.isFinite(opportunity.rawSpreadPct)
        ? Number(opportunity.rawSpreadPct.toFixed(6))
        : undefined,
    });

    runCalc();
  }

  function close() {
    var modal = $('calc-modal');
    if (!modal) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    if (state.triggerEl && typeof state.triggerEl.focus === 'function') {
      try { state.triggerEl.focus(); } catch (_e) {}
    } else if (state.prevFocus && typeof state.prevFocus.focus === 'function') {
      try { state.prevFocus.focus(); } catch (_e2) {}
    }
  }

  function openFromButton(btn) {
    if (!btn) return;
    var buyPrice = parseFloat(btn.getAttribute('data-buy-price'));
    var sellPrice = parseFloat(btn.getAttribute('data-sell-price'));
    var spread = parseFloat(btn.getAttribute('data-spread'));
    open({
      symbol: btn.getAttribute('data-sym') || '',
      ticker: (btn.getAttribute('data-ticker') || btn.getAttribute('data-sym') || '').replace(/USDT$/i, ''),
      buyExchange: btn.getAttribute('data-buy-ex') || '',
      sellExchange: btn.getAttribute('data-sell-ex') || '',
      buyPrice: buyPrice,
      sellPrice: sellPrice,
      rawSpreadPct: spread,
      updatedAt: btn.getAttribute('data-updated') || '',
    }, btn);
  }

  function markTouched(e) {
    if (e && e.target) e.target.dataset.userTouched = '1';
  }

  function init() {
    document.querySelectorAll('[data-close="calc"]').forEach(function (el) {
      el.addEventListener('click', close);
    });

    var ids = [
      'calc-amount', 'calc-fee-buy', 'calc-fee-sell',
      'calc-fee-withdraw', 'calc-fee-network',
      'calc-slip-buy', 'calc-slip-sell', 'calc-additional',
    ];
    ids.forEach(function (id) {
      var el = $(id);
      if (!el) return;
      el.addEventListener('input', function (e) {
        markTouched(e);
        runCalc();
      });
      el.addEventListener('change', function (e) {
        markTouched(e);
        runCalc();
      });
    });

    var adv = $('calc-advanced');
    if (adv) {
      adv.addEventListener('toggle', function () {
        if (adv.open && !state.advancedOpenedTracked) {
          state.advancedOpenedTracked = true;
          track('arbitrage_advanced_inputs_opened', {});
        }
      });
    }

    document.addEventListener('keydown', onKeydown);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  global.CoinNavigatorProfitCalc = {
    open: open,
    openFromButton: openFromButton,
    close: close,
    runCalc: runCalc,
  };
})(window);
