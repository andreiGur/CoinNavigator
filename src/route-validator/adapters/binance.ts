import type { ExchangeAdapter } from './base.js';
import { fetchJsonWithFallbacks, normalizeLevels, UpstreamError } from './base.js';
import { BINANCE_API_HOSTS } from './hosts.js';
import type { NormalizedOrderBook } from '../types.js';
import { ORDER_BOOK_LIMIT } from '../symbols.js';

export const binanceAdapter: ExchangeAdapter = {
  exchange: 'Binance',

  async fetchOrderBook(symbol: string): Promise<NormalizedOrderBook> {
    const path = `/api/v3/depth?symbol=${encodeURIComponent(symbol)}&limit=${ORDER_BOOK_LIMIT}`;
    const json = await fetchJsonWithFallbacks(BINANCE_API_HOSTS.map((h) => h + path));
    if (!json || typeof json !== 'object') throw new UpstreamError('malformed', 'malformed');
    const body = json as { bids?: unknown; asks?: unknown; lastUpdateId?: number };
    const bids = normalizeLevels(body.bids);
    const asks = normalizeLevels(body.asks);
    if (!bids.length || !asks.length) throw new UpstreamError('empty_book', 'malformed');
    return {
      exchange: 'Binance',
      symbol,
      bids,
      asks,
      exchangeTimestampMs: null,
      fetchedAt: new Date().toISOString(),
    };
  },

  // Binance capital config requires API key — not available for this MVP.
  async fetchTransferMeta() {
    return null;
  },
};
