import type { SpreadSnapshotPayload, SpreadSymbolRow, TickerPriceMap } from './types.js';

/**
 * Pure deterministic transform — mirrors assets/js/spread-engine.js
 * computeSpreadPayloadFromExchangePrices.
 */
export function computeSpreadPayloadFromExchangePrices(
  exchangeSnapshots: Record<string, TickerPriceMap>,
  targetSymbols: readonly string[],
  opts: {
    unavailableExchanges?: string[];
    warnings?: string[];
    now?: () => Date;
  } = {},
): SpreadSnapshotPayload {
  const exchanges = Object.keys(exchangeSnapshots || {});
  const symbolsData: Record<string, SpreadSymbolRow> = {};
  const errors: Record<string, Record<string, string>> = {};

  for (const symbol of targetSymbols) {
    const prices: Record<string, number> = {};
    const symErrors: Record<string, string> = {};

    for (const ex of exchanges) {
      const priceMap = exchangeSnapshots[ex] || {};
      const v = priceMap[symbol];
      if (typeof v === 'number' && Number.isFinite(v) && v > 0) {
        prices[ex] = v;
      } else {
        symErrors[ex] = 'no_live_price';
      }
    }

    let best_buy: SpreadSymbolRow['best_buy'] = null;
    let best_sell: SpreadSymbolRow['best_sell'] = null;
    let absolute_diff: number | null = null;
    let spread_percent: number | null = null;

    const values = Object.values(prices);
    if (values.length > 0) {
      const minPrice = Math.min(...values);
      const maxPrice = Math.max(...values);
      const bestBuyEx = Object.keys(prices).find((k) => prices[k] === minPrice) || null;
      const bestSellEx = Object.keys(prices).find((k) => prices[k] === maxPrice) || null;
      if (bestBuyEx && bestSellEx) {
        best_buy = { exchange: bestBuyEx, price: minPrice };
        best_sell = { exchange: bestSellEx, price: maxPrice };
        absolute_diff = +(maxPrice - minPrice).toFixed(2);
        spread_percent = minPrice > 0 ? +(((maxPrice - minPrice) / minPrice).toFixed(8)) : null;
      }
    }

    symbolsData[symbol] = {
      prices,
      absolute_diff,
      spread_percent,
      best_buy,
      best_sell,
      binance_price: prices.Binance ?? null,
      bybit_price: prices.Bybit ?? null,
    };
    if (Object.keys(symErrors).length) errors[symbol] = symErrors;
  }

  const now = (opts.now ?? (() => new Date()))();
  return {
    timestamp: now.toISOString(),
    symbols: symbolsData,
    errors,
    exchanges,
    source: 'live_gateway',
    warnings: opts.warnings ?? [],
    unavailable_exchanges: opts.unavailableExchanges ?? [],
  };
}
