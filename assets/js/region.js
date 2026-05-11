// Shared region detection and regionalized link helpers.
(function attachRegionUtils(global) {
  var VALID_REGIONS = ['EU', 'RU', 'US', 'ASIA'];

  function getRegionFromQuery() {
    var p = new URLSearchParams(window.location.search);
    var r = p.get('region');
    return (r && VALID_REGIONS.includes(r)) ? r : null;
  }

  function guessRegion() {
    try {
      var tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      if (tz.startsWith('Europe/')) return 'EU';
      if (tz.startsWith('Asia/')) return 'ASIA';
      if (tz.startsWith('America/')) return 'US';
    } catch (_err) {}
    return 'EU';
  }

  function getRegion() {
    var q = getRegionFromQuery();
    if (q) return q;
    var saved = localStorage.getItem('coinnavigator_region');
    if (saved && VALID_REGIONS.includes(saved)) return saved;
    return guessRegion();
  }

  function setRegion(region, options) {
    var opts = options || {};
    localStorage.setItem('coinnavigator_region', region);

    var lbl = document.getElementById(opts.regionLabelId || 'region-label');
    if (lbl) lbl.textContent = region;

    var trackFn = (typeof opts.trackFn === 'function') ? opts.trackFn : (typeof global.track === 'function' ? global.track : null);
    if (trackFn) {
      trackFn('region_set', { region: region });
    }

    var recMap = opts.recMap || {
      EU: [
        { href: '/binance-review/', text: 'Binance Review' },
        { href: '/mexc-review/', text: 'MEXC Review' },
        { href: '/bybit-arbitrage/', text: 'Bybit & Arbitrage' }
      ],
      RU: [
        { href: '/mexc-review/', text: 'MEXC Review' },
        { href: '/bybit-arbitrage/', text: 'Bybit & Arbitrage' },
        { href: '/binance-review/', text: 'Binance Review' }
      ],
      US: [
        { href: '/binance-review/', text: 'Binance Review' },
        { href: '/mexc-review/', text: 'MEXC Review' },
        { href: '/bybit-arbitrage/', text: 'Bybit & Arbitrage' }
      ],
      ASIA: [
        { href: '/bybit-arbitrage/', text: 'Bybit & Arbitrage' },
        { href: '/mexc-review/', text: 'MEXC Review' },
        { href: '/binance-review/', text: 'Binance Review' }
      ]
    };

    var recButtonIds = opts.recButtonIds || ['rec-1', 'rec-2', 'rec-3'];
    var btns = recButtonIds.map(function (id) { return document.getElementById(id); });
    var recs = recMap[region] || recMap.EU || [];

    btns.forEach(function (btn, i) {
      if (!btn) return;
      var base = recs[i] || recs[0];
      if (!base) return;
      var url = new URL(base.href, window.location.origin);
      url.searchParams.set('region', region);
      btn.href = url.pathname + url.search;
      btn.innerHTML = '<i class="fas fa-building-columns"></i> ' + base.text;
    });

    var selector = opts.regionizeSelector || 'a[data-regionize="1"]';
    document.querySelectorAll(selector).forEach(function (a) {
      try {
        var u = new URL(a.getAttribute('href'), window.location.origin);
        if (u.origin !== window.location.origin) return;
        u.searchParams.set('region', region);
        a.setAttribute('href', u.pathname + u.search + (u.hash || ''));
      } catch (_err) {}
    });
  }

  global.CoinNavigatorRegion = {
    getRegionFromQuery: getRegionFromQuery,
    guessRegion: guessRegion,
    getRegion: getRegion,
    setRegion: setRegion
  };

  // Backward-compatible globals for current inline page scripts.
  global.getRegionFromQuery = getRegionFromQuery;
  global.guessRegion = guessRegion;
  global.getRegion = getRegion;
  global.setRegion = setRegion;
})(window);
