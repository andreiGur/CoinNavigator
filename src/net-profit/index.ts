/**
 * CoinNavigator Net Profit Calculation Engine
 *
 * Pure TypeScript module. Browser build attaches the same API to
 * `window.CoinNavigatorNetProfit` via assets/js/net-profit-engine.js.
 */

export type {
  ExchangeFeeRecord,
  ExchangeId,
  NetProfitInput,
  NetProfitResult,
  NetProfitThresholds,
  ProfitVerdict,
} from './types.js';

export {
  EXCHANGE_FEE_ESTIMATES,
  NET_PROFIT_THRESHOLDS,
  SUPPORTED_EXCHANGES,
  getEstimatedTakerFeePct,
  getExchangeFeeEstimate,
} from './config.js';

export { calculateNetProfit } from './calculate.js';
export { validateNetProfitInput } from './validate.js';
export type { ValidationIssue } from './validate.js';
export {
  bucketAmountUsd,
  bucketNetProfitUsd,
  bucketSpreadPct,
} from './buckets.js';
export type { AmountBucket } from './buckets.js';
export {
  formatPct,
  formatQty,
  formatUsd,
  isNonNegativeNumber,
  isPositiveNumber,
  parseOptionalNumber,
  verdictLabel,
} from './format.js';
