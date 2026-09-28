/* Loads the saved spread snapshot, then live prices if that file is older than 3 minutes. */
(function (global) {
  var STALE_MS = 3 * 60 * 1000;

  function ageMs(data) {
    if (!data || !data.timestamp) return Infinity;
    var t = Date.parse(data.timestamp);
    if (!isFinite(t)) return Infinity;
    return Date.now() - t;
  }

  function fetchJson(url) {
    return fetch(url, { cache: 'no-store', headers: { Accept: 'application/json' } }).then(function (r) {
      if (!r.ok) throw new Error('http');
      return r.json();
    });
  }

  function fetchStatic() {
    var paths = ['/data/spread_data.json', '/spread_data.json'];
    var i = 0;
    function next() {
      if (i >= paths.length) return Promise.reject(new Error('no_snapshot'));
      return fetchJson(paths[i++] + '?t=' + Date.now()).catch(next);
    }
    return next();
  }

  function fetchLive() {
    return fetch('/api/market-data?operation=spread_snapshot', {
      cache: 'no-store',
      headers: { Accept: 'application/json' }
    }).then(function (r) {
      return r.json();
    }).then(function (body) {
      if (!body || body.ok !== true || !body.data || !body.data.symbols) throw new Error('live');
      if (!body.data.source) body.data.source = 'live_gateway';
      return body.data;
    });
  }

  function load() {
    return fetchStatic().then(function (data) {
      if (ageMs(data) > STALE_MS) {
        return fetchLive().catch(function () { return data; });
      }
      return data;
    }).catch(function () {
      return fetchLive();
    });
  }

  global.CoinNavigatorSpreadSnapshot = { load: load };
})(window);
