import type { ExchangeAdapter } from './base.js';
import { fetchJson, normalizeLevels, UpstreamError } from './base.js';
import type { NormalizedOrderBook } from '../types.js';
import { ORDER_BOOK_LIMIT } from '../symbols.js';

export const mexcAdapter: ExchangeAdapter = {
  exchange: 'MEXC',

  async fetchOrderBook(symbol: string): Promise<NormalizedOrderBook> {
    const url = `https://api.mexc.com/api/v3/depth?symbol=${encodeURIComponent(symbol)}&limit=${ORDER_BOOK_LIMIT}`;
    const json = await fetchJson(url);
    if (!json || typeof json !== 'object') throw new UpstreamError('malformed', 'malformed');
    const body = json as { bids?: unknown; asks?: unknown; timestamp?: number };
    const bids = normalizeLevels(body.bids);
    const asks = normalizeLevels(body.asks);
    if (!bids.length || !asks.length) throw new UpstreamError('empty_book', 'malformed');
    const ts = body.timestamp != null ? Number(body.timestamp) : null;
    return {
      exchange: 'MEXC',
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
