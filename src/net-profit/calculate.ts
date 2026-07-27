import { NET_PROFIT_THRESHOLDS } from './config.js';
import type { NetProfitInput, NetProfitResult, ProfitVerdict } from './types.js';
import { Decimal, d, toNumber, validateNetProfitInput } from './validate.js';

function invalidResult(warnings: string[]): NetProfitResult {
  return {
    purchasedQty: 0,
    sellableQty: 0,
    grossSpreadPct: 0,
    grossProfitUsd: 0,
    buyTradingFeeUsd: 0,
    sellTradingFeeUsd: 0,
    withdrawalCostAsset: 0,
    withdrawalCostUsd: 0,
    networkCostUsd: 0,
    estimatedSlippageCostUsd: 0,
    additionalCostUsd: 0,
    totalEstimatedCostsUsd: 0,
    netProceedsUsd: 0,
    estimatedNetProfitUsd: 0,
    netProfitPct: 0,
    breakEvenSpreadPct: 0,
    verdict: 'invalid',
    warnings,
  };
}

function roundMoney(value: Decimal): number {
  return toNumber(value.toDecimalPlaces(8, Decimal.ROUND_HALF_UP));
}

function roundPct(value: Decimal): number {
  return toNumber(value.toDecimalPlaces(8, Decimal.ROUND_HALF_UP));
}

/**
 * Net profit calculation for a cross-exchange spot arbitrage leg.
 *
 * Cash-flow model (no double-counting):
 *  - investmentUsd = trade notional before fees (USD spent to buy the asset).
 *  - buyTradingFeeUsd is an additional cash outlay on top of investmentUsd.
 *  - withdrawalFeeAsset + networkFeeAsset reduce sellable quantity only.
 *  - Slippage is applied only via effectiveBuyPrice / effectiveSellPrice.
 *  - estimatedNetProfitUsd = netProceeds − investment − buyFee − additional.
 *    It does NOT subtract withdrawalCostUsd, networkCostUsd, or slippageCostUsd again.
 *  - totalEstimatedCostsUsd is a display-only sum of cost categories.
 *
 * Execution order:
 *  1. Validate inputs.
 *  2. Gross spread % / gross profit from raw observed prices.
 *  3. effectiveBuy / effectiveSell from slippage.
 *  4. purchasedQty = investment / effectiveBuy.
 *  5. sellableQty = purchasedQty − withdrawal − network (asset units).
 *  6. Trading fees on investment / sell notional.
 *  7. Report withdrawal/network USD for breakdown (display).
 *  8. Report slippage USD gap for breakdown (display).
 *  9. netProceeds = sellableQty × effectiveSell − sellFee.
 * 10. estimatedNetProfit from cash-flow only (step above).
 * 11. break-even ≈ display totalCosts / investment.
 * 12. Verdict + warnings.
 */
export function calculateNetProfit(input: NetProfitInput): NetProfitResult {
  const issues = validateNetProfitInput(input);
  if (issues.length > 0) {
    return invalidResult(issues.map((i) => i.message));
  }

  const warnings: string[] = [];
  const investment = d(input.investmentUsd);
  const buyPrice = d(input.buyPrice);
  const sellPrice = d(input.sellPrice);
  const buyFeePct = d(input.buyTradingFeePct).div(100);
  const sellFeePct = d(input.sellTradingFeePct).div(100);
  const buySlipPct = d(input.buySlippagePct).div(100);
  const sellSlipPct = d(input.sellSlippagePct).div(100);
  const withdrawalAsset = d(input.withdrawalFeeAsset);
  const networkAsset = d(input.networkFeeAsset ?? 0);
  const additionalUsd = d(input.additionalCostUsd ?? 0);

  if (buyPrice.eq(sellPrice)) {
    warnings.push('Buy and sell prices are identical — gross spread is zero.');
  }

  // 2. Gross (pre-fee, pre-slippage) metrics from observed book prices.
  const grossSpreadPct = sellPrice.minus(buyPrice).div(buyPrice).mul(100);
  const grossProfitUsd = investment.mul(sellPrice.minus(buyPrice)).div(buyPrice);

  // 3. Slippage-adjusted execution prices.
  const effectiveBuyPrice = buyPrice.mul(d(1).plus(buySlipPct));
  const effectiveSellPrice = sellPrice.mul(d(1).minus(sellSlipPct));

  if (effectiveSellPrice.lte(0)) {
    return invalidResult(['Sell slippage reduces effective sell price to zero or below.']);
  }

  // 4–5. Quantity path.
  const purchasedQty = investment.div(effectiveBuyPrice);
  const sellableQty = purchasedQty.minus(withdrawalAsset).minus(networkAsset);

  if (sellableQty.lte(0)) {
    warnings.push(
      'Withdrawal + network fees in asset units meet or exceed the purchased quantity.',
    );
    return {
      ...invalidResult(warnings),
      purchasedQty: roundMoney(purchasedQty),
      sellableQty: 0,
      additionalCostUsd: roundMoney(additionalUsd),
      grossSpreadPct: roundPct(grossSpreadPct),
      grossProfitUsd: roundMoney(grossProfitUsd),
      withdrawalCostAsset: roundMoney(withdrawalAsset),
      withdrawalCostUsd: roundMoney(withdrawalAsset.mul(effectiveSellPrice)),
      networkCostUsd: roundMoney(networkAsset.mul(effectiveSellPrice)),
      verdict: 'invalid',
    };
  }

  // 6–7. Fee line items (USD). Withdrawal/network valued for display only.
  const buyTradingFeeUsd = investment.mul(buyFeePct);
  const sellNotionalUsd = sellableQty.mul(effectiveSellPrice);
  const sellTradingFeeUsd = sellNotionalUsd.mul(sellFeePct);
  const withdrawalCostUsd = withdrawalAsset.mul(effectiveSellPrice);
  const networkCostUsd = networkAsset.mul(effectiveSellPrice);

  // 8. Slippage cost for display only (already embedded in effective prices / qty).
  const idealQty = investment.div(buyPrice);
  const idealSellable = Decimal.max(idealQty.minus(withdrawalAsset).minus(networkAsset), 0);
  const idealProceeds = idealSellable.mul(sellPrice);
  const slippedProceeds = sellableQty.mul(effectiveSellPrice);
  const estimatedSlippageCostUsd = Decimal.max(idealProceeds.minus(slippedProceeds), 0);

  // Display-only cost rollup — must not be re-subtracted from net profit.
  const totalEstimatedCostsUsd = buyTradingFeeUsd
    .plus(sellTradingFeeUsd)
    .plus(withdrawalCostUsd)
    .plus(networkCostUsd)
    .plus(estimatedSlippageCostUsd)
    .plus(additionalUsd);

  // 9–10. Cash outcome (single subtraction path).
  const netProceedsUsd = sellNotionalUsd.minus(sellTradingFeeUsd);
  const estimatedNetProfitUsd = netProceedsUsd
    .minus(investment)
    .minus(buyTradingFeeUsd)
    .minus(additionalUsd);
  const netProfitPct = estimatedNetProfitUsd.div(investment).mul(100);

  // 11. Break-even raw spread % needed to cover estimated costs on this size.
  const breakEvenSpreadPct = totalEstimatedCostsUsd.div(investment).mul(100);

  // Warnings
  if (grossProfitUsd.gt(0) && totalEstimatedCostsUsd.div(grossProfitUsd).gte(NET_PROFIT_THRESHOLDS.costDominanceRatio)) {
    warnings.push(
      `Estimated costs consume ≥ ${NET_PROFIT_THRESHOLDS.costDominanceRatio * 100}% of gross spread profit.`,
    );
  }
  if (estimatedSlippageCostUsd.gte(grossProfitUsd) && grossProfitUsd.gt(0)) {
    warnings.push('Estimated slippage alone consumes the full gross spread profit.');
  }
  if (input.buyExchange === input.sellExchange) {
    warnings.push('Buy and sell exchanges are the same — this is not a cross-exchange arb.');
  }

  // 12. Verdict
  let verdict: ProfitVerdict;
  if (estimatedNetProfitUsd.lte(0)) {
    verdict = 'not_profitable';
  } else if (
    estimatedNetProfitUsd.lt(NET_PROFIT_THRESHOLDS.marginalProfitUsd) ||
    netProfitPct.lt(NET_PROFIT_THRESHOLDS.marginalProfitPct)
  ) {
    verdict = 'marginal';
    warnings.push(
      `Net profit is below the safety threshold ($${NET_PROFIT_THRESHOLDS.marginalProfitUsd} or ${NET_PROFIT_THRESHOLDS.marginalProfitPct}%).`,
    );
  } else {
    verdict = 'profitable';
  }

  return {
    purchasedQty: roundMoney(purchasedQty),
    sellableQty: roundMoney(sellableQty),
    grossSpreadPct: roundPct(grossSpreadPct),
    grossProfitUsd: roundMoney(grossProfitUsd),
    buyTradingFeeUsd: roundMoney(buyTradingFeeUsd),
    sellTradingFeeUsd: roundMoney(sellTradingFeeUsd),
    withdrawalCostAsset: roundMoney(withdrawalAsset),
    withdrawalCostUsd: roundMoney(withdrawalCostUsd),
    networkCostUsd: roundMoney(networkCostUsd),
    estimatedSlippageCostUsd: roundMoney(estimatedSlippageCostUsd),
    additionalCostUsd: roundMoney(additionalUsd),
    totalEstimatedCostsUsd: roundMoney(totalEstimatedCostsUsd),
    netProceedsUsd: roundMoney(netProceedsUsd),
    estimatedNetProfitUsd: roundMoney(estimatedNetProfitUsd),
    netProfitPct: roundPct(netProfitPct),
    breakEvenSpreadPct: roundPct(breakEvenSpreadPct),
    verdict,
    warnings,
  };
}
