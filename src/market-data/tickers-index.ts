import type { MarketDataExchange } from './allowlist.js';
import type { TickerPriceMap } from './types.js';
import {
  fetchBinanceTickers,
  fetchBybitTickers,
  fetchGateTickers,
  fetchKucoinTickers,
  fetchMexcTickers,
  fetchOkxTickers,
} from './tickers.js';

export type TickerFetcher = (symbols: ReadonlySet<string>) => Promise<TickerPriceMap>;

export const TICKER_FETCHERS: Record<MarketDataExchange, TickerFetcher> = {
  Binance: fetchBinanceTickers,
  MEXC: fetchMexcTickers,
  Bybit: fetchBybitTickers,
  OKX: fetchOkxTickers,
  KuCoin: fetchKucoinTickers,
  Gate: fetchGateTickers,
};
