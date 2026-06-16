// Loads display ads based on ads-config.js. Safe no-op when all disabled.
(function (global) {
  'use strict';

  var cfg = global.COINNAVIGATOR_ADS || {};

  function loadScript(src, attrs) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.async = true;
      s.src = src;
      if (attrs) Object.keys(attrs).forEach(function (k) { s.setAttribute(k, attrs[k]); });
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function enableSlots() {
    document.documentElement.classList.add('ad-enabled');
  }

  // ── Coinzilla ──────────────────────────────────────────────────────────────
  function bootCoinzilla() {
    var czCfg = cfg.coinzilla;
    if (!czCfg || !czCfg.enabled) return;
    enableSlots();
    var zones = czCfg.zones || {};
    document.querySelectorAll('[data-ad-slot]').forEach(function (wrap) {
      var key = wrap.getAttribute('data-ad-slot');
      var src = zones[key];
      if (!src) return;
      var inner = wrap.querySelector('.ad-slot-inner');
      if (!inner) return;
      inner.innerHTML = '';
      var container = document.createElement('div');
      inner.appendChild(container);
      loadScript(src, { 'data-cfasync': 'false' }).catch(function () {});
    });
    if (typeof global.track === 'function') {
      global.track('ads_enabled', { provider: 'coinzilla' });
    }
  }

  // ── A-Ads ──────────────────────────────────────────────────────────────────
  function bootAAds() {
    var aa = cfg.aads;
    if (!aa || !aa.enabled || !aa.adUnitId) return;
    enableSlots();
    var slot = document.querySelector('[data-ad-slot="mid"] .ad-slot-inner');
    if (!slot) return;
    slot.innerHTML = '';
    var iframe = document.createElement('iframe');
    iframe.src = 'https://a-ads.com/' + aa.adUnitId + '/adserve/480x60/index.html';
    iframe.style.cssText = 'width:100%;height:60px;border:none;overflow:hidden;';
    iframe.scrolling = 'no';
    slot.appendChild(iframe);
    if (typeof global.track === 'function') {
      global.track('ads_enabled', { provider: 'a-ads' });
    }
  }

  // ── Google AdSense ─────────────────────────────────────────────────────────
  function bootAdSense() {
    var as = cfg.adsense;
    if (!as || !as.enabled) return;
    var client = as.client || '';
    if (!client || /X{4,}/i.test(client)) return;
    enableSlots();
    var url = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + encodeURIComponent(client);
    loadScript(url, { crossorigin: 'anonymous' }).then(function () {
      if (as.mode === 'units') {
        var slots = as.slots || {};
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
          try { (global.adsbygoogle = global.adsbygoogle || []).push({}); } catch (_) {}
        });
      }
    }).catch(function () { document.documentElement.classList.remove('ad-enabled'); });
    if (typeof global.track === 'function') {
      global.track('ads_enabled', { provider: 'adsense', mode: as.mode });
    }
  }

  function boot() {
    bootCoinzilla();
    bootAAds();
    bootAdSense();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  global.CoinNavigatorAds = { boot: boot };
})(window);
