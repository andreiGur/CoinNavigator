import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchBinanceTickers,
  fetchBybitTickers,
  fetchMexcTickers,
  fetchOkxTickers,
  fetchKucoinTickers,
  fetchGateTickers,
} from './tickers.js';
import { UpstreamError } from './upstream.js';
import { computeSpreadPayloadFromExchangePrices } from './spread.js';
import { buildSpreadSnapshot, buildReferencePrice } from './service.js';
import { handleMarketDataRequest, type VercelLikeResponse } from './http.js';
import { cacheReset } from './cache.js';
import { resetRateLimits } from '../alerts/rate-limit.js';
import { HOMEPAGE_SYMBOLS } from './allowlist.js';
import { mapPool } from './concurrency.js';
import fs from 'node:fs';
import path from 'node:path';

const SYM = new Set(['BTCUSDT', 'ETHUSDT']);

describe('ticker normalization', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('Binance ticker normalization', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => [
        { symbol: 'BTCUSDT', price: '100' },
        { symbol: 'ETHUSDT', price: '200' },
        { symbol: 'DOGEUSDT', price: '0.1' },
      ],
    })));
    const map = await fetchBinanceTickers(SYM);
    expect(map.BTCUSDT).toBe(100);
    expect(map.ETHUSDT).toBe(200);
    expect(map.DOGEUSDT).toBeUndefined();
  });

  it('Bybit ticker normalization', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        result: { list: [{ symbol: 'BTCUSDT', lastPrice: '101' }] },
      }),
    })));
    expect((await fetchBybitTickers(SYM)).BTCUSDT).toBe(101);
  });

  it('MEXC ticker normalization', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => [{ symbol: 'ETHUSDT', price: '55' }],
    })));
    expect((await fetchMexcTickers(SYM)).ETHUSDT).toBe(55);
  });

  it('OKX ticker normalization', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        data: [{ instId: 'BTC-USDT', last: '99' }, { instId: 'ETH-BTC', last: '1' }],
      }),
    })));
    const map = await fetchOkxTickers(SYM);
    expect(map.BTCUSDT).toBe(99);
    expect(Object.keys(map)).toHaveLength(1);
  });

  it('KuCoin ticker normalization', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        data: { ticker: [{ symbol: 'BTC-USDT', last: '88' }] },
      }),
    })));
    expect((await fetchKucoinTickers(SYM)).BTCUSDT).toBe(88);
  });

  it('Gate ticker normalization', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => [{ currency_pair: 'BTC_USDT', last: '77' }],
    })));
    expect((await fetchGateTickers(SYM)).BTCUSDT).toBe(77);
  });

  it('timeout', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      const err = new Error('aborted');
      err.name = 'AbortError';
      throw err;
    }));
    await expect(fetchBinanceTickers(SYM)).rejects.toMatchObject({ category: 'timeout' });
  });

  it('rate limit', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 429,
      json: async () => ({}),
    })));
    await expect(fetchMexcTickers(SYM)).rejects.toMatchObject({ category: 'rate_limit' });
  });

  it('malformed response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ nope: true }),
    })));
    await expect(fetchBinanceTickers(SYM)).rejects.toBeInstanceOf(UpstreamError);
  });

  it('unsupported / empty symbol filter', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => [{ symbol: 'FOOUSDT', price: '1' }],
    })));
    const map = await fetchBinanceTickers(SYM);
    expect(Object.keys(map)).toHaveLength(0);
  });

  it('exchange unavailable http', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 503,
      json: async () => ({}),
    })));
    await expect(fetchBybitTickers(SYM)).rejects.toMatchObject({ category: 'http' });
  });
});

describe('spread payload + service', () => {
  beforeEach(() => {
    cacheReset();
    resetRateLimits();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('successful spread snapshot metadata', () => {
    const payload = computeSpreadPayloadFromExchangePrices(
      {
        Binance: { BTCUSDT: 100 },
        Bybit: { BTCUSDT: 101 },
      },
      ['BTCUSDT'],
    );
    expect(payload.source).toBe('live_gateway');
    expect(payload.timestamp).toBeTruthy();
    expect(payload.symbols.BTCUSDT!.best_buy!.exchange).toBe('Binance');
    expect(payload.symbols.BTCUSDT!.best_sell!.exchange).toBe('Bybit');
  });

  function mockAllTickersOk() {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const u = String(url);
      if (u.includes('binance.com') && u.includes('ticker/price') && u.includes('symbol=')) {
        return { ok: true, status: 200, json: async () => ({ symbol: 'BTCUSDT', price: '65000' }) };
      }
      if (u.includes('binance.com')) {
        return {
          ok: true,
          status: 200,
          json: async () => HOMEPAGE_SYMBOLS.map((s) => ({ symbol: s, price: '100' })),
        };
      }
      if (u.includes('mexc.com')) {
        return {
          ok: true,
          status: 200,
          json: async () => HOMEPAGE_SYMBOLS.map((s) => ({ symbol: s, price: '101' })),
        };
      }
      if (u.includes('bybit.com')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            result: { list: HOMEPAGE_SYMBOLS.map((s) => ({ symbol: s, lastPrice: '102' })) },
          }),
        };
      }
      if (u.includes('okx.com')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: HOMEPAGE_SYMBOLS.map((s) => ({
              instId: s.replace('USDT', '-USDT'),
              last: '103',
            })),
          }),
        };
      }
      if (u.includes('kucoin.com')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: {
              ticker: HOMEPAGE_SYMBOLS.map((s) => ({
                symbol: s.replace('USDT', '-USDT'),
                last: '104',
              })),
            },
          }),
        };
      }
      if (u.includes('gateio.ws')) {
        return {
          ok: true,
          status: 200,
          json: async () =>
            HOMEPAGE_SYMBOLS.map((s) => ({
              currency_pair: s.replace('USDT', '_USDT'),
              last: '105',
            })),
        };
      }
      return { ok: false, status: 500, json: async () => ({}) };
    }));
  }

  it('successful spread snapshot service', async () => {
    mockAllTickersOk();
    const out = await buildSpreadSnapshot({ skipCache: true });
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.data.exchanges.length).toBeGreaterThanOrEqual(2);
      expect(out.data.source).toBe('live_gateway');
      expect(out.data.timestamp).toBeTruthy();
    }
  });

  it('partial exchange failure still succeeds', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const u = String(url);
      if (u.includes('binance.com') && !u.includes('symbol=')) {
        return {
          ok: true,
          status: 200,
          json: async () => HOMEPAGE_SYMBOLS.map((s) => ({ symbol: s, price: '100' })),
        };
      }
      if (u.includes('bybit.com')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            result: { list: HOMEPAGE_SYMBOLS.map((s) => ({ symbol: s, lastPrice: '102' })) },
          }),
        };
      }
      return { ok: false, status: 503, json: async () => ({}) };
    }));
    const out = await buildSpreadSnapshot({ skipCache: true });
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.data.unavailable_exchanges.length).toBeGreaterThan(0);
      expect(out.warnings.length).toBeGreaterThan(0);
    }
  });

  it('total exchange failure', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 503,
      json: async () => ({}),
    })));
    const out = await buildSpreadSnapshot({ skipCache: true });
    expect(out.ok).toBe(false);
  });

  it('cache key / TTL for spread snapshot', async () => {
    mockAllTickersOk();
    const a = await buildSpreadSnapshot();
    const b = await buildSpreadSnapshot();
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) {
      expect(b.cacheHit).toBe(true);
      expect(a.cacheHit).toBe(false);
    }
  });

  it('reference price allowlists', async () => {
    mockAllTickersOk();
    const bad = await buildReferencePrice({ asset: 'DOGECOIN', quote: 'USDT', exchange: 'Binance' });
    expect(bad.ok).toBe(false);
    const badEx = await buildReferencePrice({ asset: 'BTC', quote: 'USDT', exchange: 'Gate' });
    expect(badEx.ok).toBe(false);
    const ok = await buildReferencePrice({ asset: 'BTC', quote: 'USDT', exchange: 'Binance' });
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.data.price).toBe(65000);
      expect(ok.data.source).toBe('live_gateway');
      expect(ok.data.fetched_at).toBeTruthy();
    }
  });

  it('controlled concurrency pool', async () => {
    let peak = 0;
    let current = 0;
    await mapPool([1, 2, 3, 4, 5], 2, async () => {
      current += 1;
      peak = Math.max(peak, current);
      await new Promise((r) => setTimeout(r, 20));
      current -= 1;
      return true;
    });
    expect(peak).toBeLessThanOrEqual(2);
  });
});

describe('HTTP API', () => {
  beforeEach(() => {
    cacheReset();
    resetRateLimits();
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const u = String(url);
      if (u.includes('symbol=BTCUSDT')) {
        return { ok: true, status: 200, json: async () => ({ symbol: 'BTCUSDT', price: '1' }) };
      }
      if (u.includes('binance') || u.includes('mexc') || u.includes('bybit') || u.includes('okx') || u.includes('kucoin') || u.includes('gateio')) {
        // minimal two-exchange success for spread
        if (u.includes('binance') && !u.includes('symbol=')) {
          return {
            ok: true,
            status: 200,
            json: async () => HOMEPAGE_SYMBOLS.map((s) => ({ symbol: s, price: '10' })),
          };
        }
        if (u.includes('bybit')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              result: { list: HOMEPAGE_SYMBOLS.map((s) => ({ symbol: s, lastPrice: '11' })) },
            }),
          };
        }
      }
      return { ok: false, status: 503, json: async () => ({ secret: 'nope' }) };
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

  it('valid spread_snapshot', async () => {
    const { res, state } = mockRes();
    await handleMarketDataRequest(
      { method: 'GET', url: '/api/market-data?operation=spread_snapshot', headers: {} },
      res,
    );
    expect(state.statusCode).toBe(200);
    expect(state.body).toMatchObject({ ok: true });
    expect(state.headers['x-robots-tag']).toContain('noindex');
    expect(JSON.stringify(state.body)).not.toContain('secret');
  });

  it('valid reference_price', async () => {
    const { res, state } = mockRes();
    await handleMarketDataRequest(
      {
        method: 'GET',
        url: '/api/market-data?operation=reference_price&asset=BTC&quote=USDT&exchange=Binance',
        headers: {},
      },
      res,
    );
    expect(state.statusCode).toBe(200);
    expect(state.body).toMatchObject({ ok: true, data: { asset: 'BTC', exchange: 'Binance' } });
  });

  it('unsupported operation / asset / method / proxy params', async () => {
    const a = mockRes();
    await handleMarketDataRequest({ method: 'GET', url: '/api/market-data?operation=hack', headers: {} }, a.res);
    expect(a.state.statusCode).toBe(400);

    const b = mockRes();
    await handleMarketDataRequest(
      { method: 'GET', url: '/api/market-data?operation=reference_price&asset=FAKE', headers: {} },
      b.res,
    );
    expect(b.state.statusCode).toBe(400);

    const c = mockRes();
    await handleMarketDataRequest({ method: 'POST', url: '/api/market-data?operation=spread_snapshot', headers: {} }, c.res);
    expect(c.state.statusCode).toBe(405);

    const d = mockRes();
    await handleMarketDataRequest(
      { method: 'GET', url: '/api/market-data?operation=spread_snapshot&url=https://evil.com', headers: {} },
      d.res,
    );
    expect(d.state.statusCode).toBe(400);
  });
});

describe('browser runtime security contract', () => {
  it('assets/js has no exchange market API domains in fetch URLs', () => {
    const dir = path.resolve('assets/js');
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.js'));
    const banned =
      /https?:\/\/(api\.binance\.com|api\.bybit\.com|api\.mexc\.com|www\.okx\.com\/api|api\.kucoin\.com|api\.gateio\.ws)/i;
    for (const f of files) {
      const text = fs.readFileSync(path.join(dir, f), 'utf8');
      expect(banned.test(text), `${f} must not call exchange market APIs`).toBe(false);
    }
  });

  it('spread-engine uses only internal gateway path', () => {
    const text = fs.readFileSync('assets/js/spread-engine.js', 'utf8');
    expect(text).toContain('/api/market-data?operation=spread_snapshot');
    expect(text).toContain('/api/market-data?operation=reference_price');
    expect(text).not.toMatch(/api\.binance\.com/);
  });
});
