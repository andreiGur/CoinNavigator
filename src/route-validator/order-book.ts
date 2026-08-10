import Decimal from 'decimal.js';
import type { OrderBookLevel } from './types.js';

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

function d(n: Decimal.Value): Decimal {
  return new Decimal(n);
}

function toNum(x: Decimal): number {
  return x.toNumber();
}

export interface BuySimulationResult {
  fullyFillable: boolean;
  assetQuantity: number;
  quoteSpentUsd: number;
  averageExecutionPrice: number | null;
  bestAsk: number | null;
  estimatedSlippagePct: number | null;
  availableDepthUsd: number;
  unfilledQuoteUsd: number;
  levelsUsed: number;
}

export interface SellSimulationResult {
  fullyFillable: boolean;
  quoteReceivedUsd: number;
  assetSold: number;
  averageExecutionPrice: number | null;
  bestBid: number | null;
  estimatedSlippagePct: number | null;
  availableDepthUsd: number;
  unsoldAssetQty: number;
  levelsUsed: number;
}

function parseLevels(levels: OrderBookLevel[]): { price: Decimal; qty: Decimal }[] {
  const out: { price: Decimal; qty: Decimal }[] = [];
  for (const lvl of levels) {
    const price = d(lvl.price);
    const qty = d(lvl.quantity);
    if (!price.isFinite() || !qty.isFinite() || price.lte(0) || qty.lte(0)) {
      throw new Error('invalid_order_book_level');
    }
    out.push({ price, qty });
  }
  return out;
}

/**
 * Buy: consume asks from lowest price upward until tradeAmountUsd is spent
 * (or book exhausted). Slippage = (avg - bestAsk) / bestAsk * 100.
 */
export function simulateBuyFromAsks(
  asks: OrderBookLevel[],
  tradeAmountUsd: number,
): BuySimulationResult {
  if (!asks.length) throw new Error('empty_asks');
  if (!Number.isFinite(tradeAmountUsd) || tradeAmountUsd <= 0) {
    throw new Error('invalid_trade_amount');
  }

  const levels = parseLevels(asks);
  // Ensure ascending price order
  levels.sort((a, b) => a.price.comparedTo(b.price));

  const bestAsk = levels[0]!.price;
  let remaining = d(tradeAmountUsd);
  let acquired = d(0);
  let spent = d(0);
  let levelsUsed = 0;
  let depth = d(0);

  for (const lvl of levels) {
    depth = depth.plus(lvl.price.mul(lvl.qty));
    if (remaining.lte(0)) continue;
    const levelNotional = lvl.price.mul(lvl.qty);
    const takeNotional = Decimal.min(remaining, levelNotional);
    const takeQty = takeNotional.div(lvl.price);
    acquired = acquired.plus(takeQty);
    spent = spent.plus(takeNotional);
    remaining = remaining.minus(takeNotional);
    levelsUsed += 1;
  }

  const fullyFillable = remaining.lte(0) || remaining.div(tradeAmountUsd).lt(0.0001);
  const avg = acquired.gt(0) ? spent.div(acquired) : null;
  const slip =
    avg && bestAsk.gt(0)
      ? avg.minus(bestAsk).div(bestAsk).mul(100)
      : null;

  return {
    fullyFillable,
    assetQuantity: toNum(acquired.toDecimalPlaces(12)),
    quoteSpentUsd: toNum(spent.toDecimalPlaces(8)),
    averageExecutionPrice: avg ? toNum(avg.toDecimalPlaces(12)) : null,
    bestAsk: toNum(bestAsk),
    estimatedSlippagePct: slip ? toNum(slip.toDecimalPlaces(6)) : null,
    availableDepthUsd: toNum(depth.toDecimalPlaces(2)),
    unfilledQuoteUsd: toNum(Decimal.max(0, remaining).toDecimalPlaces(8)),
    levelsUsed,
  };
}

/**
 * Sell: consume bids from highest price downward until assetQty is sold
 * (or book exhausted). Slippage = (bestBid - avg) / bestBid * 100.
 */
export function simulateSellFromBids(
  bids: OrderBookLevel[],
  assetQty: number,
): SellSimulationResult {
  if (!bids.length) throw new Error('empty_bids');
  if (!Number.isFinite(assetQty) || assetQty <= 0) {
    throw new Error('invalid_asset_qty');
  }

  const levels = parseLevels(bids);
  // Ensure descending price order
  levels.sort((a, b) => b.price.comparedTo(a.price));

  const bestBid = levels[0]!.price;
  let remaining = d(assetQty);
  let sold = d(0);
  let proceeds = d(0);
  let levelsUsed = 0;
  let depth = d(0);

  for (const lvl of levels) {
    depth = depth.plus(lvl.price.mul(lvl.qty));
    if (remaining.lte(0)) continue;
    const takeQty = Decimal.min(remaining, lvl.qty);
    const takeNotional = takeQty.mul(lvl.price);
    sold = sold.plus(takeQty);
    proceeds = proceeds.plus(takeNotional);
    remaining = remaining.minus(takeQty);
    levelsUsed += 1;
  }

  const fullyFillable = remaining.lte(0) || remaining.div(assetQty).lt(0.0001);
  const avg = sold.gt(0) ? proceeds.div(sold) : null;
  const slip =
    avg && bestBid.gt(0)
      ? bestBid.minus(avg).div(bestBid).mul(100)
      : null;

  return {
    fullyFillable,
    quoteReceivedUsd: toNum(proceeds.toDecimalPlaces(8)),
    assetSold: toNum(sold.toDecimalPlaces(12)),
    averageExecutionPrice: avg ? toNum(avg.toDecimalPlaces(12)) : null,
    bestBid: toNum(bestBid),
    estimatedSlippagePct: slip ? toNum(slip.toDecimalPlaces(6)) : null,
    availableDepthUsd: toNum(depth.toDecimalPlaces(2)),
    unsoldAssetQty: toNum(Decimal.max(0, remaining).toDecimalPlaces(12)),
    levelsUsed,
  };
}
