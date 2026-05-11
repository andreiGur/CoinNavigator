// Shared Polymarket data fetch/render helpers for homepage widgets.
(function attachPolymarket(global) {
  var POLYMARKET_HOME = 'https://polymarket.com';
  var POLYMARKET_REFERRAL_CODE = 'Bn0AqAs';

  function fmtUsdShort(v) {
    if (typeof v !== 'number' || Number.isNaN(v)) return '—';
    if (v >= 1000000) return '$' + (v / 1000000).toFixed(2) + 'M';
    if (v >= 1000) return '$' + (v / 1000).toFixed(1) + 'K';
    return '$' + v.toFixed(0);
  }

  function fmtProb(p) {
    if (typeof p !== 'number' || Number.isNaN(p)) return '—';
    return (p * 100).toFixed(1) + '%';
  }

  function buildPolymarketUrl(url, sourceTag) {
    if (!url || typeof url !== 'string' || !url.startsWith('http') || url.includes('/404') || !url.includes('polymarket.com/event/')) {
      url = POLYMARKET_HOME;
    }
    try {
      var u = new URL(url);
      if (POLYMARKET_REFERRAL_CODE) u.searchParams.set('via', POLYMARKET_REFERRAL_CODE);
      u.searchParams.set('utm_source', 'coinnavigator');
      u.searchParams.set('utm_medium', 'referral');
      u.searchParams.set('utm_campaign', 'polymarket_hot');
      u.searchParams.set('utm_content', sourceTag || 'homepage');
      return u.toString();
    } catch (_err) {
      return POLYMARKET_HOME + (POLYMARKET_REFERRAL_CODE ? '?via=' + encodeURIComponent(POLYMARKET_REFERRAL_CODE) : '');
    }
  }

  async function fetchPolymarketWithFallback() {
    var origins = [window.location.origin, 'https://coinnavigator.net'];
    var candidates = global.CoinNavigatorDataClient.buildCandidateUrls(origins, [
      '/polymarket_hot.json',
      '/data/polymarket_hot.json'
    ]);
    return await global.CoinNavigatorDataClient.fetchFirstJson(candidates);
  }

  function renderPolymarketModule(payload, options) {
    var opts = options || {};
    var gridId = opts.gridId || 'pm-grid';
    var updatedId = opts.updatedId || 'pm-updated';
    var outdatedHours = Number.isFinite(opts.outdatedHours) ? opts.outdatedHours : 25;
    var dangerColor = opts.dangerColor || 'var(--danger)';

    var grid = document.getElementById(gridId);
    var updated = document.getElementById(updatedId);
    if (!grid) return;

    var markets = (payload && payload.markets) ? payload.markets : [];
    var activeMarkets = Array.isArray(markets) ? markets.filter(function (m) {
      if (!m.endDate) return true;
      var endTime = Date.parse(m.endDate);
      if (Number.isNaN(endTime)) return true;
      return endTime > Date.now();
    }) : [];

    var top = activeMarkets.slice(0, 6);

    if (payload && payload.timestamp && updated) {
      var d = new Date(payload.timestamp);
      var hoursAgo = (Date.now() - d.getTime()) / (1000 * 60 * 60);
      var statusText = 'Polymarket updated: ' + d.toLocaleString();
      if (hoursAgo > outdatedHours) {
        statusText += ' <span style="color: ' + dangerColor + ';">(' + Math.floor(hoursAgo) + 'h ago - may be outdated)</span>';
      }
      updated.innerHTML = '<i class="far fa-clock"></i> ' + statusText;
    }

    if (!top.length) {
      grid.innerHTML = '<div class="pm-card"><div class="pm-q">No active events available right now.</div><div class="pm-meta">All events have ended. Check back tomorrow for new markets.</div></div>';
      return;
    }

    grid.innerHTML = '';
    top.forEach(function (m) {
      var url = buildPolymarketUrl(m.url, 'home_card');
      var card = document.createElement('div');
      card.className = 'pm-card';
      card.innerHTML =
        '<div class="pm-q">' + (m.question || '') + '</div>' +
        '<div class="pm-meta">' +
          '<span><b>' + fmtUsdShort(m.volume24hr) + '</b> 24h volume</span>' +
          '<span class="muted">Market probability</span>' +
        '</div>' +
        '<div class="pm-chips">' +
          '<span class="pm-chip">YES: ' + fmtProb(m.yes) + '</span>' +
          '<span class="pm-chip">NO: ' + fmtProb(m.no) + '</span>' +
        '</div>' +
        '<div class="pm-actions">' +
          '<a class="btn-mini btn-mini-primary" href="' + url + '" target="_blank" rel="noopener noreferrer" title="Analyze this event on Polymarket" data-track="pm_view_market_home" data-slug="' + (m.slug || '') + '"><i class="fas fa-arrow-up-right-from-square"></i> View market</a>' +
          '<a class="btn-mini" href="/polymarket/" title="See more hot events" data-track="pm_more_events_home"><i class="fas fa-fire"></i> More events</a>' +
        '</div>';
      grid.appendChild(card);
    });
  }

  global.CoinNavigatorPolymarket = {
    fetchPolymarketWithFallback: fetchPolymarketWithFallback,
    buildPolymarketUrl: buildPolymarketUrl,
    renderPolymarketModule: renderPolymarketModule
  };
})(window);
