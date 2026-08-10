import { describe, expect, it, vi, afterEach } from 'vitest';
import { binanceAdapter } from './adapters/binance.js';
import { bybitAdapter } from './adapters/bybit.js';
import { mexcAdapter } from './adapters/mexc.js';
import { UpstreamError } from './adapters/base.js';
import {
  formatMaybeNumber,
  formatStatusBool,
  latencyBucketMs,
  sanitizeAnalyticsProps,
  qualifiedVerdictCopy,
} from './display.js';

describe('exchange adapters normalization', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('normalizes Binance depth', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        bids: [['100.5', '1.2'], ['100.0', '2']],
        asks: [['101.0', '0.5'], ['102.0', '3']],
      }),
    })));
    const book = await binanceAdapter.fetchOrderBook('BTCUSDT');
    expect(book.exchange).toBe('Binance');
    expect(book.bids[0]).toEqual({ price: '100.5', quantity: '1.2' });
    expect(book.asks[0]).toEqual({ price: '101.0', quantity: '0.5' });
    expect(book.fetchedAt).toBeTruthy();
  });

  it('normalizes Bybit orderbook', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        retCode: 0,
        result: { b: [['110', '1']], a: [['111', '2']], ts: 1700000000000 },
      }),
    })));
    const book = await bybitAdapter.fetchOrderBook('ETHUSDT');
    expect(book.exchange).toBe('Bybit');
    expect(book.exchangeTimestampMs).toBe(1700000000000);
    expect(book.bids[0]!.price).toBe('110');
  });

  it('normalizes MEXC depth', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        bids: [['50', '10']],
        asks: [['51', '8']],
        timestamp: 1700000001000,
      }),
    })));
    const book = await mexcAdapter.fetchOrderBook('SOLUSDT');
    expect(book.exchange).toBe('MEXC');
    expect(book.asks[0]!.quantity).toBe('8');
  });

  it('rejects malformed Binance payload', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ bids: 'nope', asks: [] }),
    })));
    await expect(binanceAdapter.fetchOrderBook('BTCUSDT')).rejects.toBeInstanceOf(UpstreamError);
  });

  it('maps rate limit', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 429,
      json: async () => ({}),
    })));
    await expect(mexcAdapter.fetchOrderBook('XRPUSDT')).rejects.toMatchObject({
      category: 'rate_limit',
    });
  });

  it('maps timeout / abort', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      const err = new Error('aborted');
      err.name = 'AbortError';
      throw err;
    }));
    await expect(bybitAdapter.fetchOrderBook('BTCUSDT')).rejects.toMatchObject({
      category: 'timeout',
    });
  });

  it('maps exchange unavailable http', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 503,
      json: async () => ({ error: 'down' }),
    })));
    await expect(binanceAdapter.fetchOrderBook('BTCUSDT')).rejects.toMatchObject({
      category: 'http',
    });
  });

  it('Binance falls back to data-api.binance.vision', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const u = String(url);
        if (u.includes('api.binance.com')) {
          return { ok: false, status: 451, json: async () => ({}) };
        }
        if (u.includes('data-api.binance.vision')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              bids: [['100', '1']],
              asks: [['101', '1']],
            }),
          };
        }
        return { ok: false, status: 500, json: async () => ({}) };
      }),
    );
    const book = await binanceAdapter.fetchOrderBook('BTCUSDT');
    expect(book.bids[0]!.price).toBe('100');
  });

  it('Bybit falls back to api.bytick.com', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const u = String(url);
        if (u.includes('api.bybit.com')) {
          return { ok: false, status: 403, json: async () => ({}) };
        }
        if (u.includes('api.bytick.com')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              retCode: 0,
              result: { b: [['110', '1']], a: [['111', '1']], ts: 1 },
            }),
          };
        }
        return { ok: false, status: 500, json: async () => ({}) };
      }),
    );
    const book = await bybitAdapter.fetchOrderBook('ETHUSDT');
    expect(book.bids[0]!.price).toBe('110');
  });
});

describe('display helpers', () => {
  it('renders unavailable not zero', () => {
    expect(formatMaybeNumber(null)).toBe('Unavailable');
    expect(formatMaybeNumber(undefined)).toBe('Unavailable');
    expect(formatMaybeNumber(1.23456, { digits: 2, suffix: '%' })).toBe('1.23%');
    expect(formatStatusBool(null)).toBe('Unavailable');
    expect(formatStatusBool(true)).toContain('Open');
  });

  it('qualified labels', () => {
    expect(qualifiedVerdictCopy('potentially_executable')).toBe('Potentially executable');
    expect(qualifiedVerdictCopy('transfer_unverified')).toBe('Transfer route not verified');
    expect(qualifiedVerdictCopy('insufficient_liquidity')).toBe('Insufficient liquidity');
    expect(qualifiedVerdictCopy('not_profitable')).toBe('Not profitable after estimated costs');
    expect(qualifiedVerdictCopy('unavailable')).toBe('Live data unavailable');
  });

  it('analytics sanitize excludes exact values', () => {
    const cleaned = sanitizeAnalyticsProps({
      asset: 'BTC',
      amount: 1000,
      amount_bucket: '1000_4999',
      net_profit: 12.34,
      net_profit_bucket: '10_50',
      email: 'a@b.c',
      verdict: 'transfer_unverified',
    });
    expect(cleaned.amount).toBeUndefined();
    expect(cleaned.net_profit).toBeUndefined();
    expect(cleaned.email).toBeUndefined();
    expect(cleaned.amount_bucket).toBe('1000_4999');
    expect(cleaned.verdict).toBe('transfer_unverified');
  });

  it('latency buckets', () => {
    expect(latencyBucketMs(100)).toBe('under_500ms');
    expect(latencyBucketMs(800)).toBe('500_1499ms');
    expect(latencyBucketMs(2000)).toBe('1500_2999ms');
    expect(latencyBucketMs(5000)).toBe('3000ms_plus');
  });
});
