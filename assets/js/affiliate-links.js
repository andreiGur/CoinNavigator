// Single source of truth for partner exchange URLs (revenue).
(function attachAffiliateLinks(global) {
  'use strict';

  const EXCHANGES = {
    Binance: {
      base: 'https://accounts.binance.com/register?ref=308417308',
      perk: '10% fee rebate for life',
    },
    MEXC: {
      base: 'https://www.mexc.com/acquisition/custom-sign-up?shareCode=mexc-3ksU2',
      perk: '0% maker fees + bonus',
    },
    Bybit: {
      base: 'https://partner.bybit.com/b/153018',
      perk: 'Up to $30,000 welcome bonus',
    },
    OKX: {
      base: 'https://www.okx.com/join/coinnavigator',
      perk: null,
    },
    KuCoin: {
      base: 'https://www.kucoin.com/ucenter/signup',
      perk: null,
    },
    Gate: {
      base: 'https://www.gate.io/signup',
      perk: null,
    },
  };

  function buildUrl(exchange, medium, campaign) {
    const key = EXCHANGES[exchange] ? exchange : 'Binance';
    const ex = EXCHANGES[key];
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
      a.href = buildUrl(ex, medium, campaign);
      if (!a.getAttribute('data-ex')) a.setAttribute('data-ex', ex);
      if (!a.getAttribute('target')) {
        a.target = '_blank';
        a.rel = 'noopener nofollow';
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
