// Shared spread payload computation and live gateway fallback.
// Browser must NOT call exchange market APIs — only CoinNavigator endpoints / static JSON.
(function attachSpreadEngine(global) {
  function computeSpreadPayloadFromExchangePrices(exchangeSnapshots, targetSymbols) {
    var symbolsData = {};
    var errors = {};
    var exchanges = Object.keys(exchangeSnapshots || {});
    var targets = targetSymbols || [];

    for (var i = 0; i < targets.length; i++) {
      var symbol = targets[i];
      var prices = {};
      var symErrors = {};

      for (var j = 0; j < exchanges.length; j++) {
        var ex = exchanges[j];
        var priceMap = exchangeSnapshots[ex] || {};
        var v = priceMap[symbol];
        if (typeof v === 'number' && Number.isFinite(v) && v > 0) {
          prices[ex] = v;
        } else {
          symErrors[ex] = 'no_live_price';
        }
      }

      var best_buy = null;
      var best_sell = null;
      var absolute_diff = null;
      var spread_percent = null;

      var values = Object.values(prices);
      if (values.length > 0) {
        var minPrice = Math.min.apply(Math, values);
        var maxPrice = Math.max.apply(Math, values);
        var bestBuyEx = Object.keys(prices).find(function (k) { return prices[k] === minPrice; }) || null;
        var bestSellEx = Object.keys(prices).find(function (k) { return prices[k] === maxPrice; }) || null;
        if (bestBuyEx && bestSellEx) {
          best_buy = { exchange: bestBuyEx, price: minPrice };
          best_sell = { exchange: bestSellEx, price: maxPrice };
          absolute_diff = +(maxPrice - minPrice).toFixed(2);
          spread_percent = minPrice > 0 ? +(((maxPrice - minPrice) / minPrice).toFixed(8)) : null;
        }
      }

      symbolsData[symbol] = {
        prices: prices,
        absolute_diff: absolute_diff,
        spread_percent: spread_percent,
        best_buy: best_buy,
        best_sell: best_sell,
        binance_price: prices.Binance ?? null,
        bybit_price: prices.Bybit ?? null
      };
      if (Object.keys(symErrors).length) errors[symbol] = symErrors;
    }

    return {
      timestamp: new Date().toISOString(),
      symbols: symbolsData,
      errors: errors,
      exchanges: exchanges,
      source: 'live_gateway'
    };
  }

  function trackGatewayFailed(props) {
    try {
      if (typeof global.track === 'function') {
        global.track('market_data_gateway_failed', props || {});
      }
    } catch (_e) {}
  }

  /**
   * Live fallback via CoinNavigator market-data gateway (no browser→exchange calls).
   * Preserves the existing payload contract expected by the homepage dashboard.
   */
  async function fetchLiveSpreadFallback(targetSymbols) {
    var res;
    try {
      res = await fetch('/api/market-data?operation=spread_snapshot', {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
    } catch (_err) {
      trackGatewayFailed({
        operation: 'spread_snapshot',
        failure_category: 'network_failure',
        partial_success: false,
        unavailable_exchange_count: 0,
      });
      throw new Error('live_gateway_network');
    }

    var body = null;
    try {
      body = await res.json();
    } catch (_e) {
      body = null;
    }

    if (!res.ok || !body || !body.ok || !body.data) {
      var unavailable = (body && body.data && body.data.unavailable_exchanges) || [];
      trackGatewayFailed({
        operation: 'spread_snapshot',
        failure_category: res.status === 429 ? 'rate_limited' : 'market_unavailable',
        partial_success: false,
        unavailable_exchange_count: Array.isArray(unavailable) ? unavailable.length : 0,
      });
      throw new Error('live_gateway_unavailable');
    }

    var payload = body.data;
    // Ensure source tag for freshness banner
    if (!payload.source) payload.source = 'live_gateway';

    if (!payload.exchanges || payload.exchanges.length < 2 || !payload.symbols) {
      trackGatewayFailed({
        operation: 'spread_snapshot',
        failure_category: 'insufficient_exchanges',
        partial_success: !!(payload.exchanges && payload.exchanges.length > 0),
        unavailable_exchange_count: Array.isArray(payload.unavailable_exchanges)
          ? payload.unavailable_exchanges.length
          : 0,
      });
      throw new Error('live_fallback_insufficient_exchanges');
    }

    // Optional: if caller passed a subset, filter is already server-side allowlisted.
    void targetSymbols;
    return payload;
  }

  /**
   * Reference price via gateway (replaces direct Binance ticker fetch).
   */
  var _refCache = { key: '', ts: 0, price: null };

  async function fetchReferencePrice(opts) {
    opts = opts || {};
    var asset = opts.asset || 'BTC';
    var quote = opts.quote || 'USDT';
    var exchange = opts.exchange || 'Binance';
    var key = asset + '/' + quote + '@' + exchange;
    if (_refCache.key === key && _refCache.price != null && (Date.now() - _refCache.ts) < 8000) {
      return { price: _refCache.price, fetched_at: null, cache_hit: true };
    }

    var url =
      '/api/market-data?operation=reference_price' +
      '&asset=' + encodeURIComponent(asset) +
      '&quote=' + encodeURIComponent(quote) +
      '&exchange=' + encodeURIComponent(exchange);

    var res;
    try {
      res = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
    } catch (_err) {
      trackGatewayFailed({
        operation: 'reference_price',
        failure_category: 'network_failure',
        partial_success: false,
        unavailable_exchange_count: 1,
      });
      return null;
    }

    var body = null;
    try {
      body = await res.json();
    } catch (_e2) {
      body = null;
    }

    if (!res.ok || !body || !body.ok || !body.data || !Number.isFinite(body.data.price)) {
      trackGatewayFailed({
        operation: 'reference_price',
        failure_category: res.status === 429 ? 'rate_limited' : 'market_unavailable',
        partial_success: false,
        unavailable_exchange_count: 1,
      });
      return null;
    }

    _refCache = { key: key, ts: Date.now(), price: body.data.price };
    return {
      price: body.data.price,
      fetched_at: body.data.fetched_at || null,
      cache_hit: !!body.cache_hit,
    };
  }

  global.CoinNavigatorSpreadEngine = {
    computeSpreadPayloadFromExchangePrices: computeSpreadPayloadFromExchangePrices,
    fetchLiveSpreadFallback: fetchLiveSpreadFallback,
    fetchReferencePrice: fetchReferencePrice,
  };
})(window);
