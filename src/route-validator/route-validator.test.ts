import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';
import { simulateBuyFromAsks, simulateSellFromBids } from './order-book.js';
import { validateRouteRequest } from './validate.js';
import { computeVerdict, verdictLabel } from './verdict.js';
import { validateLiveRoute } from './service.js';
import { handleRouteValidatorRequest } from './http.js';
import { cacheReset } from './cache.js';
import { resetRateLimits } from '../alerts/rate-limit.js';
import type { MarketExecutionSide, TransferRouteInfo } from './types.js';
import type { VercelLikeRequest, VercelLikeResponse } from './http.js';

function asks(levels: [string, string][]) {
  return levels.map(([price, quantity]) => ({ price, quantity }));
}
function bids(levels: [string, string][]) {
  return levels.map(([price, quantity]) => ({ price, quantity }));
}

describe('order-book simulation', () => {
  it('fully fillable buy with weighted average', () => {
    const r = simulateBuyFromAsks(asks([['100', '5'], ['101', '5']]), 500);
    expect(r.fullyFillable).toBe(true);
    expect(r.assetQuantity).toBeCloseTo(5, 8);
    expect(r.averageExecutionPrice).toBeCloseTo(100, 8);
    expect(r.bestAsk).toBe(100);
    expect(r.estimatedSlippagePct).toBeCloseTo(0, 6);
    expect(r.unfilledQuoteUsd).toBeCloseTo(0, 8);
  });

  it('partially fillable buy', () => {
    const r = simulateBuyFromAsks(asks([['100', '1']]), 500);
    expect(r.fullyFillable).toBe(false);
    expect(r.assetQuantity).toBeCloseTo(1, 8);
    expect(r.unfilledQuoteUsd).toBeCloseTo(400, 4);
  });

  it('fully fillable sell', () => {
    const r = simulateSellFromBids(bids([['110', '2'], ['109', '2']]), 2);
    expect(r.fullyFillable).toBe(true);
    expect(r.quoteReceivedUsd).toBeCloseTo(220, 6);
    expect(r.averageExecutionPrice).toBeCloseTo(110, 8);
    expect(r.estimatedSlippagePct).toBeCloseTo(0, 6);
  });

  it('partially fillable sell', () => {
    const r = simulateSellFromBids(bids([['110', '1']]), 3);
    expect(r.fullyFillable).toBe(false);
    expect(r.unsoldAssetQty).toBeCloseTo(2, 8);
  });

  it('slippage on buy across levels', () => {
    const r = simulateBuyFromAsks(asks([['100', '1'], ['110', '10']]), 210);
    expect(r.fullyFillable).toBe(true);
    expect(r.averageExecutionPrice!).toBeGreaterThan(100);
    expect(r.estimatedSlippagePct!).toBeGreaterThan(0);
  });

  it('rejects empty book', () => {
    expect(() => simulateBuyFromAsks([], 100)).toThrow();
    expect(() => simulateSellFromBids([], 1)).toThrow();
  });

  it('rejects invalid levels', () => {
    expect(() => simulateBuyFromAsks(asks([['0', '1']]), 100)).toThrow();
  });

  it('handles small and large amounts', () => {
    const small = simulateBuyFromAsks(asks([['50000', '10']]), 10);
    expect(small.fullyFillable).toBe(true);
    const large = simulateBuyFromAsks(asks([['1', '100000']]), 50000);
    expect(large.fullyFillable).toBe(true);
  });
});

describe('request validation', () => {
  it('accepts valid route', () => {
    const r = validateRouteRequest({
      asset: 'BTC',
      quote: 'USDT',
      buy_exchange: 'Binance',
      sell_exchange: 'Bybit',
      trade_amount_usd: 1000,
    });
    expect(r.ok).toBe(true);
  });

  it('rejects same exchange', () => {
    const r = validateRouteRequest({
      asset: 'BTC',
      quote: 'USDT',
      buy_exchange: 'Binance',
      sell_exchange: 'Binance',
      trade_amount_usd: 1000,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('same_exchange');
  });

  it('rejects unsupported asset and USDT asset', () => {
    expect(validateRouteRequest({
      asset: 'DOGE', quote: 'USDT', buy_exchange: 'Binance', sell_exchange: 'Bybit', trade_amount_usd: 100,
    }).ok).toBe(false);
    expect(validateRouteRequest({
      asset: 'USDT', quote: 'USDT', buy_exchange: 'Binance', sell_exchange: 'Bybit', trade_amount_usd: 100,
    }).ok).toBe(false);
  });

  it('rejects unsupported exchange and excessive amount', () => {
    expect(validateRouteRequest({
      asset: 'BTC', quote: 'USDT', buy_exchange: 'Gate', sell_exchange: 'Binance', trade_amount_usd: 100,
    }).ok).toBe(false);
    expect(validateRouteRequest({
      asset: 'BTC', quote: 'USDT', buy_exchange: 'Binance', sell_exchange: 'Bybit', trade_amount_usd: 1e9,
    }).ok).toBe(false);
  });

  it('rejects negative overrides', () => {
    const r = validateRouteRequest({
      asset: 'ETH',
      quote: 'USDT',
      buy_exchange: 'Bybit',
      sell_exchange: 'MEXC',
      trade_amount_usd: 500,
      overrides: { withdrawal_fee_asset: -1 },
    });
    expect(r.ok).toBe(false);
  });
});

describe('verdict rules', () => {
  const liveSide = (fully: boolean): MarketExecutionSide => ({
    exchange: 'Binance',
    symbol: 'BTCUSDT',
    bestPrice: 100,
    averageExecutionPrice: 100,
    estimatedSlippagePct: 0.01,
    quoteSpentOrReceivedUsd: 1000,
    assetQuantity: 10,
    availableDepthUsd: 50000,
    fullyFillable: fully,
    unfilledQuoteUsd: 0,
    unsoldAssetQty: 0,
    levelsUsed: 2,
    orderBookTimestampMs: Date.now(),
    sourceType: 'live',
  });

  const transfer = (over: Partial<TransferRouteInfo> = {}): TransferRouteInfo => ({
    depositEnabled: null,
    withdrawalEnabled: null,
    commonNetworks: [],
    selectedNetwork: null,
    withdrawalFeeAsset: null,
    networkFeeAsset: null,
    minWithdrawalAsset: null,
    confirmations: null,
    sourceType: 'unavailable',
    lastVerified: null,
    unavailableReason: 'n/a',
    note: null,
    ...over,
  });

  it('insufficient liquidity', () => {
    const r = computeVerdict({
      buy: liveSide(false),
      sell: liveSide(true),
      transfer: transfer(),
      netProfitUsd: 10,
      netProfitPct: 1,
      freshnessSeconds: 1,
      bookStale: false,
      withdrawalFeeKnown: true,
      transferLiveVerified: true,
    });
    expect(r.verdict).toBe('insufficient_liquidity');
  });

  it('transfer unverified when metadata missing even if profitable', () => {
    const r = computeVerdict({
      buy: liveSide(true),
      sell: liveSide(true),
      transfer: transfer(),
      netProfitUsd: 25,
      netProfitPct: 1,
      freshnessSeconds: 2,
      bookStale: false,
      withdrawalFeeKnown: false,
      transferLiveVerified: false,
    });
    expect(r.verdict).toBe('transfer_unverified');
    expect(verdictLabel(r.verdict)).toBe('Transfer route not verified');
  });

  it('not profitable', () => {
    const r = computeVerdict({
      buy: liveSide(true),
      sell: liveSide(true),
      transfer: transfer({
        sourceType: 'live',
        depositEnabled: true,
        withdrawalEnabled: true,
        commonNetworks: ['BTC'],
        selectedNetwork: 'BTC',
        withdrawalFeeAsset: 0.0001,
      }),
      netProfitUsd: -5,
      netProfitPct: -0.5,
      freshnessSeconds: 1,
      bookStale: false,
      withdrawalFeeKnown: true,
      transferLiveVerified: true,
    });
    expect(r.verdict).toBe('not_profitable');
  });

  it('potentially executable when fully verified and profitable', () => {
    const r = computeVerdict({
      buy: liveSide(true),
      sell: liveSide(true),
      transfer: transfer({
        sourceType: 'live',
        depositEnabled: true,
        withdrawalEnabled: true,
        commonNetworks: ['BTC'],
        selectedNetwork: 'BTC',
        withdrawalFeeAsset: 0.0001,
      }),
      netProfitUsd: 20,
      netProfitPct: 1,
      freshnessSeconds: 1,
      bookStale: false,
      withdrawalFeeKnown: true,
      transferLiveVerified: true,
    });
    expect(r.verdict).toBe('potentially_executable');
    expect(r.confidence).toBe('high');
  });

  it('stale data', () => {
    const r = computeVerdict({
      buy: liveSide(true),
      sell: liveSide(true),
      transfer: transfer(),
      netProfitUsd: 10,
      netProfitPct: 1,
      freshnessSeconds: 1,
      bookStale: true,
      withdrawalFeeKnown: true,
      transferLiveVerified: true,
    });
    expect(r.verdict).toBe('stale_data');
  });
});

function mockBook(bids: [string, string][], asks: [string, string][]) {
  return {
    bids,
    asks,
  };
}

describe('service with mocked upstream', () => {
  beforeEach(() => {
    cacheReset();
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const u = String(url);
      if (u.includes('binance.com') && u.includes('/depth')) {
        return {
          ok: true,
          status: 200,
          json: async () => mockBook([['101', '10']], [['100', '10']]),
        };
      }
      if (u.includes('bybit.com') && u.includes('orderbook')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            retCode: 0,
            result: { b: [['110', '10']], a: [['109', '10']], ts: Date.now() },
          }),
        };
      }
      if (u.includes('mexc.com') && u.includes('/depth')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ...mockBook([['105', '10']], [['104', '10']]),
            timestamp: Date.now(),
          }),
        };
      }
      return { ok: false, status: 500, json: async () => ({}) };
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('validates a profitable-looking route as transfer_unverified without live transfer meta', async () => {
    const out = await validateLiveRoute({
      asset: 'BTC',
      quote: 'USDT',
      buy_exchange: 'Binance',
      sell_exchange: 'Bybit',
      trade_amount_usd: 500,
      overrides: { withdrawal_fee_asset: 0.0001 },
    });
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.result.buy_market.sourceType).toBe('live');
      expect(out.result.sell_market.sourceType).toBe('live');
      expect(out.result.unavailable_fields).toContain('deposit_status');
      expect(['transfer_unverified', 'not_profitable', 'marginal', 'potentially_executable', 'insufficient_liquidity']).toContain(
        out.result.verdict,
      );
      // With override, withdrawal fee is known as estimated/user
      expect(out.result.fee_sources.withdrawal_fee_kind).not.toBe('unavailable');
    }
  });

  it('unknown withdrawal fee is not treated as zero truth', async () => {
    const out = await validateLiveRoute({
      asset: 'ETH',
      quote: 'USDT',
      buy_exchange: 'Bybit',
      sell_exchange: 'MEXC',
      trade_amount_usd: 1000,
    });
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.result.unavailable_fields).toContain('withdrawal_fee_asset');
      expect(out.result.fee_sources.withdrawal_fee_kind).toBe('unavailable');
      // Missing fee is never treated as verified zero — either transfer_unverified
      // (if estimated net looks positive) or not_profitable (if costs already wipe it).
      expect(['transfer_unverified', 'not_profitable']).toContain(out.result.verdict);
      expect(out.result.transfer_route.sourceType).not.toBe('live');
    }
  });

  it('rejects same exchange via service', async () => {
    const out = await validateLiveRoute({
      asset: 'SOL',
      quote: 'USDT',
      buy_exchange: 'MEXC',
      sell_exchange: 'MEXC',
      trade_amount_usd: 200,
    });
    expect(out.ok).toBe(false);
  });

  it('handles upstream timeout', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      const err = new Error('aborted');
      err.name = 'AbortError';
      throw err;
    }));
    const out = await validateLiveRoute({
      asset: 'BTC',
      quote: 'USDT',
      buy_exchange: 'Binance',
      sell_exchange: 'Bybit',
      trade_amount_usd: 100,
    });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.category).toBe('market_unavailable');
  });

  it('insufficient liquidity for huge size', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const u = String(url);
      const tiny = mockBook([['100', '0.001']], [['100', '0.001']]);
      if (u.includes('bybit')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            retCode: 0,
            result: { b: tiny.bids, a: tiny.asks, ts: Date.now() },
          }),
        };
      }
      return { ok: true, status: 200, json: async () => tiny };
    }));
    const out = await validateLiveRoute({
      asset: 'BTC',
      quote: 'USDT',
      buy_exchange: 'Binance',
      sell_exchange: 'Bybit',
      trade_amount_usd: 50000,
    });
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.result.verdict).toBe('insufficient_liquidity');
  });
});

describe('HTTP handler', () => {
  beforeEach(() => {
    resetRateLimits();
    cacheReset();
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const u = String(url);
      if (u.includes('bybit')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            retCode: 0,
            result: { b: [['101', '5']], a: [['100', '5']], ts: Date.now() },
          }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => mockBook([['101', '5']], [['100', '5']]),
      };
    }));
  });
  afterEach(() => vi.unstubAllGlobals());

  function mockRes() {
    const state: { statusCode: number; body: unknown; headers: Record<string, string> } = {
      statusCode: 200,
      body: null,
      headers: {},
    };
    const res: VercelLikeResponse = {
      status(code) {
        state.statusCode = code;
        return res;
      },
      setHeader(k, v) {
        state.headers[k.toLowerCase()] = v;
      },
      json(body) {
        state.body = body;
      },
      end() {},
    };
    return { res, state };
  }

  it('valid request', async () => {
    const { res, state } = mockRes();
    const req: VercelLikeRequest = {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '8.8.8.8' },
      body: {
        asset: 'BTC',
        quote: 'USDT',
        buy_exchange: 'Binance',
        sell_exchange: 'Bybit',
        trade_amount_usd: 100,
      },
    };
    await handleRouteValidatorRequest(req, res);
    expect(state.statusCode).toBe(200);
    expect(state.body).toMatchObject({ ok: true });
    expect(state.headers['x-robots-tag']).toContain('noindex');
    expect(JSON.stringify(state.body)).not.toContain('bids');
  });

  it('invalid content type and payload', async () => {
    const a = mockRes();
    await handleRouteValidatorRequest(
      { method: 'POST', headers: { 'content-type': 'text/plain' }, body: '{}' },
      a.res,
    );
    expect(a.state.statusCode).toBe(415);

    const b = mockRes();
    await handleRouteValidatorRequest(
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: { asset: 'BTC', buy_exchange: 'Binance', sell_exchange: 'Bybit', trade_amount_usd: -1 },
      },
      b.res,
    );
    expect(b.state.statusCode).toBe(400);
  });

  it('does not leak raw upstream errors', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 418,
      json: async () => ({ secret_upstream: 'leak' }),
    })));
    const { res, state } = mockRes();
    await handleRouteValidatorRequest(
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: {
          asset: 'XRP',
          quote: 'USDT',
          buy_exchange: 'MEXC',
          sell_exchange: 'Binance',
          trade_amount_usd: 100,
        },
      },
      res,
    );
    expect(state.statusCode).toBe(503);
    expect(JSON.stringify(state.body)).not.toContain('secret_upstream');
    expect(state.body).toMatchObject({
      ok: false,
      error: { code: 'MARKET_DATA_UNAVAILABLE' },
    });
  });
});

describe('analytics contract helpers', () => {
  it('amount bucket and labels exclude exact money', async () => {
    const { bucketAmountUsd } = await import('../net-profit/buckets.js');
    expect(bucketAmountUsd(1000)).toBe('1000_4999');
    const sample = {
      name: 'live_route_validation_completed',
      props: {
        asset: 'BTC',
        amount_bucket: bucketAmountUsd(1000),
        verdict: 'transfer_unverified',
        confidence: 'medium',
      },
    };
    expect(JSON.stringify(sample)).not.toMatch(/1000\.|email|@/);
  });
});
