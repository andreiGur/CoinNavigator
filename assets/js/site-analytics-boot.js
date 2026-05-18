// Site-wide click tracking: loads tracking.js and delegates [data-track] + outbound affiliate links.
(function (global) {
  'use strict';

  const AFFILIATE_HOSTS = [
    'binance.com', 'mexc.com', 'bybit.com', 'okx.com',
    'kucoin.com', 'gate.io', 'polymarket.com'
  ];

  function getSourcePage() {
    const fromBody = document.body && document.body.getAttribute('data-cn-page');
    if (fromBody) return fromBody;
    const p = (global.location.pathname || '/').replace(/\/$/, '') || '/';
    if (p === '/' || p === '/index.html') return 'home';
    return p.replace(/^\//, '');
  }

  function guessExchange(href) {
    const h = (href || '').toLowerCase();
    if (h.includes('binance')) return 'Binance';
    if (h.includes('mexc')) return 'MEXC';
    if (h.includes('bybit')) return 'Bybit';
    if (h.includes('okx')) return 'OKX';
    if (h.includes('kucoin')) return 'KuCoin';
    if (h.includes('gate.io')) return 'Gate';
    if (h.includes('polymarket')) return 'Polymarket';
    return undefined;
  }

  function isAffiliateHost(href) {
    try {
      const host = new URL(href, global.location.origin).hostname.toLowerCase();
      return AFFILIATE_HOSTS.some((d) => host === d || host.endsWith('.' + d));
    } catch (_e) {
      return false;
    }
  }

  function bindDelegates() {
    if (document.documentElement.dataset.cnAnalyticsBound === '1') return;
    document.documentElement.dataset.cnAnalyticsBound = '1';

    document.addEventListener('click', (e) => {
      const el = e.target && e.target.closest ? e.target.closest('[data-track], a[href]') : null;
      if (!el) return;

      const trackName = el.getAttribute('data-track');
      const href = el.tagName === 'A' ? (el.getAttribute('href') || '') : '';
      const sourcePage = getSourcePage();
      const region = typeof global.getRegion === 'function' ? global.getRegion() : undefined;
      const params = {
        ex: el.getAttribute('data-ex') || guessExchange(href),
        sym: el.getAttribute('data-sym'),
        region: region,
        source_page: sourcePage
      };

      if (trackName && typeof global.track === 'function') {
        global.track(trackName, Object.assign({ source_page: sourcePage }, params));
        if (typeof global.mapToConversionEvent === 'function') {
          const mapped = global.mapToConversionEvent(trackName, el, params);
          if (mapped && mapped.event) {
            global.track(mapped.event, Object.assign({ source_page: sourcePage }, mapped.payload || {}));
          }
        }
        return;
      }

      if (href && /^https?:\/\//i.test(href) && isAffiliateHost(href) && typeof global.track === 'function') {
        global.track('outbound_exchange_click', {
          source_page: sourcePage,
          cta_name: 'implicit_outbound',
          destination: href,
          exchange: params.ex,
          region: region
        });
        if (el.matches('[data-track*="aff"], [data-track*="exchange"], [data-track*="trade"], [data-track*="rec_"]') ||
            el.classList.contains('btn-primary')) {
          global.track('affiliate_click', {
            source_page: sourcePage,
            destination: href,
            exchange: params.ex,
            region: region
          });
        }
      }
    }, true);
  }

  function boot() {
    bindDelegates();
  }

  function loadTrackingThenBoot() {
    if (global.CoinNavigatorTracking) {
      if (typeof global.initAnalytics === 'function') global.initAnalytics();
      boot();
      return;
    }
    const s = document.createElement('script');
    s.src = '/assets/js/tracking.js';
    s.defer = true;
    s.onload = function () {
      if (typeof global.initAnalytics === 'function') global.initAnalytics();
      boot();
    };
    document.head.appendChild(s);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadTrackingThenBoot);
  } else {
    loadTrackingThenBoot();
  }
})(window);
