// Shared analytics utilities for CoinNavigator pages.
(function attachTrackingUtils(global) {
  function getGa4MeasurementId() {
    const meta = document.querySelector('meta[name="coinnavigator-ga4"]');
    const fromMeta = (meta && meta.getAttribute('content')) ? meta.getAttribute('content').trim() : '';
    const p = new URLSearchParams(window.location.search);
    const fromQuery = (p.get('ga4') || '').trim();
    if (fromQuery && fromQuery.startsWith('G-')) {
      localStorage.setItem('coinnavigator_ga4', fromQuery);
    }
    const saved = (localStorage.getItem('coinnavigator_ga4') || '').trim();
    return fromMeta || saved || 'G-9L1137PQ6P';
  }

  function getSourcePage() {
    const fromBody = document.body && document.body.getAttribute('data-cn-page');
    if (fromBody) return fromBody;
    const p = (global.location.pathname || '/').replace(/\/$/, '') || '/';
    if (p === '/' || p === '/index.html') return 'home';
    return p.replace(/^\//, '');
  }

  function initAnalytics() {
    const id = getGa4MeasurementId();
    if (!id) return;

    const s1 = document.createElement('script');
    s1.async = true;
    s1.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(id);
    document.head.appendChild(s1);

    global.dataLayer = global.dataLayer || [];
    global.gtag = global.gtag || function () { global.dataLayer.push(arguments); };
    global.gtag('js', new Date());
    global.gtag('config', id, { anonymize_ip: true });
  }

  function track(name, params) {
    try {
      const payload = params || {};
      if (typeof global.gtag === 'function') {
        global.gtag('event', name, payload);
        return;
      }
      global.dataLayer = global.dataLayer || [];
      if (Array.isArray(global.dataLayer)) {
        global.dataLayer.push({ event: name, ...payload });
        return;
      }
    } catch (_err) {}
    try {
      const host = (global.location && global.location.hostname) || '';
      if (host === 'localhost' || host === '127.0.0.1') {
        // Local-only debug — never required in production.
        // eslint-disable-next-line no-console
        console.debug('[cn-analytics]', name, params || {});
      }
    } catch (_err2) {}
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

  function mapToConversionEvent(name, el, params) {
    if (!name || !el) return null;
    const href = (el.tagName === 'A' && el.getAttribute('href')) ? el.getAttribute('href') : '';
    const lower = name.toLowerCase();
    const sourcePage = (params && params.source_page) || getSourcePage();

    if (lower.includes('email_signup') || lower.includes('exit_intent_email_signup')) {
      return {
        event: 'lead_submit',
        payload: {
          lead_type: 'email_alert',
          source_page: sourcePage,
          source_event: name,
          region: params.region || undefined
        }
      };
    }

    if (lower.includes('contact_submit')) {
      return {
        event: 'lead_submit',
        payload: {
          lead_type: 'contact',
          source_page: sourcePage,
          source_event: name,
          region: params.region || undefined
        }
      };
    }

    const isAffiliateClick = lower.includes('aff') || lower.includes('trade') || lower.includes('exchange') || lower.includes('open_') || lower.includes('rec_');
    const isOutbound = href && /^https?:\/\//i.test(href);
    if (isAffiliateClick && isOutbound) {
      return {
        event: 'affiliate_click',
        payload: {
          exchange: params.ex || undefined,
          symbol: params.sym || undefined,
          source_page: sourcePage,
          cta_name: name,
          destination: href,
          region: params.region || undefined
        }
      };
    }

    if (isOutbound) {
      return {
        event: 'outbound_exchange_click',
        payload: {
          exchange: params.ex || undefined,
          symbol: params.sym || undefined,
          source_page: sourcePage,
          cta_name: name,
          destination: href,
          region: params.region || undefined
        }
      };
    }

    return null;
  }

  global.CoinNavigatorTracking = {
    getGa4MeasurementId: getGa4MeasurementId,
    initAnalytics: initAnalytics,
    track: track,
    mapToConversionEvent: mapToConversionEvent,
    bucketAmountUsd: bucketAmountUsd,
  };

  global.getGa4MeasurementId = getGa4MeasurementId;
  global.initAnalytics = initAnalytics;
  global.track = track;
  global.mapToConversionEvent = mapToConversionEvent;
})(window);
