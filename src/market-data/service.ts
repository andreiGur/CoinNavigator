import {
  ERROR_CACHE_TTL_MS,
  FETCH_CONCURRENCY,
  HOMEPAGE_SYMBOLS,
  MARKET_DATA_EXCHANGES,
  REFERENCE_PRICE_TTL_MS,
  SPREAD_SNAPSHOT_TTL_MS,
  normalizeMarketAsset,
  normalizeMarketExchange,
  toSpotSymbol,
  type MarketDataExchange,
} from './allowlist.js';
import { cacheGet, cacheSet } from './cache.js';
import { mapPool } from './concurrency.js';
import { computeSpreadPayloadFromExchangePrices } from './spread.js';
import { fetchBinanceReferencePrice, fetchMexcReferencePrice } from './tickers.js';
import { TICKER_FETCHERS } from './tickers-index.js';
import type {
  ReferencePriceData,
  SpreadSnapshotPayload,
  TickerPriceMap,
} from './types.js';
import { UpstreamError } from './upstream.js';

export type ServiceOk<T> = { ok: true; data: T; warnings: string[]; cacheHit: boolean };
export type ServiceFail = {
  ok: false;
  category: 'validation' | 'unsupported' | 'unavailable' | 'server_error';
  reason: string;
};

async function fetchOneExchange(
  exchange: MarketDataExchange,
  symbols: ReadonlySet<string>,
): Promise<{ exchange: MarketDataExchange; prices: TickerPriceMap | null; reason?: string }> {
  try {
    const prices = await TICKER_FETCHERS[exchange](symbols);
    if (!prices || Object.keys(prices).length === 0) {
      return { exchange, prices: null, reason: 'empty' };
    }
    return { exchange, prices };
  } catch (err) {
    const reason =
      err instanceof UpstreamError ? err.category : 'unavailable';
    return { exchange, prices: null, reason };
  }
}

export async function buildSpreadSnapshot(
  opts: { skipCache?: boolean; now?: () => Date } = {},
): Promise<ServiceOk<SpreadSnapshotPayload> | ServiceFail> {
  const cacheKey = 'op=spread_snapshot';
  if (!opts.skipCache) {
    const hit = cacheGet<SpreadSnapshotPayload>(cacheKey);
    if (hit) {
      return { ok: true, data: hit, warnings: hit.warnings ?? [], cacheHit: true };
    }
  }

  const symbolSet = new Set(HOMEPAGE_SYMBOLS);
  const settled = await mapPool(
    MARKET_DATA_EXCHANGES,
    FETCH_CONCURRENCY,
    (ex) => fetchOneExchange(ex, symbolSet),
  );

  const snapshots: Record<string, TickerPriceMap> = {};
  const unavailable: string[] = [];
  const warnings: string[] = [];

  for (const row of settled) {
    if (row.prices) {
      snapshots[row.exchange] = row.prices;
    } else {
      unavailable.push(row.exchange);
      warnings.push(`${row.exchange} unavailable (${row.reason || 'error'})`);
    }
  }

  if (Object.keys(snapshots).length < 2) {
    cacheSet(cacheKey + ':fail', { failed: true }, ERROR_CACHE_TTL_MS);
    return { ok: false, category: 'unavailable', reason: 'insufficient_exchanges' };
  }

  const payload = computeSpreadPayloadFromExchangePrices(snapshots, HOMEPAGE_SYMBOLS, {
    unavailableExchanges: unavailable,
    warnings,
    ...(opts.now ? { now: opts.now } : {}),
  });

  cacheSet(cacheKey, payload, SPREAD_SNAPSHOT_TTL_MS);
  return { ok: true, data: payload, warnings, cacheHit: false };
}

export async function buildReferencePrice(
  raw: { asset?: unknown; quote?: unknown; exchange?: unknown },
  opts: { skipCache?: boolean } = {},
): Promise<ServiceOk<ReferencePriceData> | ServiceFail> {
  const asset = normalizeMarketAsset(raw.asset);
  if (!asset) return { ok: false, category: 'unsupported', reason: 'unsupported_asset' };

  const quote =
    typeof raw.quote === 'string' && raw.quote.trim()
      ? raw.quote.trim().toUpperCase()
      : 'USDT';
  if (quote !== 'USDT') return { ok: false, category: 'unsupported', reason: 'unsupported_quote' };

  const requested = normalizeMarketExchange(raw.exchange ?? 'Binance');
  if (!requested) return { ok: false, category: 'unsupported', reason: 'unsupported_exchange' };
  if (requested !== 'Binance' && requested !== 'MEXC') {
    return { ok: false, category: 'unsupported', reason: 'reference_exchange_unsupported' };
  }

  const symbol = toSpotSymbol(asset);
  const cacheKey = `op=reference_price&ex=${requested}&sym=${symbol}`;
  if (!opts.skipCache) {
    const hit = cacheGet<ReferencePriceData>(cacheKey);
    if (hit) return { ok: true, data: hit, warnings: [], cacheHit: true };
  }

  const warnings: string[] = [];
  let price: number | null = null;
  let usedExchange: 'Binance' | 'MEXC' = requested === 'MEXC' ? 'MEXC' : 'Binance';

  if (requested === 'Binance') {
    try {
      price = await fetchBinanceReferencePrice(symbol);
      usedExchange = 'Binance';
    } catch {
      try {
        price = await fetchMexcReferencePrice(symbol);
        usedExchange = 'MEXC';
        warnings.push(
          'Binance reference price unavailable from this runtime; used MEXC public ticker instead.',
        );
      } catch {
        price = null;
      }
    }
  } else {
    try {
      price = await fetchMexcReferencePrice(symbol);
      usedExchange = 'MEXC';
    } catch {
      price = null;
    }
  }

  if (price == null) {
    cacheSet(cacheKey + ':fail', { failed: true }, ERROR_CACHE_TTL_MS);
    return { ok: false, category: 'unavailable', reason: 'upstream_failed' };
  }

  const data: ReferencePriceData = {
    asset,
    quote: 'USDT',
    exchange: usedExchange,
    price,
    fetched_at: new Date().toISOString(),
    source: 'live_gateway',
  };
  cacheSet(cacheKey, data, REFERENCE_PRICE_TTL_MS);
  return { ok: true, data, warnings, cacheHit: false };
}
