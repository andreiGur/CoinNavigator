// Shared spread payload computation and live exchange fallback.
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
      source: 'browser_live_fallback'
    };
  }

  async function fetchLiveSpreadFallback(targetSymbols) {
    var targetSet = new Set(targetSymbols || []);
    var exchangeRequests = [
      {
        name: 'Binance',
        fetcher: async function () {
          var res = await fetch('https://api.binance.com/api/v3/ticker/price', { cache: 'no-store' });
          if (!res.ok) throw new Error('binance_http_' + res.status);
          var arr = await res.json();
          var map = {};
          for (var i = 0; i < (Array.isArray(arr) ? arr : []).length; i++) {
            var row = arr[i];
            if (!row || !targetSet.has(row.symbol)) continue;
            var p = parseFloat(row.price);
            if (Number.isFinite(p) && p > 0) map[row.symbol] = p;
          }
          return map;
        }
      },
      {
        name: 'MEXC',
        fetcher: async function () {
          var res = await fetch('https://api.mexc.com/api/v3/ticker/price', { cache: 'no-store' });
          if (!res.ok) throw new Error('mexc_http_' + res.status);
          var arr = await res.json();
          var map = {};
          for (var i = 0; i < (Array.isArray(arr) ? arr : []).length; i++) {
            var row = arr[i];
            if (!row || !targetSet.has(row.symbol)) continue;
            var p = parseFloat(row.price);
            if (Number.isFinite(p) && p > 0) map[row.symbol] = p;
          }
          return map;
        }
      },
      {
        name: 'Bybit',
        fetcher: async function () {
          var res = await fetch('https://api.bybit.com/v5/market/tickers?category=spot', { cache: 'no-store' });
          if (!res.ok) throw new Error('bybit_http_' + res.status);
          var json = await res.json();
          var list = (((json || {}).result || {}).list) || [];
          var map = {};
          for (var i = 0; i < list.length; i++) {
            var row = list[i];
            var symbol = row && row.symbol;
            if (!symbol || !targetSet.has(symbol)) continue;
            var p = parseFloat(row.lastPrice);
            if (Number.isFinite(p) && p > 0) map[symbol] = p;
          }
          return map;
        }
      },
      {
        name: 'OKX',
        fetcher: async function () {
          var res = await fetch('https://www.okx.com/api/v5/market/tickers?instType=SPOT', { cache: 'no-store' });
          if (!res.ok) throw new Error('okx_http_' + res.status);
          var json = await res.json();
          var list = (json && Array.isArray(json.data)) ? json.data : [];
          var map = {};
          for (var i = 0; i < list.length; i++) {
            var row = list[i];
            var instId = row && row.instId;
            if (!instId || !instId.endsWith('-USDT')) continue;
            var symbol = instId.replace('-', '');
            if (!targetSet.has(symbol)) continue;
            var p = parseFloat(row.last);
            if (Number.isFinite(p) && p > 0) map[symbol] = p;
          }
          return map;
        }
      },
      {
        name: 'KuCoin',
        fetcher: async function () {
          var res = await fetch('https://api.kucoin.com/api/v1/market/allTickers', { cache: 'no-store' });
          if (!res.ok) throw new Error('kucoin_http_' + res.status);
          var json = await res.json();
          var list = (((json || {}).data || {}).ticker) || [];
          var map = {};
          for (var i = 0; i < list.length; i++) {
            var row = list[i];
            var pair = row && row.symbol;
            if (!pair || !pair.endsWith('-USDT')) continue;
            var symbol = pair.replace('-', '');
            if (!targetSet.has(symbol)) continue;
            var p = parseFloat(row.last);
            if (Number.isFinite(p) && p > 0) map[symbol] = p;
          }
          return map;
        }
      },
      {
        name: 'Gate',
        fetcher: async function () {
          var res = await fetch('https://api.gateio.ws/api/v4/spot/tickers', { cache: 'no-store' });
          if (!res.ok) throw new Error('gate_http_' + res.status);
          var arr = await res.json();
          var map = {};
          for (var i = 0; i < (Array.isArray(arr) ? arr : []).length; i++) {
            var row = arr[i];
            var pair = row && row.currency_pair;
            if (!pair || !pair.endsWith('_USDT')) continue;
            var symbol = pair.replace('_', '');
            if (!targetSet.has(symbol)) continue;
            var p = parseFloat(row.last);
            if (Number.isFinite(p) && p > 0) map[symbol] = p;
          }
          return map;
        }
      }
    ];

    var settled = await Promise.allSettled(exchangeRequests.map(function (x) { return x.fetcher(); }));
    var snapshots = {};
    for (var i = 0; i < exchangeRequests.length; i++) {
      var name = exchangeRequests[i].name;
      var result = settled[i];
      if (result.status === 'fulfilled' && result.value && Object.keys(result.value).length > 0) {
        snapshots[name] = result.value;
      }
    }

    var payload = computeSpreadPayloadFromExchangePrices(snapshots, targetSymbols || []);
    if (!payload.exchanges || payload.exchanges.length < 2) {
      throw new Error('live_fallback_insufficient_exchanges');
    }
    return payload;
  }

  global.CoinNavigatorSpreadEngine = {
    computeSpreadPayloadFromExchangePrices: computeSpreadPayloadFromExchangePrices,
    fetchLiveSpreadFallback: fetchLiveSpreadFallback
  };
})(window);
