// CoinNavigator Live Scanner V2 — fast homepage upgrade.
(function (global) {
  'use strict';

  const REFRESH_MS = 15000;
  let lastPayload = null;
  let lastFetchAt = 0;
  let busy = false;

  function track(name, props) {
    try { if (typeof global.track === 'function') global.track(name, props || {}); } catch (_) {}
  }

  function ageText(ts) {
    const n = Date.parse(ts || '');
    if (!Number.isFinite(n)) return 'just now';
    const sec = Math.max(0, Math.round((Date.now() - n) / 1000));
    if (sec < 5) return 'just now';
    if (sec < 60) return sec + ' sec ago';
    return Math.floor(sec / 60) + ' min ago';
  }

  function installStatusBar() {
    const card = document.getElementById('dashboard');
    if (!card || document.getElementById('live-v2-status')) return;
    const bar = document.createElement('div');
    bar.id = 'live-v2-status';
    bar.setAttribute('role', 'status');
    bar.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:.8rem;flex-wrap:wrap;margin:.65rem 0;padding:.65rem .8rem;border:1px solid rgba(16,185,129,.28);background:rgba(16,185,129,.06);border-radius:12px;font-size:.8rem;';
    bar.innerHTML = '<span><strong style="color:#34d399">● LIVE SCANNER</strong> <span id="live-v2-age" style="color:var(--text-muted)">connecting…</span></span><span id="live-v2-exchanges" style="color:var(--text-muted)">6 exchange gateway</span>';
    const controls = card.querySelector('.dashboard-controls');
    if (controls) controls.insertAdjacentElement('afterend', bar);
  }

  function updateStatus(payload) {
    const age = document.getElementById('live-v2-age');
    const ex = document.getElementById('live-v2-exchanges');
    if (age) age.textContent = 'updated ' + ageText(payload && payload.timestamp);
    if (ex) {
      const count = payload && Array.isArray(payload.exchanges) ? payload.exchanges.length : 0;
      const unavailable = payload && Array.isArray(payload.unavailable_exchanges) ? payload.unavailable_exchanges.length : 0;
      ex.textContent = count + ' exchanges live' + (unavailable ? ' · ' + unavailable + ' temporarily unavailable' : '');
    }
  }

  function updateCopy() {
    const h1 = document.querySelector('.hero h1');
    const p = document.querySelector('.hero p');
    if (h1) h1.textContent = 'Live Crypto Arbitrage Scanner';
    if (p) p.textContent = 'Find price gaps across exchanges, then verify whether they are actually profitable after fees, slippage and transfer costs.';
    const tableTitle = document.querySelector('#dashboard .table-header h2');
    if (tableTitle) tableTitle.textContent = 'Live Arbitrage Scanner';
  }

  async function fetchLive() {
    if (busy || document.visibilityState === 'hidden') return;
    busy = true;
    try {
      const engine = global.CoinNavigatorSpreadEngine;
      if (!engine || typeof engine.fetchLiveSpreadFallback !== 'function') return;
      const payload = await engine.fetchLiveSpreadFallback();
      if (!payload || !payload.symbols) return;
      lastPayload = payload;
      lastFetchAt = Date.now();
      updateStatus(payload);
      // Existing dashboard owns rendering. Force its normal refresh path to consume live gateway.
      global._forceLiveSpreadRefresh = true;
      track('live_scanner_refresh', {
        exchange_count: Array.isArray(payload.exchanges) ? payload.exchanges.length : 0,
        asset_count: Object.keys(payload.symbols).length
      });
      // Keep a lightweight signal for other homepage modules without duplicating rendering logic.
      global.__CN_LIVE_SCANNER_V2 = { payload: payload, fetchedAt: lastFetchAt };
    } catch (err) {
      const age = document.getElementById('live-v2-age');
      if (age) age.textContent = lastPayload ? 'live refresh delayed · last ' + ageText(lastPayload.timestamp) : 'live gateway temporarily unavailable';
      track('live_scanner_refresh_failed', { reason: 'gateway' });
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
    track('live_scanner_v2_loaded', { refresh_seconds: REFRESH_MS / 1000 });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);
