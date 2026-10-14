// Shared analytics utilities for CoinNavigator pages.
// Click resolution rules are mirrored in src/analytics/click-events.ts (unit tested).
(function attachTrackingUtils(global) {
  'use strict';

  var AFFILIATE_HOSTS = [
    'binance.com', 'mexc.com', 'bybit.com', 'okx.com',
    'kucoin.com', 'gate.io', 'polymarket.com', 'gumroad.com'
  ];

  function getGa4MeasurementId() {
    var meta = document.querySelector('meta[name="coinnavigator-ga4"]');
    var fromMeta = (meta && meta.getAttribute('content')) ? meta.getAttribute('content').trim() : '';
    var p = new URLSearchParams(window.location.search);
    var fromQuery = (p.get('ga4') || '').trim();
    if (fromQuery && fromQuery.startsWith('G-')) {
      localStorage.setItem('coinnavigator_ga4', fromQuery);
    }
    var saved = (localStorage.getItem('coinnavigator_ga4') || '').trim();
    return fromMeta || saved || 'G-9L1137PQ6P';
  }

  function getSourcePage() {
    var fromBody = document.body && document.body.getAttribute('data-cn-page');
    if (fromBody) return fromBody;
    var path = (global.location.pathname || '/').replace(/\/$/, '') || '/';
    if (path === '/' || path === '/index.html') return 'home';
    return path.replace(/^\//, '');
  }

  function initAnalytics() {
    var id = getGa4MeasurementId();
    if (!id) return;
    if (global.__CN_GA4_READY === id) return;
    global.__CN_GA4_READY = id;

    global.dataLayer = global.dataLayer || [];
    if (typeof global.gtag !== 'function') {
      global.gtag = function () { global.dataLayer.push(arguments); };
    }

    // Avoid a second gtag/js script when the page already loaded GA4 in <head>.
    var alreadyLoaded = !!document.querySelector('script[src*="googletagmanager.com/gtag/js"]');
    if (!alreadyLoaded) {
      var s1 = document.createElement('script');
      s1.async = true;
      s1.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id);
      document.head.appendChild(s1);
    }

    // Only send config once per page (duplicate config inflates page_view).
    if (!global.__CN_GA4_CONFIGURED) {
      global.__CN_GA4_CONFIGURED = true;
      // If head already called gtag('config'), skip a second config.
      if (!alreadyLoaded) {
        global.gtag('js', new Date());
        global.gtag('config', id, { anonymize_ip: true, send_page_view: true });
      }
    }
  }

  function track(name, params) {
    if (!name) return;
    try {
      var payload = params || {};
      if (typeof global.gtag === 'function') {
        global.gtag('event', name, payload);
        return;
      }
      global.dataLayer = global.dataLayer || [];
      if (Array.isArray(global.dataLayer)) {
        global.dataLayer.push(Object.assign({ event: name }, payload));
      }
    } catch (_err) {}
    try {
      var host = (global.location && global.location.hostname) || '';
      if (host === 'localhost' || host === '127.0.0.1') {
        // eslint-disable-next-line no-console
        console.debug('[cn-analytics]', name, params || {});
      }
    } catch (_err2) {}
  }

  function trackOnce(key, name, params) {
    var store = global.__CN_TRACK_ONCE || (global.__CN_TRACK_ONCE = {});
    if (store[key]) return false;
    store[key] = 1;
    track(name, params);
    return true;
  }

  function bucketAmountUsd(amount) {
    if (global.CoinNavigatorNetProfit && typeof global.CoinNavigatorNetProfit.bucketAmountUsd === 'function') {
      return global.CoinNavigatorNetProfit.bucketAmountUsd(amount);
    }
    if (!Number.isFinite(amount) || amount < 100) return 'under_100';
    if (amount < 500) return '100_499';
    if (amount < 1000) return '500_999';
    if (amount < 5000) return '1000_4999';
    return '5000_plus';
  }

  function hostnameOf(href) {
    try {
      return new URL(href, global.location.origin).hostname.toLowerCase();
    } catch (_e) {
      return '';
    }
  }

  function isAffiliateHost(href) {
    var host = hostnameOf(href);
    if (!host) return false;
    return AFFILIATE_HOSTS.some(function (d) {
      return host === d || host.endsWith('.' + d);
    });
  }

  var CALC_OPEN_CTA_KEY = 'cn_calc_open_cta';
  var STARTER_PACK_PATH_RE = /\/l\/tzynyo\/?$/i;

  function isGumroad(href) {
    var host = hostnameOf(href);
    return host === 'gumroad.com' || host.endsWith('.gumroad.com');
  }

  function pathnameOf(href) {
    try {
      return new URL(href, global.location.origin).pathname;
    } catch (_e) {
      return '';
    }
  }

  function isStarterPackCheckoutHref(href) {
    if (!href || !isGumroad(href)) return false;
    return STARTER_PACK_PATH_RE.test(pathnameOf(href));
  }

  function isExternalHttp(href) {
    return !!href && /^https?:\/\//i.test(href);
  }

  function isScannerHref(href) {
    if (!href) return false;
    if (href.indexOf('#dashboard') !== -1) return true;
    return /\/(crypto-arbitrage-scanner\/?|bitcoin-arbitrage-scanner\/?|ethereum-arbitrage-scanner\/?|solana-arbitrage-scanner\/?|trade\/?)/i.test(href);
  }

  function isCalculatorHref(href) {
    return !!href && /\/arbitrage-calculator\/?/i.test(href);
  }

  function isScannerName(lower) {
    return lower === 'hero_start' ||
      lower === 'nav_monitor' ||
      lower.indexOf('scanner') !== -1 ||
      /(_|^)(open_monitor|snapshot_open)/.test(lower);
  }

  function isCalculatorName(lower) {
    return lower.indexOf('calculator') !== -1 ||
      lower.indexOf('_calc') !== -1 ||
      /calc_cta$/.test(lower) ||
      lower === 'sg_calculator_cta';
  }

  /**
   * Resolve a user click to exactly one analytics event.
   * Actual link destinations take priority over broad data-track name matching.
   */
  function resolveClickEvent(trackName, href, params) {
    var name = (trackName || '').trim();
    var lower = name.toLowerCase();
    var sourcePage = (params && params.source_page) || getSourcePage();
    var base = {
      source_page: sourcePage,
      cta_name: name || undefined,
      region: params && params.region
    };

    // 1) Real Starter Pack Gumroad product URL only.
    if (isStarterPackCheckoutHref(href)) {
      return {
        event: 'starter_pack_checkout_click',
        payload: Object.assign({}, base, {
          product: 'crypto_arbitrage_starter_pack',
          price: 9,
          currency: 'USD',
          destination: href
        })
      };
    }

    // 2) Outbound affiliate destinations win over track-name heuristics.
    if (isExternalHttp(href) && isAffiliateHost(href)) {
      return {
        event: 'affiliate_click',
        payload: Object.assign({}, base, {
          exchange: (params && params.ex) || undefined,
          symbol: (params && params.sym) || undefined,
          destination: href
        })
      };
    }

    // 3) Internal destinations by href.
    if (isCalculatorHref(href)) {
      return {
        event: 'calculator_open',
        payload: Object.assign({}, base, {
          destination: href || undefined
        })
      };
    }

    if (isScannerHref(href)) {
      return {
        event: 'scanner_open',
        payload: Object.assign({}, base, {
          destination: href || undefined,
          asset: (params && params.sym) || undefined
        })
      };
    }

    // 4) Name-based fallback only when href is not affiliate / calc / scanner.
    if (name && isCalculatorName(lower)) {
      return {
        event: 'calculator_open',
        payload: Object.assign({}, base, {
          destination: href || undefined
        })
      };
    }

    if (name && isScannerName(lower)) {
      return {
        event: 'scanner_open',
        payload: Object.assign({}, base, {
          destination: href || undefined,
          asset: (params && params.sym) || undefined
        })
      };
    }

    if (name) {
      // Do not allow data-track alone to forge reserved funnel event names.
      var reserved = {
        starter_pack_checkout_click: true,
        calculator_open: true,
        scanner_open: true,
        affiliate_click: true,
        calculator_used: true
      };
      var eventName = reserved[lower] ? 'cta_click' : name;
      return {
        event: eventName,
        payload: Object.assign({}, base, {
          exchange: (params && params.ex) || undefined,
          symbol: (params && params.sym) || undefined,
          destination: href || undefined
        })
      };
    }

    return null;
  }

  function shouldDeferCalculatorOpenTrack(eventName) {
    return eventName === 'calculator_open';
  }

  function rememberCalculatorOpenCta(ctaName) {
    try {
      global.sessionStorage.setItem(CALC_OPEN_CTA_KEY, (ctaName || 'cta_click').trim() || 'cta_click');
    } catch (_e) {}
  }

  function consumeCalculatorOpenCta() {
    try {
      var v = global.sessionStorage.getItem(CALC_OPEN_CTA_KEY);
      if (v) {
        global.sessionStorage.removeItem(CALC_OPEN_CTA_KEY);
        return v;
      }
    } catch (_e) {}
    return null;
  }

  function shouldEmitCalculatorOpenOnArrival(opts) {
    opts = opts || {};
    if (opts.bfCacheRestore) return true;
    return !opts.alreadySentThisDocument;
  }

  function buildCalculatorOpenPayload(ctaName) {
    return {
      source_page: 'arbitrage-calculator',
      cta_name: ctaName || 'page_load',
      interaction_type: 'navigation'
    };
  }

  function shouldIgnoreAnalyticsClick(opts) {
    opts = opts || {};
    if (opts.isTrusted === false) return true;
    if (opts.cnAuto === '1') return true;
    return false;
  }

  // Back-compat: old callers expected a "conversion" companion event.
  // Returning null stops the historic double-fire pattern.
  function mapToConversionEvent(name, el, params) {
    if (!name || !el) return null;
    return null;
  }

  global.CoinNavigatorTracking = {
    getGa4MeasurementId: getGa4MeasurementId,
    initAnalytics: initAnalytics,
    track: track,
    trackOnce: trackOnce,
    mapToConversionEvent: mapToConversionEvent,
    resolveClickEvent: resolveClickEvent,
    isAffiliateHost: isAffiliateHost,
    isStarterPackCheckoutHref: isStarterPackCheckoutHref,
    shouldDeferCalculatorOpenTrack: shouldDeferCalculatorOpenTrack,
    rememberCalculatorOpenCta: rememberCalculatorOpenCta,
    consumeCalculatorOpenCta: consumeCalculatorOpenCta,
    shouldEmitCalculatorOpenOnArrival: shouldEmitCalculatorOpenOnArrival,
    buildCalculatorOpenPayload: buildCalculatorOpenPayload,
    shouldIgnoreAnalyticsClick: shouldIgnoreAnalyticsClick,
    bucketAmountUsd: bucketAmountUsd,
    getSourcePage: getSourcePage
  };

  global.getGa4MeasurementId = getGa4MeasurementId;
  global.initAnalytics = initAnalytics;
  global.track = track;
  global.trackOnce = trackOnce;
  global.mapToConversionEvent = mapToConversionEvent;
  global.resolveClickEvent = resolveClickEvent;
  global.shouldDeferCalculatorOpenTrack = shouldDeferCalculatorOpenTrack;
  global.rememberCalculatorOpenCta = rememberCalculatorOpenCta;
  global.consumeCalculatorOpenCta = consumeCalculatorOpenCta;
  global.shouldEmitCalculatorOpenOnArrival = shouldEmitCalculatorOpenOnArrival;
  global.buildCalculatorOpenPayload = buildCalculatorOpenPayload;
  global.shouldIgnoreAnalyticsClick = shouldIgnoreAnalyticsClick;
})(window);
