import type { ValidatorAsset, ValidatorExchange } from './types.js';

export const VALIDATOR_EXCHANGES: readonly ValidatorExchange[] = ['Binance', 'Bybit', 'MEXC'] as const;

export const VALIDATOR_ASSETS: readonly ValidatorAsset[] = ['BTC', 'ETH', 'SOL', 'XRP'] as const;

const EXCHANGE_SET = new Set<string>(VALIDATOR_EXCHANGES);
const ASSET_SET = new Set<string>(VALIDATOR_ASSETS);

const EXCHANGE_ALIASES: Record<string, ValidatorExchange> = {
  binance: 'Binance',
  bybit: 'Bybit',
  mexc: 'MEXC',
};

/**
 * Per-exchange spot symbol syntax for ASSET/USDT.
 * USDT-as-asset is intentionally unsupported (no meaningful USDT/USDT market).
 */
export const SYMBOL_MAP: Record<
  ValidatorExchange,
  Record<ValidatorAsset, string>
> = {
  Binance: {
    BTC: 'BTCUSDT',
    ETH: 'ETHUSDT',
    SOL: 'SOLUSDT',
    XRP: 'XRPUSDT',
  },
  Bybit: {
    BTC: 'BTCUSDT',
    ETH: 'ETHUSDT',
    SOL: 'SOLUSDT',
    XRP: 'XRPUSDT',
  },
  MEXC: {
    BTC: 'BTCUSDT',
    ETH: 'ETHUSDT',
    SOL: 'SOLUSDT',
    XRP: 'XRPUSDT',
  },
};

export function normalizeValidatorExchange(raw: unknown): ValidatorExchange | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  if (EXCHANGE_SET.has(t)) return t as ValidatorExchange;
  return EXCHANGE_ALIASES[t.toLowerCase()] ?? null;
}

export function normalizeValidatorAsset(raw: unknown): ValidatorAsset | 'USDT' | null {
  if (typeof raw !== 'string') return null;
  let s = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!s) return null;
  if (s.endsWith('USDT') && s.length > 4) s = s.slice(0, -4);
  if (s === 'USDT') return 'USDT';
  if (ASSET_SET.has(s)) return s as ValidatorAsset;
  return null;
}

export function resolveSymbol(
  exchange: ValidatorExchange,
  asset: ValidatorAsset,
): string {
  return SYMBOL_MAP[exchange][asset];
}

export const MIN_TRADE_USD = 10;
export const MAX_TRADE_USD = 100_000;
export const ORDER_BOOK_LIMIT = 50;
export const UPSTREAM_TIMEOUT_MS = 6_000;
export const RESULT_TTL_SECONDS = 8;
export const STALE_BOOK_MS = 15_000;
