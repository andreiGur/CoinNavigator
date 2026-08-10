import { ORDER_BOOK_LIMIT, UPSTREAM_TIMEOUT_MS } from '../symbols.js';
import type { NormalizedOrderBook, OrderBookLevel, ValidatorExchange } from '../types.js';

export class UpstreamError extends Error {
  constructor(
    message: string,
    readonly category: 'timeout' | 'rate_limit' | 'http' | 'malformed' | 'unsupported' | 'unavailable',
  ) {
    super(message);
    this.name = 'UpstreamError';
  }
}

const DEFAULT_HEADERS: Record<string, string> = {
  Accept: 'application/json',
  // Some exchanges block blank / serverless default UAs.
  'User-Agent': 'CoinNavigator/1.0 (+https://coinnavigator.net)',
};

export async function fetchJson(
  url: string,
  opts: { timeoutMs?: number; headers?: Record<string, string> } = {},
): Promise<unknown> {
  const timeoutMs = opts.timeoutMs ?? UPSTREAM_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        ...DEFAULT_HEADERS,
        ...(opts.headers ?? {}),
      },
      signal: controller.signal,
    });
    if (res.status === 429) {
      throw new UpstreamError('rate_limited', 'rate_limit');
    }
    if (!res.ok) {
      throw new UpstreamError(`http_${res.status}`, 'http');
    }
    return await res.json();
  } catch (err) {
    if (err instanceof UpstreamError) throw err;
    if (err instanceof Error && err.name === 'AbortError') {
      throw new UpstreamError('timeout', 'timeout');
    }
    throw new UpstreamError('unavailable', 'unavailable');
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Try public host mirrors in order (e.g. Binance / Bybit geo blocks on cloud IPs).
 * Returns the first successful JSON body.
 */
export async function fetchJsonWithFallbacks(
  urls: readonly string[],
  opts: { timeoutMs?: number; headers?: Record<string, string> } = {},
): Promise<unknown> {
  if (!urls.length) throw new UpstreamError('no_urls', 'unavailable');
  let last: UpstreamError | null = null;
  for (const url of urls) {
    try {
      return await fetchJson(url, opts);
    } catch (err) {
      if (err instanceof UpstreamError) {
        last = err;
        continue;
      }
      last = new UpstreamError('unavailable', 'unavailable');
    }
  }
  throw last ?? new UpstreamError('unavailable', 'unavailable');
}

export function normalizeLevels(raw: unknown): OrderBookLevel[] {
  if (!Array.isArray(raw)) throw new UpstreamError('malformed_levels', 'malformed');
  const out: OrderBookLevel[] = [];
  for (const row of raw) {
    if (!Array.isArray(row) || row.length < 2) {
      throw new UpstreamError('malformed_level', 'malformed');
    }
    const price = String(row[0]);
    const quantity = String(row[1]);
    if (!price || !quantity) throw new UpstreamError('malformed_level', 'malformed');
    out.push({ price, quantity });
  }
  return out.slice(0, ORDER_BOOK_LIMIT);
}

export interface ExchangeAdapter {
  exchange: ValidatorExchange;
  fetchOrderBook(symbol: string): Promise<NormalizedOrderBook>;
  /**
   * Optional public transfer metadata. Return null when not reliably available.
   */
  fetchTransferMeta?(
    asset: string,
  ): Promise<{
    networks: Array<{
      network: string;
      depositEnable: boolean | null;
      withdrawEnable: boolean | null;
      withdrawFee: number | null;
      minWithdraw: number | null;
      confirmations: number | null;
    }>;
    fetchedAt: string;
    sourceUrl: string;
  } | null>;
}
