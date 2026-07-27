/**
 * Types for the CoinNavigator net-profit calculation engine.
 * Pure data contracts — no DOM / React coupling.
 */

/** Canonical exchange identifiers used across the site (affiliate-links, spread-engine). */
export type ExchangeId =
  | 'Binance'
  | 'MEXC'
  | 'Bybit'
  | 'OKX'
  | 'KuCoin'
  | 'Gate';

export type ProfitVerdict =
  | 'profitable'
  | 'marginal'
  | 'not_profitable'
  | 'invalid';

export interface NetProfitInput {
  /**
   * Trade notional in USD spent buying the asset (excluding trading fees).
   * Buy trading fees are modeled as an additional cash outlay on top of this amount.
   */
  investmentUsd: number;
  buyExchange: ExchangeId | string;
  sellExchange: ExchangeId | string;
  assetSymbol: string;
  /** Raw observed buy price (quote per 1 asset). */
  buyPrice: number;
  /** Raw observed sell price (quote per 1 asset). */
  sellPrice: number;
  /** Buy-side spot trading fee as a percentage (e.g. 0.1 for 0.10%). */
  buyTradingFeePct: number;
  /** Sell-side spot trading fee as a percentage (e.g. 0.1 for 0.10%). */
  sellTradingFeePct: number;
  /** Withdrawal fee in asset units (not USD). */
  withdrawalFeeAsset: number;
  /** Optional extra network / gas fee in asset units. */
  networkFeeAsset?: number;
  /** Estimated adverse buy slippage as a percentage. */
  buySlippagePct: number;
  /** Estimated adverse sell slippage as a percentage. */
  sellSlippagePct: number;
  /** Optional fixed extra cost in USD (conversion, messaging, etc.). */
  additionalCostUsd?: number;
}

export interface NetProfitResult {
  purchasedQty: number;
  /** Quantity remaining after withdrawal + network fees (asset units). */
  sellableQty: number;
  grossSpreadPct: number;
  grossProfitUsd: number;
  buyTradingFeeUsd: number;
  sellTradingFeeUsd: number;
  withdrawalCostAsset: number;
  withdrawalCostUsd: number;
  networkCostUsd: number;
  estimatedSlippageCostUsd: number;
  /** Fixed additional cost passed through for breakdown display. */
  additionalCostUsd: number;
  /**
   * Display-only sum of cost categories (fees, withdrawal, network, slippage, additional).
   * Not used as a second subtraction on top of the cash-flow net-profit formula.
   */
  totalEstimatedCostsUsd: number;
  /** Cash received after sell fee: sellableQty × effectiveSell − sellTradingFee. */
  netProceedsUsd: number;
  /**
   * Cash-flow net:
   * netProceeds − investmentUsd − buyTradingFeeUsd − additionalCostUsd
   *
   * Withdrawal/network are NOT subtracted again here — they already reduced sellableQty.
   * Slippage is NOT subtracted again here — it is already in effective buy/sell prices.
   */
  estimatedNetProfitUsd: number;
  netProfitPct: number;
  breakEvenSpreadPct: number;
  verdict: ProfitVerdict;
  warnings: string[];
}

export interface ExchangeFeeRecord {
  id: ExchangeId;
  displayName: string;
  estimatedSpotMakerFeePct: number;
  estimatedSpotTakerFeePct: number;
  sourceUrl: string;
  sourceNote: string;
  lastVerified: string;
  isEstimated: true;
  affiliateKey: ExchangeId;
}

export interface NetProfitThresholds {
  /** Net USD below this (but > 0) is "marginal". */
  marginalProfitUsd: number;
  /** Net % below this (but > 0) is also treated as marginal. */
  marginalProfitPct: number;
  /** Warn when total costs / gross profit exceeds this fraction (0–1). */
  costDominanceRatio: number;
}
