/** Server-side allowlists — do not trust browser-submitted names. */

export const SUPPORTED_EXCHANGES = [
  'Binance',
  'MEXC',
  'Bybit',
  'OKX',
  'KuCoin',
  'Gate',
] as const;

export type SupportedExchange = (typeof SUPPORTED_EXCHANGES)[number];

/** Base assets tracked by CoinNavigator (USDT pairs). */
export const SUPPORTED_ASSETS = [
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

export type SupportedAsset = (typeof SUPPORTED_ASSETS)[number];

const EXCHANGE_SET = new Set<string>(SUPPORTED_EXCHANGES);
const ASSET_SET = new Set<string>(SUPPORTED_ASSETS);

const EXCHANGE_ALIASES: Record<string, SupportedExchange> = {
  gate: 'Gate',
  'gate.io': 'Gate',
  gateio: 'Gate',
  binance: 'Binance',
  mexc: 'MEXC',
  bybit: 'Bybit',
  okx: 'OKX',
  kucoin: 'KuCoin',
};

export function normalizeAsset(raw: unknown): SupportedAsset | null {
  if (typeof raw !== 'string') return null;
  let s = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!s) return null;
  if (s.endsWith('USDT') && s.length > 4) s = s.slice(0, -4);
  if (ASSET_SET.has(s)) return s as SupportedAsset;
  return null;
}

export function normalizeExchange(raw: unknown): SupportedExchange | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (EXCHANGE_SET.has(trimmed)) return trimmed as SupportedExchange;
  const alias = EXCHANGE_ALIASES[trimmed.toLowerCase()];
  return alias ?? null;
}

export function isSupportedExchange(value: string): value is SupportedExchange {
  return EXCHANGE_SET.has(value);
}

export function isSupportedAsset(value: string): value is SupportedAsset {
  return ASSET_SET.has(value);
}
