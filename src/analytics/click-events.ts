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

/** Canonical Starter Pack Gumroad product path. */
const STARTER_PACK_PATH_RE = /\/l\/tzynyo\/?$/i;

const SCANNER_PATH_RE =
  /\/(#dashboard|crypto-arbitrage-scanner\/?|bitcoin-arbitrage-scanner\/?|ethereum-arbitrage-scanner\/?|solana-arbitrage-scanner\/?|trade\/?)/i;

export const CALC_OPEN_CTA_KEY = 'cn_calc_open_cta';

function hostnameOf(href: string): string {
  try {
    return new URL(href, 'https://coinnavigator.net').hostname.toLowerCase();
  } catch {
    return '';
  }
}

function pathnameOf(href: string): string {
  try {
    return new URL(href, 'https://coinnavigator.net').pathname;
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

/** True only for the real Starter Pack checkout URL (not any Gumroad link). */
export function isStarterPackCheckoutHref(href: string): boolean {
  if (!href || !isGumroad(href)) return false;
  return STARTER_PACK_PATH_RE.test(pathnameOf(href));
}

function isExternalHttp(href: string): boolean {
  return !!href && /^https?:\/\//i.test(href);
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

/**
 * Resolve a user click to exactly one analytics event.
 * Actual link destinations take priority over broad data-track name matching.
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

  // 1) Real Starter Pack Gumroad product URL only (never name-only / generic Gumroad).
  if (isStarterPackCheckoutHref(href)) {
    return {
      event: 'starter_pack_checkout_click',
      payload: {
        ...base,
        product: 'crypto_arbitrage_starter_pack',
        price: 9,
        currency: 'USD',
        destination: href,
      },
    };
  }

  // 2) Outbound affiliate destinations win over track-name heuristics
  //    (e.g. calc_cta_binance / *scanner* names must not become calculator_open / scanner_open).
  if (isExternalHttp(href) && isAffiliateHost(href)) {
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

  // 3) Internal destinations by href
  if (isCalculatorHref(href)) {
    return {
      event: 'calculator_open',
      payload: {
        ...base,
        destination: href || undefined,
      },
    };
  }

  if (isScannerHref(href)) {
    return {
      event: 'scanner_open',
      payload: {
        ...base,
        destination: href || undefined,
        asset: params.sym || undefined,
      },
    };
  }

  // 4) Name-based fallback only when href is not an affiliate / calc / scanner destination
  if (name && isCalculatorName(lower)) {
    return {
      event: 'calculator_open',
      payload: {
        ...base,
        destination: href || undefined,
      },
    };
  }

  if (name && isScannerName(lower)) {
    return {
      event: 'scanner_open',
      payload: {
        ...base,
        destination: href || undefined,
        asset: params.sym || undefined,
      },
    };
  }

  if (name) {
    // Do not allow data-track alone to forge reserved funnel event names.
    const reserved = {
      starter_pack_checkout_click: true,
      calculator_open: true,
      scanner_open: true,
      affiliate_click: true,
      calculator_used: true,
    } as Record<string, boolean>;
    const eventName = reserved[lower] ? 'cta_click' : name;
    return {
      event: eventName,
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

/** calculator_open is emitted on the calculator page (once per navigation), not on the CTA click. */
export function shouldDeferCalculatorOpenTrack(eventName: string): boolean {
  return eventName === 'calculator_open';
}

export function rememberCalculatorOpenCta(
  ctaName: string | null | undefined,
  storage: Pick<Storage, 'setItem'> = sessionStorage
): void {
  try {
    storage.setItem(CALC_OPEN_CTA_KEY, (ctaName || 'cta_click').trim() || 'cta_click');
  } catch {
    /* ignore */
  }
}

export function consumeCalculatorOpenCta(
  storage: Pick<Storage, 'getItem' | 'removeItem'> = sessionStorage
): string | null {
  try {
    const v = storage.getItem(CALC_OPEN_CTA_KEY);
    if (v) {
      storage.removeItem(CALC_OPEN_CTA_KEY);
      return v;
    }
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Decide whether this arrival should emit calculator_open.
 * - Click→navigate: CTA was remembered; still emit once here (sole emitter).
 * - Direct / reload / back-forward: emit once per arrival.
 * `alreadySentThisDocument` guards double-binding on the same document.
 * `bfCacheRestore` forces a new emission after back/forward restore.
 */
export function shouldEmitCalculatorOpenOnArrival(opts: {
  alreadySentThisDocument: boolean;
  bfCacheRestore?: boolean;
}): boolean {
  if (opts.bfCacheRestore) return true;
  return !opts.alreadySentThisDocument;
}

export function buildCalculatorOpenPayload(ctaName: string | null | undefined): Record<string, unknown> {
  return {
    source_page: 'arbitrage-calculator',
    cta_name: ctaName || 'page_load',
    interaction_type: 'navigation',
  };
}

/** Ignore programmatic / auto-refresh clicks for engagement analytics. */
export function shouldIgnoreAnalyticsClick(opts: {
  isTrusted: boolean | undefined;
  cnAuto?: string | null;
}): boolean {
  if (opts.isTrusted === false) return true;
  if (opts.cnAuto === '1') return true;
  return false;
}
