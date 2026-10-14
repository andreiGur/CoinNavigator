// CoinNavigator Live Scanner V2 — fast homepage upgrade.
// Auto-refresh must not emit engagement analytics events.
(function (global) {
  'use strict';

  var REFRESH_MS = 15000;
  var lastPayload = null;
  var lastFetchAt = 0;
  var busy = false;
  var loadedTracked = false;

  function trackOnce(key, name, props) {
    try {
      if (typeof global.trackOnce === 'function') {
        global.trackOnce(key, name, props || {});
        return;
      }
      if (!loadedTracked && typeof global.track === 'function') {
        loadedTracked = true;
        global.track(name, props || {});
      }
    } catch (_) {}
  }

  function ageText(ts) {
    var n = Date.parse(ts || '');
    if (!Number.isFinite(n)) return 'just now';
    var sec = Math.max(0, Math.round((Date.now() - n) / 1000));
    if (sec < 5) return 'just now';
    if (sec < 60) return sec + ' sec ago';
    return Math.floor(sec / 60) + ' min ago';
  }

  function installStatusBar() {
    var card = document.getElementById('dashboard');
    if (!card || document.getElementById('live-v2-status')) return;
    var bar = document.createElement('div');
    bar.id = 'live-v2-status';
    bar.setAttribute('role', 'status');
    bar.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:.8rem;flex-wrap:wrap;margin:.65rem 0;padding:.65rem .8rem;border:1px solid rgba(16,185,129,.28);background:rgba(16,185,129,.06);border-radius:12px;font-size:.8rem;';
    bar.innerHTML = '<span><strong style="color:#34d399">● LIVE SCANNER</strong> <span id="live-v2-age" style="color:var(--text-muted)">connecting…</span></span><span id="live-v2-exchanges" style="color:var(--text-muted)">6 exchange gateway</span>';
    var controls = card.querySelector('.dashboard-controls');
    if (controls) controls.insertAdjacentElement('afterend', bar);
  }

  function updateStatus(payload) {
    var age = document.getElementById('live-v2-age');
    var ex = document.getElementById('live-v2-exchanges');
    if (age) age.textContent = 'updated ' + ageText(payload && payload.timestamp);
    if (ex) {
      var count = payload && Array.isArray(payload.exchanges) ? payload.exchanges.length : 0;
      var unavailable = payload && Array.isArray(payload.unavailable_exchanges) ? payload.unavailable_exchanges.length : 0;
      ex.textContent = count + ' exchanges live' + (unavailable ? ' · ' + unavailable + ' temporarily unavailable' : '');
    }
  }

  function updateCopy() {
    var h1 = document.querySelector('.hero h1');
    var p = document.querySelector('.hero p');
    if (h1) h1.textContent = 'Live Crypto Arbitrage Scanner';
    if (p) p.textContent = 'Find price gaps across exchanges, then verify whether they are actually profitable after fees, slippage and transfer costs.';
    var tableTitle = document.querySelector('#dashboard .table-header h2');
    if (tableTitle) tableTitle.textContent = 'Live Arbitrage Scanner';
  }

  async function fetchLive() {
    if (busy || document.visibilityState === 'hidden') return;
    busy = true;
    try {
      // Prefer a direct dashboard refresh path — never synthesize a trusted click.
      global._forceLiveSpreadRefresh = true;
      if (global.CoinNavigatorDashboard && typeof global.CoinNavigatorDashboard.refresh === 'function') {
        await global.CoinNavigatorDashboard.refresh({ forceLive: true, silent: true });
      } else if (typeof global.updateDashboard === 'function') {
        await global.updateDashboard();
      } else {
        var refreshEl = document.getElementById('refresh-spreads');
        if (refreshEl && !refreshEl.disabled) {
          refreshEl.setAttribute('data-cn-auto', '1');
          refreshEl.click();
          refreshEl.removeAttribute('data-cn-auto');
        }
      }

      var engine = global.CoinNavigatorSpreadEngine;
      if (!engine || typeof engine.fetchLiveSpreadFallback !== 'function') return;
      var payload = await engine.fetchLiveSpreadFallback();
      if (!payload || !payload.symbols) return;
      lastPayload = payload;
      lastFetchAt = Date.now();
      updateStatus(payload);
      global.__CN_LIVE_SCANNER_V2 = { payload: payload, fetchedAt: lastFetchAt };
      // Intentionally no live_scanner_refresh event — auto refresh must not inflate engagement.
    } catch (err) {
      var age = document.getElementById('live-v2-age');
      if (age) age.textContent = lastPayload ? 'live refresh delayed · last ' + ageText(lastPayload.timestamp) : 'live gateway temporarily unavailable';
    } finally {
      busy = false;
    }
  }

  function boot() {
    updateCopy();
    installStatusBar();
    fetchLive();
    setInterval(fetchLive, REFRESH_MS);
    setInterval(function () { if (lastPayload) updateStatus(lastPayload); }, 1000);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible' && Date.now() - lastFetchAt > REFRESH_MS) fetchLive();
    });
    trackOnce('live_scanner_v2_loaded', 'live_scanner_v2_loaded', {
      refresh_seconds: REFRESH_MS / 1000,
      interaction_type: 'system'
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);
