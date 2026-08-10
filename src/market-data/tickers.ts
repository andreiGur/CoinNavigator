import { UpstreamError, fetchJson } from './upstream.js';
import type { TickerPriceMap } from './types.js';

function filterMap(
  symbols: ReadonlySet<string>,
  rows: Array<{ symbol: string; price: number }>,
): TickerPriceMap {
  const map: TickerPriceMap = {};
  for (const row of rows) {
    if (!symbols.has(row.symbol)) continue;
    if (!Number.isFinite(row.price) || row.price <= 0) continue;
    map[row.symbol] = row.price;
  }
  return map;
}

export async function fetchBinanceTickers(
  symbols: ReadonlySet<string>,
): Promise<TickerPriceMap> {
  const json = await fetchJson('https://api.binance.com/api/v3/ticker/price');
  if (!Array.isArray(json)) throw new UpstreamError('malformed', 'malformed');
  const rows: Array<{ symbol: string; price: number }> = [];
  for (const row of json) {
    if (!row || typeof row !== 'object') continue;
    const r = row as { symbol?: unknown; price?: unknown };
    if (typeof r.symbol !== 'string') continue;
    const p = parseFloat(String(r.price));
    rows.push({ symbol: r.symbol, price: p });
  }
  return filterMap(symbols, rows);
}

export async function fetchMexcTickers(
  symbols: ReadonlySet<string>,
): Promise<TickerPriceMap> {
  const json = await fetchJson('https://api.mexc.com/api/v3/ticker/price');
  if (!Array.isArray(json)) throw new UpstreamError('malformed', 'malformed');
  const rows: Array<{ symbol: string; price: number }> = [];
  for (const row of json) {
    if (!row || typeof row !== 'object') continue;
    const r = row as { symbol?: unknown; price?: unknown };
    if (typeof r.symbol !== 'string') continue;
    rows.push({ symbol: r.symbol, price: parseFloat(String(r.price)) });
  }
  return filterMap(symbols, rows);
}

export async function fetchBybitTickers(
  symbols: ReadonlySet<string>,
): Promise<TickerPriceMap> {
  const json = await fetchJson('https://api.bybit.com/v5/market/tickers?category=spot');
  if (!json || typeof json !== 'object') throw new UpstreamError('malformed', 'malformed');
  const body = json as { result?: { list?: unknown } };
  const list = Array.isArray(body.result?.list) ? body.result!.list! : [];
  const rows: Array<{ symbol: string; price: number }> = [];
  for (const row of list) {
    if (!row || typeof row !== 'object') continue;
    const r = row as { symbol?: unknown; lastPrice?: unknown };
    if (typeof r.symbol !== 'string') continue;
    rows.push({ symbol: r.symbol, price: parseFloat(String(r.lastPrice)) });
  }
  return filterMap(symbols, rows);
}

export async function fetchOkxTickers(
  symbols: ReadonlySet<string>,
): Promise<TickerPriceMap> {
  const json = await fetchJson('https://www.okx.com/api/v5/market/tickers?instType=SPOT');
  if (!json || typeof json !== 'object') throw new UpstreamError('malformed', 'malformed');
  const body = json as { data?: unknown };
  const list = Array.isArray(body.data) ? body.data : [];
  const rows: Array<{ symbol: string; price: number }> = [];
  for (const row of list) {
    if (!row || typeof row !== 'object') continue;
    const r = row as { instId?: unknown; last?: unknown };
    if (typeof r.instId !== 'string' || !r.instId.endsWith('-USDT')) continue;
    const symbol = r.instId.replace('-', '');
    rows.push({ symbol, price: parseFloat(String(r.last)) });
  }
  return filterMap(symbols, rows);
}

export async function fetchKucoinTickers(
  symbols: ReadonlySet<string>,
): Promise<TickerPriceMap> {
  const json = await fetchJson('https://api.kucoin.com/api/v1/market/allTickers');
  if (!json || typeof json !== 'object') throw new UpstreamError('malformed', 'malformed');
  const body = json as { data?: { ticker?: unknown } };
  const list = Array.isArray(body.data?.ticker) ? body.data!.ticker! : [];
  const rows: Array<{ symbol: string; price: number }> = [];
  for (const row of list) {
    if (!row || typeof row !== 'object') continue;
    const r = row as { symbol?: unknown; last?: unknown };
    if (typeof r.symbol !== 'string' || !r.symbol.endsWith('-USDT')) continue;
    const symbol = r.symbol.replace('-', '');
    rows.push({ symbol, price: parseFloat(String(r.last)) });
  }
  return filterMap(symbols, rows);
}

export async function fetchGateTickers(
  symbols: ReadonlySet<string>,
): Promise<TickerPriceMap> {
  const json = await fetchJson('https://api.gateio.ws/api/v4/spot/tickers');
  if (!Array.isArray(json)) throw new UpstreamError('malformed', 'malformed');
  const rows: Array<{ symbol: string; price: number }> = [];
  for (const row of json) {
    if (!row || typeof row !== 'object') continue;
    const r = row as { currency_pair?: unknown; last?: unknown };
    if (typeof r.currency_pair !== 'string' || !r.currency_pair.endsWith('_USDT')) continue;
    const symbol = r.currency_pair.replace('_', '');
    rows.push({ symbol, price: parseFloat(String(r.last)) });
  }
  return filterMap(symbols, rows);
}

export async function fetchBinanceReferencePrice(symbol: string): Promise<number> {
  const url = `https://api.binance.com/api/v3/ticker/price?symbol=${encodeURIComponent(symbol)}`;
  const json = await fetchJson(url);
  if (!json || typeof json !== 'object') throw new UpstreamError('malformed', 'malformed');
  const body = json as { symbol?: unknown; price?: unknown };
  const p = parseFloat(String(body.price));
  if (!Number.isFinite(p) || p <= 0) throw new UpstreamError('malformed_price', 'malformed');
  return p;
}
