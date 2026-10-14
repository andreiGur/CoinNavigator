// Site-wide click tracking: loads tracking.js and fires exactly one event per trusted user click.
(function (global) {
  'use strict';

  function getSourcePage() {
    if (global.CoinNavigatorTracking && typeof global.CoinNavigatorTracking.getSourcePage === 'function') {
      return global.CoinNavigatorTracking.getSourcePage();
    }
    var fromBody = document.body && document.body.getAttribute('data-cn-page');
    if (fromBody) return fromBody;
    var p = (global.location.pathname || '/').replace(/\/$/, '') || '/';
    if (p === '/' || p === '/index.html') return 'home';
    return p.replace(/^\//, '');
  }

  function guessExchange(href) {
    var h = (href || '').toLowerCase();
    if (h.indexOf('binance') !== -1) return 'Binance';
    if (h.indexOf('mexc') !== -1) return 'MEXC';
    if (h.indexOf('bybit') !== -1) return 'Bybit';
    if (h.indexOf('okx') !== -1) return 'OKX';
    if (h.indexOf('kucoin') !== -1) return 'KuCoin';
    if (h.indexOf('gate.io') !== -1) return 'Gate';
    if (h.indexOf('polymarket') !== -1) return 'Polymarket';
    return undefined;
  }

  function isAffiliateHost(href) {
    if (global.CoinNavigatorTracking && typeof global.CoinNavigatorTracking.isAffiliateHost === 'function') {
      return global.CoinNavigatorTracking.isAffiliateHost(href);
    }
    return false;
  }

  function bindDelegates() {
    if (document.documentElement.dataset.cnAnalyticsBound === '1') return;
    document.documentElement.dataset.cnAnalyticsBound = '1';

    document.addEventListener('click', function (e) {
      // Ignore programmatic / non-user clicks (auto refresh, scripts).
      if (!e || e.isTrusted === false) return;

      var el = e.target && e.target.closest ? e.target.closest('[data-track], a[href]') : null;
      if (!el) return;
      if (el.getAttribute('data-cn-auto') === '1') return;

      var trackName = el.getAttribute('data-track');
      var href = el.tagName === 'A' ? (el.getAttribute('href') || '') : '';
      var sourcePage = getSourcePage();
      var region = typeof global.getRegion === 'function' ? global.getRegion() : undefined;
      var params = {
        ex: el.getAttribute('data-ex') || guessExchange(href),
        sym: el.getAttribute('data-sym'),
        region: region,
        source_page: sourcePage
      };

      if (typeof global.resolveClickEvent !== 'function' || typeof global.track !== 'function') return;

      // Untracked internal links: ignore (prevents noise).
      if (!trackName && href && !/^https?:\/\//i.test(href)) return;

      // Untracked outbound affiliate: still count as affiliate_click.
      if (!trackName && href && /^https?:\/\//i.test(href) && isAffiliateHost(href)) {
        var aff = global.resolveClickEvent(null, href, params);
        if (aff) global.track(aff.event, aff.payload);
        return;
      }

      if (!trackName) return;

      var resolved = global.resolveClickEvent(trackName, href, params);
      if (resolved && resolved.event) {
        if (resolved.event === 'calculator_open') {
          try { sessionStorage.setItem('cn_funnel_calculator_open', String(Date.now())); } catch (_e) {}
        }
        if (resolved.event === 'scanner_open') {
          try { sessionStorage.setItem('cn_funnel_scanner_open', String(Date.now())); } catch (_e2) {}
        }
        global.track(resolved.event, resolved.payload || {});
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
    var s = document.createElement('script');
    s.src = '/assets/js/tracking.js';
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
