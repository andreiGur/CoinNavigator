import type { ExchangeFeeRecord, ExchangeId, NetProfitThresholds } from './types.js';

/**
 * Central thresholds for verdicts and warnings.
 * Tune here — do not hard-code in the calculator.
 */
export const NET_PROFIT_THRESHOLDS: NetProfitThresholds = {
  marginalProfitUsd: 1,
  marginalProfitPct: 0.05,
  costDominanceRatio: 0.7,
};

/**
 * Estimated public spot fee schedule for exchanges shown on CoinNavigator.
 *
 * IMPORTANT: All values are ESTIMATES of default VIP0 / retail taker+maker rates.
 * They are NOT live API quotes, NOT VIP tiers, and NOT promotional discounts.
 * Always prefer caller-supplied fee percentages when the user knows their rate.
 */
export const EXCHANGE_FEE_ESTIMATES: Readonly<Record<ExchangeId, ExchangeFeeRecord>> = {
  Binance: {
    id: 'Binance',
    displayName: 'Binance',
    estimatedSpotMakerFeePct: 0.1,
    estimatedSpotTakerFeePct: 0.1,
    sourceUrl: 'https://www.binance.com/en/fee/schedule',
    sourceNote: 'Default spot VIP0 schedule (estimate). BNB discounts not applied.',
    lastVerified: '2026-07-27',
    isEstimated: true,
    affiliateKey: 'Binance',
  },
  MEXC: {
    id: 'MEXC',
    displayName: 'MEXC',
    estimatedSpotMakerFeePct: 0.0,
    estimatedSpotTakerFeePct: 0.05,
    sourceUrl: 'https://www.mexc.com/fee',
    sourceNote: 'Default spot schedule (estimate). Maker often 0%; taker ~0.05%.',
    lastVerified: '2026-07-27',
    isEstimated: true,
    affiliateKey: 'MEXC',
  },
  Bybit: {
    id: 'Bybit',
    displayName: 'Bybit',
    estimatedSpotMakerFeePct: 0.1,
    estimatedSpotTakerFeePct: 0.1,
    sourceUrl: 'https://www.bybit.com/en/help-center/article/Trading-Fee-Structure',
    sourceNote: 'Default spot VIP0 schedule (estimate).',
    lastVerified: '2026-07-27',
    isEstimated: true,
    affiliateKey: 'Bybit',
  },
  OKX: {
    id: 'OKX',
    displayName: 'OKX',
    estimatedSpotMakerFeePct: 0.08,
    estimatedSpotTakerFeePct: 0.1,
    sourceUrl: 'https://www.okx.com/fees',
    sourceNote: 'Default spot VIP0 schedule (estimate).',
    lastVerified: '2026-07-27',
    isEstimated: true,
    affiliateKey: 'OKX',
  },
  KuCoin: {
    id: 'KuCoin',
    displayName: 'KuCoin',
    estimatedSpotMakerFeePct: 0.1,
    estimatedSpotTakerFeePct: 0.1,
    sourceUrl: 'https://www.kucoin.com/rate',
    sourceNote: 'Default spot schedule (estimate).',
    lastVerified: '2026-07-27',
    isEstimated: true,
    affiliateKey: 'KuCoin',
  },
  Gate: {
    id: 'Gate',
    displayName: 'Gate.io',
    estimatedSpotMakerFeePct: 0.2,
    estimatedSpotTakerFeePct: 0.2,
    sourceUrl: 'https://www.gate.io/fee',
    sourceNote: 'Default spot schedule (estimate). Higher than peers on many pairs.',
    lastVerified: '2026-07-27',
    isEstimated: true,
    affiliateKey: 'Gate',
  },
};

export const SUPPORTED_EXCHANGES: readonly ExchangeId[] = Object.freeze(
  Object.keys(EXCHANGE_FEE_ESTIMATES) as ExchangeId[],
);

/** Lookup estimated fees; returns undefined when the exchange is unknown. */
export function getExchangeFeeEstimate(exchange: string): ExchangeFeeRecord | undefined {
  if (Object.prototype.hasOwnProperty.call(EXCHANGE_FEE_ESTIMATES, exchange)) {
    return EXCHANGE_FEE_ESTIMATES[exchange as ExchangeId];
  }
  return undefined;
}

/**
 * Convenience: estimated taker fee % for an exchange, or null if unknown.
 * Callers must not invent a default like 0.1% when this returns null.
 */
export function getEstimatedTakerFeePct(exchange: string): number | null {
  const row = getExchangeFeeEstimate(exchange);
  return row ? row.estimatedSpotTakerFeePct : null;
}
