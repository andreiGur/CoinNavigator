/** Homepage market-data gateway allowlists — must match dashboard TARGET_TICKERS / exchanges. */

export const MARKET_DATA_EXCHANGES = [
  'Binance',
  'MEXC',
  'Bybit',
  'OKX',
  'KuCoin',
  'Gate',
] as const;

export type MarketDataExchange = (typeof MARKET_DATA_EXCHANGES)[number];

export const MARKET_DATA_ASSETS = [
  'BTC',
  'ETH',
  'SOL',
  'XRP',
  'TON',
  'DOGE',
  'ADA',
  'BNB',
  'TRX',
  'DOT',
  'LINK',
  'LTC',
  'AVAX',
  'MATIC',
  'SHIB',
  'UNI',
  'XLM',
  'NEAR',
  'ATOM',
  'APT',
] as const;

export type MarketDataAsset = (typeof MARKET_DATA_ASSETS)[number];

export const MARKET_DATA_QUOTE = 'USDT' as const;

export const MARKET_DATA_OPERATIONS = ['spread_snapshot', 'reference_price'] as const;
export type MarketDataOperation = (typeof MARKET_DATA_OPERATIONS)[number];

export const HOMEPAGE_SYMBOLS: readonly string[] = MARKET_DATA_ASSETS.map(
  (a) => `${a}${MARKET_DATA_QUOTE}`,
);

const EXCHANGE_SET = new Set<string>(MARKET_DATA_EXCHANGES);
const ASSET_SET = new Set<string>(MARKET_DATA_ASSETS);

const EXCHANGE_ALIASES: Record<string, MarketDataExchange> = {
  binance: 'Binance',
  bybit: 'Bybit',
  mexc: 'MEXC',
  okx: 'OKX',
  kucoin: 'KuCoin',
  gate: 'Gate',
  'gate.io': 'Gate',
  gateio: 'Gate',
};

export function normalizeMarketExchange(raw: unknown): MarketDataExchange | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  if (EXCHANGE_SET.has(t)) return t as MarketDataExchange;
  return EXCHANGE_ALIASES[t.toLowerCase()] ?? null;
}

export function normalizeMarketAsset(raw: unknown): MarketDataAsset | null {
  if (typeof raw !== 'string') return null;
  let s = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!s) return null;
  if (s.endsWith('USDT') && s.length > 4) s = s.slice(0, -4);
  if (ASSET_SET.has(s)) return s as MarketDataAsset;
  return null;
}

export function toSpotSymbol(asset: MarketDataAsset): string {
  return `${asset}${MARKET_DATA_QUOTE}`;
}

/** TTL (ms) — in-memory, best-effort on Vercel isolates. */
export const SPREAD_SNAPSHOT_TTL_MS = 10_000;
export const REFERENCE_PRICE_TTL_MS = 8_000;
export const ERROR_CACHE_TTL_MS = 2_000;
export const UPSTREAM_TIMEOUT_MS = 6_000;
export const MAX_QUERY_LENGTH = 512;
export const FETCH_CONCURRENCY = 3;
