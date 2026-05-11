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
    return fromMeta || saved || null;
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
      if (typeof global.gtag === 'function') {
        global.gtag('event', name, params || {});
      }
    } catch (_err) {}
  }

  function mapToConversionEvent(name, el, params) {
    if (!name || !el) return null;
    const href = (el.tagName === 'A' && el.getAttribute('href')) ? el.getAttribute('href') : '';
    const lower = name.toLowerCase();

    if (lower.includes('email_signup') || lower.includes('exit_intent_email_signup')) {
      return {
        event: 'lead_submit',
        payload: {
          lead_type: 'email_alert',
          source_page: 'home',
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
          source_page: 'home',
          source_event: name,
          region: params.region || undefined
        }
      };
    }

    const isAffiliateClick = lower.includes('aff') || lower.includes('trade') || lower.includes('exchange') || lower.includes('open_');
    const isOutbound = href && /^https?:\/\//i.test(href);
    if (isAffiliateClick && isOutbound) {
      return {
        event: 'affiliate_click',
        payload: {
          exchange: params.ex || undefined,
          symbol: params.sym || undefined,
          source_page: 'home',
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
          source_page: 'home',
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
    mapToConversionEvent: mapToConversionEvent
  };

  global.getGa4MeasurementId = getGa4MeasurementId;
  global.initAnalytics = initAnalytics;
  global.track = track;
  global.mapToConversionEvent = mapToConversionEvent;
})(window);
