// Single source of truth for partner exchange URLs (revenue).
// Perk / bonus text is intentionally omitted unless verified with source + date.
(function attachAffiliateLinks(global) {
  'use strict';

  const EXCHANGES = {
    Binance: {
      base: 'https://accounts.binance.com/register?ref=308417308',
      perk: null,
      perkVerified: false,
    },
    MEXC: {
      base: 'https://www.mexc.com/acquisition/custom-sign-up?shareCode=mexc-3ksU2',
      perk: null,
      perkVerified: false,
    },
    Bybit: {
      base: 'https://partner.bybit.com/b/153018',
      perk: null,
      perkVerified: false,
    },
    OKX: {
      base: 'https://www.okx.com/join/coinnavigator',
      perk: null,
      perkVerified: false,
    },
    KuCoin: {
      base: 'https://www.kucoin.com/ucenter/signup',
      perk: null,
      perkVerified: false,
    },
    Gate: {
      base: 'https://www.gate.io/signup',
      perk: null,
      perkVerified: false,
    },
  };

  function buildUrl(exchange, medium, campaign) {
    if (!EXCHANGES[exchange]) return null;
    const ex = EXCHANGES[exchange];
    const u = new URL(ex.base);
    u.searchParams.set('utm_source', 'coinnavigator');
    if (medium) u.searchParams.set('utm_medium', medium);
    if (campaign) u.searchParams.set('utm_campaign', campaign);
    return u.toString();
  }

  function mapForMedium(medium, campaign) {
    const map = {};
    for (const name of Object.keys(EXCHANGES)) {
      map[name] = buildUrl(name, medium, campaign);
    }
    return map;
  }

  function refreshGlobalMap(medium, campaign) {
    global.AFFILIATE_LINKS_GLOBAL = mapForMedium(medium || 'table', campaign || 'arb');
    return global.AFFILIATE_LINKS_GLOBAL;
  }

  function wireAffiliateAnchors(root) {
    const scope = root || document;
    scope.querySelectorAll('[data-cn-affiliate]').forEach((a) => {
      const ex = a.getAttribute('data-cn-affiliate');
      if (!ex) return;
      const medium = a.getAttribute('data-cn-medium') || 'site';
      const campaign = a.getAttribute('data-cn-campaign') || 'default';
      const url = buildUrl(ex, medium, campaign);
      if (!url) return;
      a.href = url;
      if (!a.getAttribute('data-ex')) a.setAttribute('data-ex', ex);
      if (!a.getAttribute('target')) {
        a.target = '_blank';
        a.rel = 'sponsored noopener noreferrer';
      }
    });
  }

  global.CoinNavigatorAffiliate = {
    exchanges: EXCHANGES,
    buildUrl: buildUrl,
    mapForMedium: mapForMedium,
    refreshGlobalMap: refreshGlobalMap,
    wireAffiliateAnchors: wireAffiliateAnchors,
  };

  refreshGlobalMap('table', 'arb_table');

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => wireAffiliateAnchors());
  } else {
    wireAffiliateAnchors();
  }
})(window);
