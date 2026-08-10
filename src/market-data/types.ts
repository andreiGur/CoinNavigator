export type { MarketDataExchange, MarketDataAsset, MarketDataOperation } from './allowlist.js';

export interface TickerPriceMap {
  /** Combined symbol e.g. BTCUSDT → price */
  [symbol: string]: number;
}

export interface ExchangeTickerResult {
  exchange: string;
  prices: TickerPriceMap;
  fetchedAt: string;
  status: 'ok' | 'unavailable';
  reason?: string;
}

export interface SpreadSymbolRow {
  prices: Record<string, number>;
  absolute_diff: number | null;
  spread_percent: number | null;
  best_buy: { exchange: string; price: number } | null;
  best_sell: { exchange: string; price: number } | null;
  binance_price: number | null;
  bybit_price: number | null;
}

/** Matches existing homepage / spread-engine payload contract. */
export interface SpreadSnapshotPayload {
  timestamp: string;
  symbols: Record<string, SpreadSymbolRow>;
  errors: Record<string, Record<string, string>>;
  exchanges: string[];
  source: 'live_gateway';
  warnings: string[];
  unavailable_exchanges: string[];
}

export interface ReferencePriceData {
  asset: string;
  quote: string;
  exchange: string;
  price: number;
  fetched_at: string;
  source: 'live_gateway';
}

export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNSUPPORTED'
  | 'MARKET_DATA_UNAVAILABLE'
  | 'RATE_LIMITED'
  | 'METHOD_NOT_ALLOWED'
  | 'SERVER_ERROR';

export interface ApiErrorBody {
  ok: false;
  error: { code: ApiErrorCode; message: string };
}

export interface SpreadSnapshotSuccess {
  ok: true;
  data: SpreadSnapshotPayload;
  warnings: string[];
  cache_hit?: boolean;
}

export interface ReferencePriceSuccess {
  ok: true;
  data: ReferencePriceData;
  warnings: string[];
  cache_hit?: boolean;
}

export type MarketDataApiResponse =
  | SpreadSnapshotSuccess
  | ReferencePriceSuccess
  | ApiErrorBody;
