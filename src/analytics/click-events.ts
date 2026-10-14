/** Pure click → single GA4 funnel event resolution (mirrored in assets/js/tracking.js). */

export type ClickParams = {
  source_page?: string;
  region?: string;
  ex?: string;
  sym?: string;
  [key: string]: unknown;
};

export type ResolvedClickEvent = {
  event: string;
  payload: Record<string, unknown>;
};

const AFFILIATE_HOSTS = [
  'binance.com',
  'mexc.com',
  'bybit.com',
  'okx.com',
  'kucoin.com',
  'gate.io',
  'polymarket.com',
  'gumroad.com',
];

const SCANNER_PATH_RE =
  /\/(#dashboard|crypto-arbitrage-scanner\/?|bitcoin-arbitrage-scanner\/?|ethereum-arbitrage-scanner\/?|solana-arbitrage-scanner\/?|trade\/?)/i;

function hostnameOf(href: string): string {
  try {
    return new URL(href, 'https://coinnavigator.net').hostname.toLowerCase();
  } catch {
    return '';
  }
}

export function isAffiliateHost(href: string): boolean {
  const host = hostnameOf(href);
  if (!host) return false;
  return AFFILIATE_HOSTS.some((d) => host === d || host.endsWith('.' + d));
}

function isGumroad(href: string): boolean {
  const host = hostnameOf(href);
  return host === 'gumroad.com' || host.endsWith('.gumroad.com');
}

function isScannerHref(href: string): boolean {
  if (!href) return false;
  if (href.startsWith('#dashboard') || href === '/#dashboard') return true;
  return SCANNER_PATH_RE.test(href) || href.includes('#dashboard');
}

function isCalculatorHref(href: string): boolean {
  return !!href && /\/arbitrage-calculator\/?/i.test(href);
}

function isScannerName(lower: string): boolean {
  return (
    lower === 'hero_start' ||
    lower === 'nav_monitor' ||
    lower.includes('scanner') ||
    /(_|^)(open_monitor|snapshot_open)/.test(lower)
  );
}

function isCalculatorName(lower: string): boolean {
  return (
    lower.includes('calculator') ||
    lower.includes('_calc') ||
    lower.endsWith('calc_cta') ||
    lower === 'sg_calculator_cta'
  );
}

function isAffiliateName(lower: string): boolean {
  return (
    lower.includes('aff') ||
    lower.includes('rec_') ||
    lower.includes('open_binance') ||
    lower.includes('open_mexc') ||
    lower.includes('open_bybit') ||
    lower.includes('cta_binance') ||
    lower.includes('cta_mexc') ||
    lower.includes('cta_bybit') ||
    lower.includes('hero_opp_trade') ||
    lower.includes('revenue_banner_trade') ||
    lower.includes('sticky_bar_trade') ||
    lower.includes('trade_buy') ||
    lower.includes('trade_sell') ||
    lower.includes('blog_cta_') ||
    lower.includes('blog_open_') ||
    lower.includes('final_cta_')
  );
}

/**
 * Resolve a user click to exactly one analytics event.
 * Funnel CTAs emit the canonical funnel name; other tracked clicks keep their data-track name.
 */
export function resolveClickEvent(
  trackName: string | null | undefined,
  href: string,
  params: ClickParams = {}
): ResolvedClickEvent | null {
  const name = (trackName || '').trim();
  const lower = name.toLowerCase();
  const sourcePage = params.source_page || 'unknown';
  const base = {
    source_page: sourcePage,
    cta_name: name || undefined,
    region: params.region,
  };

  // Starter Pack checkout (Gumroad only — not /pro/ landing visits)
  if (
    isGumroad(href) ||
    lower.includes('pro_buy') ||
    lower === 'starter_pack_checkout_click'
  ) {
    return {
      event: 'starter_pack_checkout_click',
      payload: {
        ...base,
        product: 'crypto_arbitrage_starter_pack',
        price: 9,
        currency: 'USD',
        destination: href || undefined,
      },
    };
  }

  if (isScannerName(lower) || (name && isScannerHref(href))) {
    return {
      event: 'scanner_open',
      payload: {
        ...base,
        destination: href || undefined,
        asset: params.sym || undefined,
      },
    };
  }

  if (isCalculatorName(lower) || (name && isCalculatorHref(href))) {
    return {
      event: 'calculator_open',
      payload: {
        ...base,
        destination: href || undefined,
      },
    };
  }

  if (href && /^https?:\/\//i.test(href) && isAffiliateHost(href) && !isGumroad(href)) {
    if (isAffiliateName(lower) || !name) {
      return {
        event: 'affiliate_click',
        payload: {
          ...base,
          exchange: params.ex || undefined,
          symbol: params.sym || undefined,
          destination: href,
        },
      };
    }
  }

  if (name) {
    return {
      event: name,
      payload: {
        ...base,
        exchange: params.ex || undefined,
        symbol: params.sym || undefined,
        destination: href || undefined,
      },
    };
  }

  return null;
}
