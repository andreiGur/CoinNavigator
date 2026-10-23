import { describe, expect, it } from 'vitest';
import {
  buildCalculatorOpenPayload,
  consumeCalculatorOpenCta,
  isAffiliateHost,
  isStarterPackCheckoutHref,
  rememberCalculatorOpenCta,
  resolveClickEvent,
  shouldDeferCalculatorOpenTrack,
  shouldEmitCalculatorOpenOnArrival,
  shouldIgnoreAnalyticsClick,
} from './click-events.js';

function memoryStorage(initial: Record<string, string> = {}) {
  const map = new Map<string, string>(Object.entries(initial));
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => {
      map.set(k, String(v));
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
  };
}

describe('resolveClickEvent — destination priority', () => {
  it('maps Starter Pack Gumroad product URL to starter_pack_checkout_click', () => {
    const r = resolveClickEvent('pro_buy_click', 'https://andregalaxy6.gumroad.com/l/tzynyo', {
      source_page: 'pro',
    });
    expect(r?.event).toBe('starter_pack_checkout_click');
    expect(r?.payload.price).toBe(9);
  });

  it('does not treat generic Gumroad links as starter_pack_checkout_click', () => {
    const r = resolveClickEvent('pro_buy_click', 'https://andregalaxy6.gumroad.com/l/other-product', {
      source_page: 'pro',
    });
    expect(r?.event).toBe('affiliate_click');
    expect(r?.event).not.toBe('starter_pack_checkout_click');
  });

  it('does not treat misleading checkout event names without product URL as checkout', () => {
    const r = resolveClickEvent('starter_pack_checkout_click', '/pro/', { source_page: 'home' });
    expect(r?.event).toBe('cta_click');
    expect(r?.payload.cta_name).toBe('starter_pack_checkout_click');
  });

  it('keeps /pro/ landing as non-checkout', () => {
    const r = resolveClickEvent('homepage_pro_cta', '/pro/', { source_page: 'home' });
    expect(r?.event).toBe('homepage_pro_cta');
  });

  it('never classifies Binance affiliate as calculator_open despite calc_* track name', () => {
    const r = resolveClickEvent(
      'calc_cta_binance',
      'https://accounts.binance.com/register?ref=308417308',
      { source_page: 'arbitrage-calculator', ex: 'Binance' }
    );
    expect(r?.event).toBe('affiliate_click');
    expect(r?.event).not.toBe('calculator_open');
  });

  it('never classifies MEXC affiliate as scanner_open despite scanner in track name', () => {
    const r = resolveClickEvent(
      'open_mexc_from_scanner',
      'https://www.mexc.com/acquisition/custom-sign-up?shareCode=mexc-3ksU2',
      { source_page: 'home', ex: 'MEXC' }
    );
    expect(r?.event).toBe('affiliate_click');
    expect(r?.event).not.toBe('scanner_open');
  });

  it('prioritizes calculator href over scanner-like track names', () => {
    const r = resolveClickEvent('scanner_seo_calc', '/arbitrage-calculator/', {
      source_page: 'crypto-arbitrage-scanner',
    });
    expect(r?.event).toBe('calculator_open');
  });

  it('maps Singapore calculator CTA to calculator_open', () => {
    const r = resolveClickEvent('sg_calculator_cta', '/arbitrage-calculator/', {
      source_page: 'singapore/crypto-arbitrage',
    });
    expect(r?.event).toBe('calculator_open');
  });

  it('maps scanner CTAs to scanner_open only', () => {
    const r = resolveClickEvent('hero_start', '#dashboard', { source_page: 'home' });
    expect(r?.event).toBe('scanner_open');
  });

  it('maps affiliate outbound once as affiliate_click', () => {
    const r = resolveClickEvent(
      'rec_exchange',
      'https://accounts.binance.com/register?ref=308417308',
      { source_page: 'home', ex: 'Binance' }
    );
    expect(r?.event).toBe('affiliate_click');
    expect(r?.payload.exchange).toBe('Binance');
  });

  it('recognizes affiliate hosts', () => {
    expect(isAffiliateHost('https://www.mexc.com/x')).toBe(true);
    expect(isAffiliateHost('https://example.com')).toBe(false);
  });

  it('detects only the Starter Pack product path', () => {
    expect(isStarterPackCheckoutHref('https://andregalaxy6.gumroad.com/l/tzynyo')).toBe(true);
    expect(isStarterPackCheckoutHref('https://andregalaxy6.gumroad.com/l/tzynyo?wanted=true')).toBe(true);
    expect(isStarterPackCheckoutHref('https://gumroad.com/l/other')).toBe(false);
    expect(isStarterPackCheckoutHref('https://accounts.binance.com/register')).toBe(false);
  });
});

describe('calculator_open once per navigation', () => {
  it('defers calculator_open tracking from the CTA click', () => {
    expect(shouldDeferCalculatorOpenTrack('calculator_open')).toBe(true);
    expect(shouldDeferCalculatorOpenTrack('affiliate_click')).toBe(false);
  });

  it('remembers CTA on click and consumes it once on arrival', () => {
    const storage = memoryStorage();
    rememberCalculatorOpenCta('sg_calculator_cta', storage);
    expect(consumeCalculatorOpenCta(storage)).toBe('sg_calculator_cta');
    expect(consumeCalculatorOpenCta(storage)).toBeNull();
  });

  it('emits once for direct entry / reload, and again on bfcache restore', () => {
    expect(shouldEmitCalculatorOpenOnArrival({ alreadySentThisDocument: false })).toBe(true);
    expect(shouldEmitCalculatorOpenOnArrival({ alreadySentThisDocument: true })).toBe(false);
    expect(
      shouldEmitCalculatorOpenOnArrival({ alreadySentThisDocument: true, bfCacheRestore: true })
    ).toBe(true);
  });

  it('builds navigation payload with page_load when no CTA was remembered', () => {
    expect(buildCalculatorOpenPayload(null)).toEqual({
      source_page: 'arbitrage-calculator',
      cta_name: 'page_load',
      interaction_type: 'navigation',
    });
  });

  it('click→navigate still yields a single open (deferred + one arrival)', () => {
    const storage = memoryStorage();
    const events: string[] = [];

    // CTA click: defer (do not push calculator_open)
    const resolved = resolveClickEvent('blog_to_calc', '/arbitrage-calculator/', {
      source_page: 'blog',
    });
    expect(resolved?.event).toBe('calculator_open');
    if (shouldDeferCalculatorOpenTrack(resolved!.event)) {
      rememberCalculatorOpenCta('blog_to_calc', storage);
    } else {
      events.push(resolved!.event);
    }

    // Arrival: emit once
    let sent = false;
    if (shouldEmitCalculatorOpenOnArrival({ alreadySentThisDocument: sent })) {
      sent = true;
      const cta = consumeCalculatorOpenCta(storage);
      events.push('calculator_open');
      expect(buildCalculatorOpenPayload(cta).cta_name).toBe('blog_to_calc');
    }
    // Same document must not emit again
    if (shouldEmitCalculatorOpenOnArrival({ alreadySentThisDocument: sent })) {
      events.push('calculator_open');
    }

    expect(events).toEqual(['calculator_open']);
  });
});

describe('engagement guards', () => {
  it('ignores untrusted and data-cn-auto clicks (auto refresh)', () => {
    expect(shouldIgnoreAnalyticsClick({ isTrusted: false })).toBe(true);
    expect(shouldIgnoreAnalyticsClick({ isTrusted: true, cnAuto: '1' })).toBe(true);
    expect(shouldIgnoreAnalyticsClick({ isTrusted: true, cnAuto: null })).toBe(false);
  });
});

describe('growth funnel CTA identifiers', () => {
  it('maps article tool scanner CTA to scanner_open once', () => {
    const r = resolveClickEvent('article_tool_scanner', '/#dashboard', { source_page: 'blog' });
    expect(r?.event).toBe('scanner_open');
    expect(r?.payload.cta_name).toBe('article_tool_scanner');
  });

  it('maps article tool calculator CTA to calculator_open once', () => {
    const r = resolveClickEvent('article_tool_calc', '/arbitrage-calculator/', {
      source_page: 'blog',
    });
    expect(r?.event).toBe('calculator_open');
    expect(r?.payload.cta_name).toBe('article_tool_calc');
  });

  it('maps scanner-to-calculator primary CTA with asset query to calculator_open', () => {
    const r = resolveClickEvent('btc_scanner_to_calc', '/arbitrage-calculator/?asset=BTC', {
      source_page: 'bitcoin-arbitrage-scanner',
    });
    expect(r?.event).toBe('calculator_open');
  });

  it('maps calc next Binance compare to affiliate_click only', () => {
    const r = resolveClickEvent(
      'calc_next_binance',
      'https://accounts.binance.com/register?ref=308417308',
      { source_page: 'arbitrage-calculator', ex: 'Binance' }
    );
    expect(r?.event).toBe('affiliate_click');
  });
});
