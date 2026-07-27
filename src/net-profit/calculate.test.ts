import { describe, expect, it } from 'vitest';
import { calculateNetProfit } from './calculate.js';
import {
  EXCHANGE_FEE_ESTIMATES,
  NET_PROFIT_THRESHOLDS,
  getEstimatedTakerFeePct,
  getExchangeFeeEstimate,
} from './config.js';
import { bucketAmountUsd } from './buckets.js';
import { formatUsd, verdictLabel } from './format.js';
import type { NetProfitInput } from './types.js';

function baseInput(overrides: Partial<NetProfitInput> = {}): NetProfitInput {
  return {
    investmentUsd: 1000,
    buyExchange: 'Binance',
    sellExchange: 'MEXC',
    assetSymbol: 'BTC',
    buyPrice: 100,
    sellPrice: 101,
    buyTradingFeePct: 0.1,
    sellTradingFeePct: 0.1,
    withdrawalFeeAsset: 0,
    buySlippagePct: 0,
    sellSlippagePct: 0,
    ...overrides,
  };
}

describe('calculateNetProfit', () => {
  it('1. clearly profitable opportunity', () => {
    // 1% gross spread, 0.1%+0.1% fees, no withdrawal/slippage
    const result = calculateNetProfit(baseInput());
    expect(result.verdict).toBe('profitable');
    expect(result.grossSpreadPct).toBeCloseTo(1, 6);
    expect(result.grossProfitUsd).toBeCloseTo(10, 6);
    expect(result.estimatedNetProfitUsd).toBeGreaterThan(NET_PROFIT_THRESHOLDS.marginalProfitUsd);
    expect(result.purchasedQty).toBeCloseTo(10, 6);
    expect(result.buyTradingFeeUsd).toBeCloseTo(1, 6);
    expect(result.warnings.some((w) => /identical/i.test(w))).toBe(false);
  });

  it('2. raw spread becomes unprofitable after fees', () => {
    // 0.15% spread vs 0.20% round-trip fees
    const result = calculateNetProfit(
      baseInput({
        buyPrice: 100,
        sellPrice: 100.15,
        buyTradingFeePct: 0.1,
        sellTradingFeePct: 0.1,
      }),
    );
    expect(result.grossSpreadPct).toBeCloseTo(0.15, 6);
    expect(result.grossProfitUsd).toBeGreaterThan(0);
    expect(result.estimatedNetProfitUsd).toBeLessThan(0);
    expect(result.verdict).toBe('not_profitable');
  });

  it('3. marginal opportunity (positive but below safety threshold)', () => {
    // Tiny positive net (~$0.50 on $1000)
    const result = calculateNetProfit(
      baseInput({
        buyPrice: 100,
        sellPrice: 100.25,
        buyTradingFeePct: 0.1,
        sellTradingFeePct: 0.1,
      }),
    );
    expect(result.estimatedNetProfitUsd).toBeGreaterThan(0);
    expect(result.estimatedNetProfitUsd).toBeLessThan(NET_PROFIT_THRESHOLDS.marginalProfitUsd);
    expect(result.verdict).toBe('marginal');
    expect(result.warnings.some((w) => /safety threshold/i.test(w))).toBe(true);
  });

  it('4. withdrawal fee larger than purchased quantity → invalid', () => {
    const result = calculateNetProfit(
      baseInput({
        investmentUsd: 100,
        buyPrice: 50,
        sellPrice: 55,
        withdrawalFeeAsset: 3, // purchased qty = 2
      }),
    );
    expect(result.verdict).toBe('invalid');
    expect(result.purchasedQty).toBeCloseTo(2, 6);
    expect(result.warnings.some((w) => /Withdrawal \+ network fees/i.test(w))).toBe(true);
  });

  it('5. zero investment amount → invalid', () => {
    const result = calculateNetProfit(baseInput({ investmentUsd: 0 }));
    expect(result.verdict).toBe('invalid');
    expect(result.warnings.some((w) => /investmentUsd/i.test(w))).toBe(true);
  });

  it('6. negative prices → invalid', () => {
    const result = calculateNetProfit(baseInput({ buyPrice: -10, sellPrice: 12 }));
    expect(result.verdict).toBe('invalid');
    expect(result.warnings.some((w) => /buyPrice/i.test(w))).toBe(true);
  });

  it('7. identical buy and sell prices', () => {
    const result = calculateNetProfit(baseInput({ buyPrice: 50, sellPrice: 50 }));
    expect(result.grossSpreadPct).toBe(0);
    expect(result.grossProfitUsd).toBe(0);
    expect(result.verdict).toBe('not_profitable');
    expect(result.warnings.some((w) => /identical/i.test(w))).toBe(true);
  });

  it('8. slippage consuming the full spread', () => {
    // 0.5% gross, 0.3% buy slip + 0.3% sell slip eats it (plus fees)
    const result = calculateNetProfit(
      baseInput({
        buyPrice: 100,
        sellPrice: 100.5,
        buyTradingFeePct: 0,
        sellTradingFeePct: 0,
        buySlippagePct: 0.3,
        sellSlippagePct: 0.3,
      }),
    );
    expect(result.estimatedSlippageCostUsd).toBeGreaterThan(0);
    expect(result.estimatedNetProfitUsd).toBeLessThanOrEqual(0);
    expect(result.verdict).toBe('not_profitable');
    expect(
      result.warnings.some((w) => /slippage alone consumes/i.test(w)) ||
        result.estimatedNetProfitUsd <= 0,
    ).toBe(true);
  });

  it('9. missing optional fees default to zero', () => {
    const withOpts = calculateNetProfit(
      baseInput({ networkFeeAsset: 0, additionalCostUsd: 0 }),
    );
    const withoutOpts = calculateNetProfit(baseInput());
    expect(withoutOpts.networkCostUsd).toBe(0);
    expect(withoutOpts.estimatedNetProfitUsd).toBe(withOpts.estimatedNetProfitUsd);
    expect(withoutOpts.verdict).toBe(withOpts.verdict);
  });

  it('10. very small and very large investment amounts', () => {
    const tiny = calculateNetProfit(baseInput({ investmentUsd: 1 }));
    const huge = calculateNetProfit(baseInput({ investmentUsd: 1_000_000 }));
    expect(tiny.verdict).not.toBe('invalid');
    expect(huge.verdict).toBe('profitable');
    expect(huge.estimatedNetProfitUsd).toBeGreaterThan(tiny.estimatedNetProfitUsd);
    // Linear scaling of net (no fixed withdrawal): 1e6 / 1 = 1e6
    expect(huge.estimatedNetProfitUsd / tiny.estimatedNetProfitUsd).toBeCloseTo(1_000_000, 0);
  });

  it('11. decimal precision behavior (no float drift on simple ratios)', () => {
    const result = calculateNetProfit(
      baseInput({
        investmentUsd: 0.3,
        buyPrice: 0.1,
        sellPrice: 0.2,
        buyTradingFeePct: 0,
        sellTradingFeePct: 0,
      }),
    );
    // qty = 0.3/0.1 = 3; proceeds = 3*0.2 = 0.6; net = 0.6-0.3 = 0.3
    expect(result.purchasedQty).toBeCloseTo(3, 10);
    expect(result.estimatedNetProfitUsd).toBeCloseTo(0.3, 10);
    expect(result.grossProfitUsd).toBeCloseTo(0.3, 10);
  });

  it('12. deterministic output for identical input', () => {
    const a = calculateNetProfit(baseInput());
    const b = calculateNetProfit(baseInput());
    expect(a).toEqual(b);
  });
});

describe('exchange fee configuration', () => {
  it('covers all CoinNavigator display exchanges and marks them estimated', () => {
    const ids = ['Binance', 'MEXC', 'Bybit', 'OKX', 'KuCoin', 'Gate'] as const;
    for (const id of ids) {
      const row = getExchangeFeeEstimate(id);
      expect(row).toBeDefined();
      expect(row?.isEstimated).toBe(true);
      expect(row?.estimatedSpotTakerFeePct).toBeGreaterThanOrEqual(0);
      expect(EXCHANGE_FEE_ESTIMATES[id].id).toBe(id);
    }
  });

  it('does not invent a fee for unknown exchanges', () => {
    expect(getExchangeFeeEstimate('FakeEx')).toBeUndefined();
    expect(getEstimatedTakerFeePct('FakeEx')).toBeNull();
  });
});

describe('cash-flow semantics (no double-counting)', () => {
  it('raw profitable spread becomes unprofitable after withdrawal fees', () => {
    const noWd = calculateNetProfit(
      baseInput({
        buyPrice: 100,
        sellPrice: 101,
        buyTradingFeePct: 0.1,
        sellTradingFeePct: 0.1,
        withdrawalFeeAsset: 0,
      }),
    );
    expect(noWd.verdict).toBe('profitable');

    // Withdraw 0.5 of 10 purchased (~5% of position) — wipes most of the $8 net
    const withWd = calculateNetProfit(
      baseInput({
        buyPrice: 100,
        sellPrice: 101,
        buyTradingFeePct: 0.1,
        sellTradingFeePct: 0.1,
        withdrawalFeeAsset: 0.5,
      }),
    );
    expect(withWd.sellableQty).toBeCloseTo(noWd.purchasedQty - 0.5, 6);
    expect(withWd.estimatedNetProfitUsd).toBeLessThan(noWd.estimatedNetProfitUsd);
    expect(withWd.verdict).toBe('not_profitable');
  });

  it('withdrawal cost is not double-counted in net profit', () => {
    const result = calculateNetProfit(
      baseInput({
        buyTradingFeePct: 0,
        sellTradingFeePct: 0,
        buySlippagePct: 0,
        sellSlippagePct: 0,
        withdrawalFeeAsset: 0.1, // 0.1 asset × $101 sell = $10.1 opportunity
        additionalCostUsd: 0,
      }),
    );
    // Cash-flow: qty=10, sellable=9.9, proceeds=9.9*101=999.9, net=999.9-1000=-0.1
    // If withdrawal USD were ALSO subtracted, net would be ~-10.2
    expect(result.sellableQty).toBeCloseTo(9.9, 6);
    expect(result.withdrawalCostUsd).toBeCloseTo(10.1, 4);
    expect(result.estimatedNetProfitUsd).toBeCloseTo(-0.1, 4);
    expect(result.estimatedNetProfitUsd).toBeGreaterThan(-5);
  });

  it('slippage cost is not double-counted in net profit', () => {
    const result = calculateNetProfit(
      baseInput({
        buyPrice: 100,
        sellPrice: 101,
        buyTradingFeePct: 0,
        sellTradingFeePct: 0,
        buySlippagePct: 1,
        sellSlippagePct: 0,
        withdrawalFeeAsset: 0,
      }),
    );
    // effectiveBuy=101, qty=1000/101, proceeds=qty*101=1000, net=0
    // Slippage display cost > 0, but must not push net to a large negative
    expect(result.estimatedSlippageCostUsd).toBeGreaterThan(0);
    expect(result.estimatedNetProfitUsd).toBeCloseTo(0, 4);
  });

  it('buy fee is paid in addition to investment notional', () => {
    const result = calculateNetProfit(
      baseInput({
        buyPrice: 100,
        sellPrice: 100,
        buyTradingFeePct: 1,
        sellTradingFeePct: 0,
        withdrawalFeeAsset: 0,
      }),
    );
    // qty = 10, proceeds = 1000, buy fee = 10 → net = -10
    expect(result.purchasedQty).toBeCloseTo(10, 6);
    expect(result.buyTradingFeeUsd).toBeCloseTo(10, 6);
    expect(result.estimatedNetProfitUsd).toBeCloseTo(-10, 6);
  });
});

describe('analytics buckets and formatting', () => {
  it('amount bucketing matches product buckets', () => {
    expect(bucketAmountUsd(50)).toBe('under_100');
    expect(bucketAmountUsd(100)).toBe('100_499');
    expect(bucketAmountUsd(499)).toBe('100_499');
    expect(bucketAmountUsd(500)).toBe('500_999');
    expect(bucketAmountUsd(999)).toBe('500_999');
    expect(bucketAmountUsd(1000)).toBe('1000_4999');
    expect(bucketAmountUsd(5000)).toBe('5000_plus');
  });

  it('formatUsd handles tiny and large values', () => {
    expect(formatUsd(0.0000123)).toMatch(/0\.000012/);
    expect(formatUsd(1234567.8)).toContain('1,234,567');
    expect(formatUsd(-3.5, true)).toMatch(/−\$3/);
  });

  it('verdict labels are user-facing', () => {
    expect(verdictLabel('profitable')).toBe('Potentially profitable');
    expect(verdictLabel('marginal')).toBe('Marginal opportunity');
    expect(verdictLabel('not_profitable')).toBe('Not profitable after costs');
    expect(verdictLabel('invalid')).toBe('Cannot calculate');
  });
});
