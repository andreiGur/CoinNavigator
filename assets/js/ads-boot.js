// Loads display ads when COINNAVIGATOR_ADS is configured. Safe no-op when disabled.
(function (global) {
  'use strict';

  var cfg = global.COINNAVIGATOR_ADS || {};
  var client = (cfg.adsense && cfg.adsense.client) || '';
  var placeholder = /X{4,}/i.test(client);

  function isConfigured() {
    return !!(cfg.enabled && client && !placeholder);
  }

  function loadScript(src, attrs) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.async = true;
      s.src = src;
      if (attrs) {
        Object.keys(attrs).forEach(function (k) { s.setAttribute(k, attrs[k]); });
      }
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function pushAdSenseUnit(ins) {
    try {
      (global.adsbygoogle = global.adsbygoogle || []).push({});
    } catch (_e) {}
    if (ins && ins.parentNode) {
      ins.parentNode.classList.add('ad-loaded');
    }
  }

  function mountUnitSlots() {
    var slots = (cfg.adsense && cfg.adsense.slots) || {};
    document.querySelectorAll('[data-ad-slot]').forEach(function (wrap) {
      var key = wrap.getAttribute('data-ad-slot');
      var slotId = slots[key];
      var inner = wrap.querySelector('.ad-slot-inner');
      if (!inner || !slotId) return;
      inner.innerHTML = '';
      var ins = document.createElement('ins');
      ins.className = 'adsbygoogle';
      ins.style.display = 'block';
      ins.setAttribute('data-ad-client', client);
      ins.setAttribute('data-ad-slot', slotId);
      ins.setAttribute('data-ad-format', 'auto');
      ins.setAttribute('data-full-width-responsive', 'true');
      inner.appendChild(ins);
      pushAdSenseUnit(ins);
    });
  }

  function boot() {
    if (!isConfigured()) return;

    document.documentElement.classList.add('ad-enabled');

    if (typeof global.track === 'function') {
      global.track('ads_enabled', { mode: cfg.mode || 'auto', page: global.location.pathname });
    }

    var adsUrl = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + encodeURIComponent(client);

    loadScript(adsUrl, { crossorigin: 'anonymous' }).then(function () {
      if (cfg.mode === 'units') {
        mountUnitSlots();
      }
      // mode 'auto': AdSense dashboard controls placement; slots on page still show if units mode later.
    }).catch(function () {
      document.documentElement.classList.remove('ad-enabled');
    });

    var alt = cfg.altNetwork;
    if (alt && alt.enabled && alt.scriptSrc) {
      loadScript(alt.scriptSrc).catch(function () {});
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  global.CoinNavigatorAds = { isConfigured: isConfigured, boot: boot };
})(window);
