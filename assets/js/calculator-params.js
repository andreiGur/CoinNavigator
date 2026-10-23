// Validated calculator URL params (mirrored in src/funnel/calculator-params.ts).
(function (global) {
  'use strict';

  var ASSET_RE = /^[A-Za-z0-9]{2,12}$/;

  function clampNum(n, min, max) {
    if (!Number.isFinite(n)) return undefined;
    if (n < min || n > max) return undefined;
    return n;
  }

  function parseNumber(raw) {
    if (raw == null || raw === '') return undefined;
    var n = Number(String(raw).trim());
    return Number.isFinite(n) ? n : undefined;
  }

  function parseCalculatorParams(search) {
    var q = typeof search === 'string'
      ? new URLSearchParams(search.replace(/^\?/, ''))
      : (search || new URLSearchParams());
    var out = {};

    var amount = clampNum(parseNumber(q.get('amount')), 1, 10000000);
    if (amount != null) out.amount = amount;

    var spread = clampNum(parseNumber(q.get('spread')), 0, 10);
    if (spread != null) out.spread = spread;

    var buyFee = clampNum(parseNumber(q.get('buyFee') || q.get('buy_fee')), 0, 2);
    if (buyFee != null) out.buyFee = buyFee;

    var sellFee = clampNum(parseNumber(q.get('sellFee') || q.get('sell_fee')), 0, 2);
    if (sellFee != null) out.sellFee = sellFee;

    var transfer = clampNum(parseNumber(q.get('transfer')), 0, 100);
    if (transfer != null) out.transfer = transfer;

    var assetRaw = (q.get('asset') || q.get('sym') || '').trim().toUpperCase();
    if (ASSET_RE.test(assetRaw)) out.asset = assetRaw;

    return out;
  }

  function buildCalculatorUrl(basePath, params) {
    params = params || {};
    var q = new URLSearchParams();
    if (params.asset) q.set('asset', params.asset);
    if (params.spread != null) q.set('spread', String(params.spread));
    if (params.amount != null) q.set('amount', String(params.amount));
    if (params.buyFee != null) q.set('buyFee', String(params.buyFee));
    if (params.sellFee != null) q.set('sellFee', String(params.sellFee));
    if (params.transfer != null) q.set('transfer', String(params.transfer));
    var qs = q.toString();
    var base = basePath || '/arbitrage-calculator/';
    return qs ? base + '?' + qs : base;
  }

  function applyCalculatorParamsToForm(params, doc) {
    doc = doc || document;
    params = params || {};
    function setInput(id, value) {
      if (value == null) return;
      var el = doc.getElementById(id);
      if (!el) return;
      el.value = String(value);
    }
    setInput('inp-amount', params.amount);
    setInput('inp-spread', params.spread);
    setInput('inp-buy-fee', params.buyFee);
    setInput('inp-sell-fee', params.sellFee);
    setInput('inp-transfer', params.transfer);

    if (params.asset) {
      var note = doc.getElementById('cn-calc-asset-note');
      if (note) {
        note.hidden = false;
        note.textContent = 'Prefilling from scanner context for ' + params.asset +
          '. Spreads change quickly — recheck live prices before any trade.';
      }
    }
  }

  global.CoinNavigatorCalculatorParams = {
    parseCalculatorParams: parseCalculatorParams,
    buildCalculatorUrl: buildCalculatorUrl,
    applyCalculatorParamsToForm: applyCalculatorParamsToForm
  };
  global.parseCalculatorParams = parseCalculatorParams;
  global.buildCalculatorUrl = buildCalculatorUrl;
})(window);
