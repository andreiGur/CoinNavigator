import { describe, expect, it } from 'vitest';
import { isAffiliateHost, resolveClickEvent } from './click-events.js';

describe('resolveClickEvent', () => {
  it('maps Gumroad Starter Pack clicks once', () => {
    const r = resolveClickEvent('pro_buy_click', 'https://andregalaxy6.gumroad.com/l/tzynyo', {
      source_page: 'pro',
    });
    expect(r?.event).toBe('starter_pack_checkout_click');
    expect(r?.payload.price).toBe(9);
  });

  it('maps scanner CTAs to scanner_open only', () => {
    const r = resolveClickEvent('hero_start', '#dashboard', { source_page: 'home' });
    expect(r?.event).toBe('scanner_open');
  });

  it('maps Singapore calculator CTA to calculator_open', () => {
    const r = resolveClickEvent('sg_calculator_cta', '/arbitrage-calculator/', {
      source_page: 'singapore/crypto-arbitrage',
    });
    expect(r?.event).toBe('calculator_open');
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

  it('does not treat /pro/ landing as checkout', () => {
    const r = resolveClickEvent('homepage_pro_cta', '/pro/', { source_page: 'home' });
    expect(r?.event).toBe('homepage_pro_cta');
  });

  it('recognizes affiliate hosts', () => {
    expect(isAffiliateHost('https://www.mexc.com/x')).toBe(true);
    expect(isAffiliateHost('https://example.com')).toBe(false);
  });
});
