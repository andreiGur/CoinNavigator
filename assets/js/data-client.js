// Shared JSON fetching helpers for CoinNavigator pages.
(function attachDataClient(global) {
  function buildCandidateUrls(origins, paths) {
    const urls = [];
    for (const origin of origins || []) {
      for (const path of paths || []) {
        urls.push(new URL(path, origin).toString());
      }
    }
    return urls;
  }

  async function fetchFirstJson(candidates) {
    let lastError = null;
    for (const baseUrl of candidates || []) {
      const url = baseUrl + '?v=' + Date.now();
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) {
          lastError = new Error('HTTP ' + res.status + ' for ' + baseUrl);
          continue;
        }
        return await res.json();
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError || new Error('Failed to fetch JSON');
  }

  async function fetchNewestByTimestamp(candidates, maxAcceptableAgeMs) {
    let lastError = null;
    let bestPayload = null;
    let bestTs = -Infinity;

    for (const baseUrl of candidates || []) {
      const url = baseUrl + '?v=' + Date.now();
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) {
          lastError = new Error('HTTP ' + res.status + ' for ' + baseUrl);
          continue;
        }
        const payload = await res.json();
        const ts = Date.parse((payload || {}).timestamp || '');
        const safeTs = Number.isFinite(ts) ? ts : -Infinity;
        if (safeTs > bestTs) {
          bestTs = safeTs;
          bestPayload = payload;
          if (Number.isFinite(maxAcceptableAgeMs) && safeTs > 0 && (Date.now() - safeTs <= maxAcceptableAgeMs)) {
            return bestPayload;
          }
        }
      } catch (err) {
        lastError = err;
      }
    }

    if (bestPayload) return bestPayload;
    throw lastError || new Error('Failed to fetch JSON');
  }

  global.CoinNavigatorDataClient = {
    buildCandidateUrls: buildCandidateUrls,
    fetchFirstJson: fetchFirstJson,
    fetchNewestByTimestamp: fetchNewestByTimestamp
  };
})(window);
