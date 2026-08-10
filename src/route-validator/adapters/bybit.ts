import type { ExchangeAdapter } from './base.js';
import { fetchJsonWithFallbacks, normalizeLevels, UpstreamError } from './base.js';
import { BYBIT_API_HOSTS } from './hosts.js';
import type { NormalizedOrderBook } from '../types.js';
import { ORDER_BOOK_LIMIT } from '../symbols.js';

export const bybitAdapter: ExchangeAdapter = {
  exchange: 'Bybit',

  async fetchOrderBook(symbol: string): Promise<NormalizedOrderBook> {
    const path =
      `/v5/market/orderbook?category=spot&symbol=${encodeURIComponent(symbol)}` +
      `&limit=${ORDER_BOOK_LIMIT}`;
    const json = await fetchJsonWithFallbacks(BYBIT_API_HOSTS.map((h) => h + path));
    if (!json || typeof json !== 'object') throw new UpstreamError('malformed', 'malformed');
    const body = json as {
      retCode?: number;
      result?: { b?: unknown; a?: unknown; ts?: number | string };
    };
    if (body.retCode !== 0 || !body.result) {
      throw new UpstreamError('bybit_error', 'unavailable');
    }
    const bids = normalizeLevels(body.result.b);
    const asks = normalizeLevels(body.result.a);
    if (!bids.length || !asks.length) throw new UpstreamError('empty_book', 'malformed');
    const ts = body.result.ts != null ? Number(body.result.ts) : null;
    return {
      exchange: 'Bybit',
      symbol,
      bids,
      asks,
      exchangeTimestampMs: Number.isFinite(ts) ? ts : null,
      fetchedAt: new Date().toISOString(),
    };
  },

  async fetchTransferMeta() {
    return null;
  },
};
