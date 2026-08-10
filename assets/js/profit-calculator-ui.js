// Homepage "Check Real Profit" modal — uses CoinNavigatorNetProfit (no duplicated math).
(function attachProfitCalculatorUi(global) {
  'use strict';

  var STALE_MS = 20 * 60 * 1000; // warn when snapshot older than ~20 min (refresh is ~15)
  var EXCHANGES = ['Binance', 'MEXC', 'Bybit', 'OKX', 'KuCoin', 'Gate'];
  var CONSENT_VERSION = 'alerts-v1-2026-08-04';

  var state = {
    opportunity: null,
    triggerEl: null,
    lastVerdict: null,
    lastResult: null,
    lastLiveVerdict: null,
    lastLiveResult: null,
    liveInFlight: false,
    advancedOpenedTracked: false,
    focusables: [],
    prevFocus: null,
    alertFormStarted: false,
    alertCreated: false,
  };

  var LIVE_SUPPORTED_EXCHANGES = { Binance: 1, Bybit: 1, MEXC: 1 };
  var LIVE_SUPPORTED_ASSETS = { BTC: 1, ETH: 1, SOL: 1, XRP: 1 };

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
    state.lastResult = result;
    syncAlertSection(opp, result);
  }

  function buildAffiliateButtonsHtml(opp, context, verdict) {
    var buyUrl = affiliateUrl(opp.buyExchange);
    var sellUrl = affiliateUrl(opp.sellExchange);
    var html = '<div class="calc-aff-label">Next step (optional)</div><div class="calc-aff-row">';
    if (buyUrl) {
      html += '<a class="btn-mini calc-aff-btn" href="' + escapeHtml(buyUrl) + '" target="_blank" rel="sponsored noopener noreferrer" data-ex="' + escapeHtml(opp.buyExchange) + '" data-aff-side="buy" data-aff-context="' + escapeHtml(context) + '">Open ' + escapeHtml(opp.buyExchange) + '</a>';
    }
    if (sellUrl) {
      html += '<a class="btn-mini calc-aff-btn" href="' + escapeHtml(sellUrl) + '" target="_blank" rel="sponsored noopener noreferrer" data-ex="' + escapeHtml(opp.sellExchange) + '" data-aff-side="sell" data-aff-context="' + escapeHtml(context) + '">Open ' + escapeHtml(opp.sellExchange) + '</a>';
    }
    html += '</div>';
    return { html: html, verdict: verdict };
  }

  function wireAffiliateClicks(wrap, opp, result, context) {
    if (!wrap) return;
    wrap.querySelectorAll('[data-ex]').forEach(function (a) {
      a.addEventListener('click', function () {
        track('affiliate_exchange_clicked', {
          exchange: a.getAttribute('data-ex'),
          asset: opp.ticker || opp.symbol,
          context: context,
          verdict: result.verdict,
        });
      });
    });
  }

  function renderAffiliateActions(opp, result) {
    var wrap = $('calc-aff-actions');
    if (!wrap) return;
    if (!result || result.verdict === 'invalid') {
      wrap.hidden = true;
      wrap.innerHTML = '';
      return;
    }
    var built = buildAffiliateButtonsHtml(opp, 'profit_calculator', result.verdict);
    wrap.innerHTML = built.html;
    wrap.hidden = false;
    wireAffiliateClicks(wrap, opp, result, 'profit_calculator');
  }

  function liveVerdictLabel(v) {
    var map = {
      potentially_executable: 'Potentially executable',
      marginal: 'Marginal after estimated costs',
      not_profitable: 'Not profitable after estimated costs',
      insufficient_liquidity: 'Insufficient liquidity',
      transfer_unverified: 'Transfer route not verified',
      transfer_unavailable: 'Transfer unavailable',
      stale_data: 'Stale data',
      unsupported: 'Unsupported route',
      unavailable: 'Live data unavailable',
    };
    return map[v] || 'Live data unavailable';
  }

  function fmtLiveNum(n, digits) {
    if (n == null || !Number.isFinite(n)) return 'Unavailable';
    return Number(n).toFixed(digits == null ? 4 : digits);
  }

  function fmtLiveUsd(n) {
    if (n == null || !Number.isFinite(n)) return 'Unavailable';
    return formatUsd(n, true);
  }

  function fmtLivePct(n) {
    if (n == null || !Number.isFinite(n)) return 'Unavailable';
    return formatPct(n, true);
  }

  function fmtTransferBool(v) {
    if (v === true) return 'Open';
    if (v === false) return 'Closed';
    return 'Unavailable';
  }

  function amountBucket(amount) {
    if (global.CoinNavigatorTracking && global.CoinNavigatorTracking.bucketAmountUsd) {
      return global.CoinNavigatorTracking.bucketAmountUsd(amount);
    }
    var eng = engine();
    if (eng && eng.bucketAmountUsd) return eng.bucketAmountUsd(amount);
    return 'unknown';
  }

  function latencyBucket(ms) {
    if (!Number.isFinite(ms) || ms < 0) return 'unknown';
    if (ms < 500) return 'under_500ms';
    if (ms < 1500) return '500_1499ms';
    if (ms < 3000) return '1500_2999ms';
    return '3000ms_plus';
  }

  function netProfitBucket(net) {
    var eng = engine();
    if (eng && eng.bucketNetProfitUsd && net != null && Number.isFinite(net)) {
      return eng.bucketNetProfitUsd(net);
    }
    if (net == null || !Number.isFinite(net)) return 'unknown';
    if (net < 0) return 'negative';
    if (net < 1) return '0_1';
    if (net < 10) return '1_10';
    if (net < 50) return '10_50';
    return '50_plus';
  }

  function liveAsset(opp) {
    return String(opp.ticker || opp.symbol || '')
      .toUpperCase()
      .replace(/USDT$/i, '')
      .replace(/[^A-Z0-9]/g, '');
  }

  function isLiveRouteSupported(opp) {
    if (!opp) return false;
    var asset = liveAsset(opp);
    return !!(LIVE_SUPPORTED_ASSETS[asset] && LIVE_SUPPORTED_EXCHANGES[opp.buyExchange] && LIVE_SUPPORTED_EXCHANGES[opp.sellExchange]);
  }

  function overrideIfTouched(id) {
    var el = $(id);
    if (!el || el.dataset.userTouched !== '1') return null;
    var n = parseField(id);
    if (n === null || !Number.isFinite(n) || n < 0) return null;
    return n;
  }

  function clearLiveError() {
    var box = $('calc-live-error');
    if (box) {
      box.hidden = true;
      box.innerHTML = '';
    }
  }

  function showLiveError(message) {
    var box = $('calc-live-error');
    if (!box) return;
    box.hidden = false;
    box.innerHTML = '<ul><li>' + escapeHtml(message) + '</li></ul>';
  }

  function resetLiveUi() {
    clearLiveError();
    show('calc-live-loading', false);
    show('calc-live-panel', false);
    show('calc-live-recheck', false);
    var aff = $('calc-live-aff');
    if (aff) {
      aff.hidden = true;
      aff.innerHTML = '';
    }
    state.lastLiveResult = null;
    state.lastLiveVerdict = null;
    var btn = $('calc-live-validate');
    if (btn) btn.disabled = false;
  }

  function renderLiveAffiliate(opp, result) {
    var wrap = $('calc-live-aff');
    if (!wrap) return;
    var built = buildAffiliateButtonsHtml(opp, 'live_route_validator', result.verdict);
    wrap.innerHTML = built.html;
    wrap.hidden = false;
    wireAffiliateClicks(wrap, opp, result, 'live_route_validator');
  }

  function renderLiveResult(opp, result, meta) {
    clearLiveError();
    show('calc-live-loading', false);
    show('calc-live-panel', true);
    show('calc-live-recheck', true);

    var panel = $('calc-live-panel');
    if (panel) panel.className = 'calc-result-panel calc-live-panel verdict-' + result.verdict;

    setText('calc-live-verdict', liveVerdictLabel(result.verdict));
    var badge = $('calc-live-verdict');
    if (badge) badge.setAttribute('data-verdict', result.verdict);
    setText('calc-live-confidence', 'Confidence: ' + (result.confidence || '—'));

    var ageSec = result.freshness_seconds;
    if (meta && meta.clientFetchedAt) {
      var age = Math.max(0, Math.round((Date.now() - meta.clientFetchedAt) / 1000));
      ageSec = age;
    }
    setText(
      'calc-live-freshness',
      'Checked ' + ageSec + ' second' + (ageSec === 1 ? '' : 's') + ' ago' +
        (result.expires_at ? ' · Expires ' + new Date(result.expires_at).toLocaleTimeString() : '')
    );

    var buy = result.buy_market || {};
    var sell = result.sell_market || {};
    var tr = result.transfer_route || {};
    var np = result.net_profit || {};

    setHtml(
      'calc-live-buy-prices',
      escapeHtml(fmtLiveNum(buy.bestPrice, 6)) + ' / ' + escapeHtml(fmtLiveNum(buy.averageExecutionPrice, 6)) +
        ' <span class="calc-source-tag">' + escapeHtml(buy.sourceType || 'live') + '</span>'
    );
    setHtml(
      'calc-live-sell-prices',
      escapeHtml(fmtLiveNum(sell.bestPrice, 6)) + ' / ' + escapeHtml(fmtLiveNum(sell.averageExecutionPrice, 6)) +
        ' <span class="calc-source-tag">' + escapeHtml(sell.sourceType || 'live') + '</span>'
    );
    setText(
      'calc-live-slip',
      fmtLiveNum(buy.estimatedSlippagePct, 4) + '% / ' + fmtLiveNum(sell.estimatedSlippagePct, 4) + '%'
    );
    setText(
      'calc-live-fill',
      (buy.fullyFillable ? 'Buy filled' : 'Buy partial') + ' · ' + (sell.fullyFillable ? 'Sell filled' : 'Sell partial')
    );
    setText('calc-live-buy-depth', fmtLiveNum(buy.availableDepthUsd, 2));
    setText('calc-live-sell-depth', fmtLiveNum(sell.availableDepthUsd, 2));

    var networkLabel;
    if (tr.commonNetworks && tr.commonNetworks.length && tr.selectedNetwork) {
      networkLabel = tr.selectedNetwork + ' (verified common)';
    } else if (!tr.selectedNetwork) {
      networkLabel = 'Unavailable';
    } else {
      networkLabel = tr.selectedNetwork + ' (preferred, not verified)';
    }
    setText('calc-live-network', networkLabel);
    setText(
      'calc-live-transfer-status',
      'Dep ' + fmtTransferBool(tr.depositEnabled) + ' / Wd ' + fmtTransferBool(tr.withdrawalEnabled)
    );

    var wdKind = (result.fee_sources && result.fee_sources.withdrawal_fee_kind) || tr.sourceType || 'unavailable';
    var wdText = fmtLiveNum(tr.withdrawalFeeAsset, 8);
    if (wdText !== 'Unavailable') {
      wdText += wdKind === 'estimated' ? ' (user-provided / estimated)' : ' (' + wdKind + ')';
    }
    setText('calc-live-wd-fee', wdText);

    var netEl = $('calc-live-net');
    setText('calc-live-net', fmtLiveUsd(np.estimatedNetProfitUsd));
    if (netEl) {
      netEl.className = 'calc-metric-value ' + (
        np.estimatedNetProfitUsd > 0 ? 'net-pos' : np.estimatedNetProfitUsd < 0 ? 'net-neg' : ''
      );
    }
    setText('calc-live-net-pct', fmtLivePct(np.netProfitPct));
    setText(
      'calc-live-route',
      (result.request && result.request.asset ? result.request.asset : liveAsset(opp)) +
        ' · Buy ' + opp.buyExchange + ' → Sell ' + opp.sellExchange +
        ' · $' + fmtLiveNum(result.request && result.request.trade_amount_usd, 2)
    );

    var warnings = (result.warnings || []).slice();
    var wEl = $('calc-live-warnings');
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

    var unavailable = result.unavailable_fields || [];
    var uWrap = $('calc-live-unavailable-wrap');
    var uList = $('calc-live-unavailable');
    if (uWrap && uList) {
      if (unavailable.length) {
        uWrap.hidden = false;
        uList.innerHTML = unavailable.map(function (f) {
          return '<li>' + escapeHtml(f) + '</li>';
        }).join('');
      } else {
        uWrap.hidden = true;
        uList.innerHTML = '';
      }
    }

    renderLiveAffiliate(opp, result);
    state.lastLiveVerdict = result.verdict;
    state.lastLiveResult = result;
  }

  async function runLiveValidation(opts) {
    opts = opts || {};
    var opp = state.opportunity;
    if (!opp || state.liveInFlight) return;

    clearLiveError();
    if (!isLiveRouteSupported(opp)) {
      showLiveError('Live validation currently supports BTC, ETH, SOL, XRP on Binance, Bybit and MEXC only.');
      track('live_route_validation_failed', {
        asset: liveAsset(opp),
        failure_category: 'unsupported_route',
        exchange_category: 'allowlist',
      });
      return;
    }

    var amount = parseField('calc-amount');
    if (amount === null || !(amount >= 10) || amount > 100000) {
      showLiveError('Enter a trade amount between $10 and $100,000 for live validation.');
      track('live_route_validation_failed', {
        asset: liveAsset(opp),
        failure_category: 'validation_error',
      });
      return;
    }

    var buyFee = parseField('calc-fee-buy');
    var sellFee = parseField('calc-fee-sell');
    var wdOverride = overrideIfTouched('calc-fee-withdraw');
    var netOverride = overrideIfTouched('calc-fee-network');
    var preferredEl = $('calc-preferred-network');
    var preferred = preferredEl && preferredEl.value.trim() ? preferredEl.value.trim().slice(0, 32) : null;

    var prevVerdict = state.lastLiveVerdict;
    var startedAt = Date.now();
    state.liveInFlight = true;
    show('calc-live-loading', true);
    show('calc-live-panel', false);
    var btn = $('calc-live-validate');
    var recheck = $('calc-live-recheck');
    if (btn) btn.disabled = true;
    if (recheck) recheck.disabled = true;

    track('live_route_validation_started', {
      asset: liveAsset(opp),
      buy_exchange: opp.buyExchange,
      sell_exchange: opp.sellExchange,
      amount_bucket: amountBucket(amount),
    });

    try {
      var payload = {
        asset: liveAsset(opp),
        quote: 'USDT',
        buy_exchange: opp.buyExchange,
        sell_exchange: opp.sellExchange,
        trade_amount_usd: amount,
        preferred_network: preferred,
        overrides: {
          buy_fee_pct: buyFee,
          sell_fee_pct: sellFee,
          withdrawal_fee_asset: wdOverride,
          network_fee_asset: netOverride,
        },
      };

      var res = await fetch('/api/route-validator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      });
      var data = null;
      try {
        data = await res.json();
      } catch (_e) {
        data = null;
      }

      var latency = Date.now() - startedAt;
      if (!res.ok || !data || !data.ok) {
        var code = data && data.error && data.error.code ? data.error.code : 'SERVER_ERROR';
        var msg = data && data.error && data.error.message
          ? data.error.message
          : 'Live market data is temporarily unavailable.';
        show('calc-live-loading', false);
        showLiveError(msg);
        track('live_route_validation_failed', {
          asset: liveAsset(opp),
          failure_category: code === 'RATE_LIMITED' ? 'rate_limited' : code === 'VALIDATION_ERROR' ? 'validation_error' : 'market_unavailable',
          exchange_category: 'upstream',
        });
        return;
      }

      renderLiveResult(opp, data.result, { clientFetchedAt: Date.now() });
      if (opts.recheck) {
        track('live_route_rechecked', {
          asset: liveAsset(opp),
          verdict_previous: prevVerdict || 'none',
          verdict_new: data.result.verdict,
        });
      }
      track('live_route_validation_completed', {
        asset: liveAsset(opp),
        buy_exchange: opp.buyExchange,
        sell_exchange: opp.sellExchange,
        verdict: data.result.verdict,
        confidence: data.result.confidence,
        amount_bucket: amountBucket(amount),
        fully_fillable: !!(data.result.buy_market && data.result.buy_market.fullyFillable &&
          data.result.sell_market && data.result.sell_market.fullyFillable),
        transfer_verified: !!(data.result.transfer_route && data.result.transfer_route.sourceType === 'live' &&
          data.result.transfer_route.selectedNetwork &&
          data.result.transfer_route.depositEnabled === true &&
          data.result.transfer_route.withdrawalEnabled === true),
        net_profit_bucket: netProfitBucket(data.result.net_profit && data.result.net_profit.estimatedNetProfitUsd),
        latency_bucket: latencyBucket(latency),
      });
    } catch (_err) {
      show('calc-live-loading', false);
      showLiveError('Network error while validating the live route. Please try again.');
      track('live_route_validation_failed', {
        asset: liveAsset(opp),
        failure_category: 'network_failure',
      });
    } finally {
      state.liveInFlight = false;
      if (btn) btn.disabled = false;
      if (recheck) recheck.disabled = false;
    }
  }

  function fillExchangeSelect(selectEl, selected) {
    if (!selectEl) return;
    selectEl.innerHTML = EXCHANGES.map(function (ex) {
      return '<option value="' + escapeHtml(ex) + '"' + (ex === selected ? ' selected' : '') + '>' + escapeHtml(ex) + '</option>';
    }).join('');
  }

  function defaultMinPct(result) {
    var pct = result && Number.isFinite(result.estimatedNetProfitPct)
      ? result.estimatedNetProfitPct
      : 0.25;
    var rounded = Math.floor(pct * 100) / 100;
    if (!Number.isFinite(rounded) || rounded < 0.25) return 0.25;
    return rounded;
  }

  function resetAlertUi() {
    state.alertFormStarted = false;
    state.alertCreated = false;
    var form = $('calc-alert-form');
    var success = $('calc-alert-success');
    var cta = $('calc-alert-cta');
    var err = $('calc-alert-error');
    if (form) form.hidden = true;
    if (success) success.hidden = true;
    if (cta) {
      cta.hidden = false;
      cta.setAttribute('aria-expanded', 'false');
    }
    if (err) {
      err.hidden = true;
      err.textContent = '';
    }
    var consent = $('calc-alert-consent');
    if (consent) consent.checked = false;
    var website = $('calc-alert-website');
    if (website) website.value = '';
  }

  function syncAlertSection(opp, result) {
    var section = $('calc-alert-section');
    if (!section) return;
    if (!result || result.verdict === 'invalid' || state.alertCreated) {
      if (!state.alertCreated) section.hidden = true;
      return;
    }
    section.hidden = false;
    if ($('calc-alert-form') && !$('calc-alert-form').hidden) {
      // Keep user edits while recalculating; only refresh defaults when form closed
      return;
    }
    var asset = (opp.ticker || opp.symbol || '').replace(/USDT$/i, '');
    var assetEl = $('calc-alert-asset');
    var minPct = $('calc-alert-min-pct');
    var minUsd = $('calc-alert-min-usd');
    if (assetEl) assetEl.value = asset;
    fillExchangeSelect($('calc-alert-buy'), opp.buyExchange);
    fillExchangeSelect($('calc-alert-sell'), opp.sellExchange);
    if (minPct) minPct.value = String(defaultMinPct(result));
    if (minUsd) {
      minUsd.value = (result.estimatedNetProfitUsd > 0)
        ? String(Math.round(result.estimatedNetProfitUsd * 100) / 100)
        : '';
    }
    updateAlertScopeUi();
  }

  function updateAlertScopeUi() {
    var scope = $('calc-alert-scope');
    var buy = $('calc-alert-buy');
    var sell = $('calc-alert-sell');
    var any = scope && scope.value === 'any_pair';
    if (buy) buy.disabled = !!any;
    if (sell) sell.disabled = !!any;
  }

  function openAlertForm() {
    var opp = state.opportunity;
    var result = state.lastResult;
    if (!opp || !result || result.verdict === 'invalid') return;
    var form = $('calc-alert-form');
    var cta = $('calc-alert-cta');
    var success = $('calc-alert-success');
    if (!form) return;
    if (success) success.hidden = true;
    form.hidden = false;
    if (cta) {
      cta.setAttribute('aria-expanded', 'true');
      cta.hidden = true;
    }
    syncAlertSection(opp, result);
    // Force prefills when opening
    var asset = (opp.ticker || opp.symbol || '').replace(/USDT$/i, '');
    var assetEl = $('calc-alert-asset');
    if (assetEl) assetEl.value = asset;
    fillExchangeSelect($('calc-alert-buy'), opp.buyExchange);
    fillExchangeSelect($('calc-alert-sell'), opp.sellExchange);
    var minPct = $('calc-alert-min-pct');
    var minUsd = $('calc-alert-min-usd');
    if (minPct) minPct.value = String(defaultMinPct(result));
    if (minUsd) {
      minUsd.value = (result.estimatedNetProfitUsd > 0)
        ? String(Math.round(result.estimatedNetProfitUsd * 100) / 100)
        : '';
    }
    updateAlertScopeUi();

    var scope = ($('calc-alert-scope') && $('calc-alert-scope').value) || 'exact_pair';
    track('arbitrage_alert_cta_clicked', {
      asset: asset,
      buy_exchange: opp.buyExchange,
      sell_exchange: opp.sellExchange,
      verdict: result.verdict,
      alert_scope: scope,
    });
    if (!state.alertFormStarted) {
      state.alertFormStarted = true;
      track('arbitrage_alert_form_started', {
        asset: asset,
        alert_scope: scope,
      });
    }
    var email = $('calc-alert-email');
    if (email) {
      try { email.focus(); } catch (_e) {}
    }
  }

  function showAlertError(message) {
    var err = $('calc-alert-error');
    if (!err) return;
    err.hidden = false;
    err.textContent = message;
  }

  function clearAlertError() {
    var err = $('calc-alert-error');
    if (!err) return;
    err.hidden = true;
    err.textContent = '';
  }

  function showAlertSuccess(opp, result) {
    var form = $('calc-alert-form');
    var success = $('calc-alert-success');
    var cta = $('calc-alert-cta');
    var aff = $('calc-alert-success-aff');
    if (form) form.hidden = true;
    if (cta) cta.hidden = true;
    if (success) success.hidden = false;
    if (aff) {
      var built = buildAffiliateButtonsHtml(opp, 'alert_success', result.verdict);
      aff.innerHTML = built.html;
      wireAffiliateClicks(aff, opp, result, 'alert_success');
    }
    state.alertCreated = true;
    try { success && success.focus && success.focus(); } catch (_e) {}
  }

  function parseOptionalThreshold(raw) {
    if (raw == null || String(raw).trim() === '') return null;
    var n = Number(raw);
    return Number.isFinite(n) ? n : NaN;
  }

  async function submitAlertForm(e) {
    if (e && e.preventDefault) e.preventDefault();
    clearAlertError();
    var opp = state.opportunity;
    var result = state.lastResult;
    if (!opp || !result) return;

    var emailEl = $('calc-alert-email');
    var consentEl = $('calc-alert-consent');
    var scopeEl = $('calc-alert-scope');
    var assetEl = $('calc-alert-asset');
    var buyEl = $('calc-alert-buy');
    var sellEl = $('calc-alert-sell');
    var minPctEl = $('calc-alert-min-pct');
    var minUsdEl = $('calc-alert-min-usd');
    var websiteEl = $('calc-alert-website');
    var submitBtn = $('calc-alert-submit');

    var alertScope = (scopeEl && scopeEl.value) || 'exact_pair';
    var asset = assetEl ? assetEl.value.trim() : '';
    var minPct = parseOptionalThreshold(minPctEl && minPctEl.value);
    var minUsd = parseOptionalThreshold(minUsdEl && minUsdEl.value);

    if (!emailEl || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailEl.value.trim())) {
      showAlertError('Enter a valid email address.');
      track('arbitrage_alert_failed', {
        failure_category: 'invalid_email',
        asset: asset,
        alert_scope: alertScope,
      });
      return;
    }
    if (!consentEl || !consentEl.checked) {
      showAlertError('Please confirm consent to create an alert.');
      track('arbitrage_alert_failed', {
        failure_category: 'missing_consent',
        asset: asset,
        alert_scope: alertScope,
      });
      return;
    }
    if (Number.isNaN(minPct) || Number.isNaN(minUsd) || (minPct != null && minPct < 0) || (minUsd != null && minUsd < 0)) {
      showAlertError('Profit thresholds must be valid non-negative numbers.');
      track('arbitrage_alert_failed', {
        failure_category: 'validation',
        asset: asset,
        alert_scope: alertScope,
      });
      return;
    }

    var payload = {
      email: emailEl.value.trim(),
      asset: asset,
      buy_exchange: buyEl ? buyEl.value : opp.buyExchange,
      sell_exchange: sellEl ? sellEl.value : opp.sellExchange,
      alert_scope: alertScope,
      minimum_net_profit_pct: minPct,
      minimum_net_profit_usd: minUsd,
      source_page: 'home',
      source_context: 'check_real_profit',
      consent: true,
      consent_version: CONSENT_VERSION,
      website: websiteEl ? websiteEl.value : '',
    };

    track('arbitrage_alert_submitted', {
      asset: asset,
      alert_scope: alertScope,
      has_net_profit_pct_threshold: minPct != null,
      has_net_profit_usd_threshold: minUsd != null,
    });

    if (submitBtn) submitBtn.disabled = true;
    try {
      var res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      });
      var data = null;
      try { data = await res.json(); } catch (_e) { data = null; }

      if (res.ok && data && data.ok) {
        track('arbitrage_alert_created', {
          asset: asset,
          alert_scope: alertScope,
        });
        // Clear email from DOM after success — do not echo it
        emailEl.value = '';
        showAlertSuccess(opp, result);
        return;
      }

      var category = 'server_error';
      var message = 'Unable to create your alert right now. Please try again later.';
      if (res.status === 429) {
        category = 'rate_limited';
        message = 'Too many requests. Please try again later.';
      } else if (data && data.error && data.error.code === 'MISSING_CONFIG') {
        category = 'missing_config';
        message = 'Alert storage is temporarily unavailable.';
      } else if (data && data.error && data.error.code === 'VALIDATION_ERROR') {
        category = 'validation';
        message = data.error.message || message;
      } else if (!res.ok && res.status >= 500) {
        category = 'server_unavailable';
      } else if (!res.ok) {
        category = 'network_failure';
      }
      track('arbitrage_alert_failed', {
        failure_category: category,
        asset: asset,
        alert_scope: alertScope,
      });
      showAlertError(message);
    } catch (_err) {
      track('arbitrage_alert_failed', {
        failure_category: 'network_failure',
        asset: asset,
        alert_scope: alertScope,
      });
      showAlertError('Network error. Please try again.');
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
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
    resetLiveUi();
    resetAlertUi();
    show('calc-alert-section', false);
    state.lastResult = null;

    var liveBtn = $('calc-live-validate');
    if (liveBtn) {
      liveBtn.hidden = !isLiveRouteSupported(opportunity);
    }

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

    var alertCta = $('calc-alert-cta');
    if (alertCta) alertCta.addEventListener('click', openAlertForm);
    var alertForm = $('calc-alert-form');
    if (alertForm) alertForm.addEventListener('submit', submitAlertForm);
    var scopeEl = $('calc-alert-scope');
    if (scopeEl) scopeEl.addEventListener('change', updateAlertScopeUi);

    var liveBtn = $('calc-live-validate');
    if (liveBtn) {
      liveBtn.addEventListener('click', function () {
        runLiveValidation({ recheck: false });
      });
    }
    var recheckBtn = $('calc-live-recheck');
    if (recheckBtn) {
      recheckBtn.addEventListener('click', function () {
        runLiveValidation({ recheck: true });
      });
    }
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
