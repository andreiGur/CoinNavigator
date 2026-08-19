import { calculateNetProfit, getEstimatedTakerFeePct } from '../../net-profit/index.js';
import type { AlertSubscription } from '../types.js';
import type { OpportunityCandidate } from './opportunities.js';
import { DEFAULT_MIN_NET_PROFIT_PCT } from './policies.js';

export interface MatchAssumptions {
  buyFeePct: number;
  sellFeePct: number;
  buyFeeKind: 'estimated';
  sellFeeKind: 'estimated';
  withdrawalFeeKind: 'unavailable';
  networkFeeKind: 'unavailable';
  slippageKind: 'unavailable';
}

export interface QualifiedMatch {
  matched: true;
  asset: AlertSubscription['asset'];
  buyExchange: OpportunityCandidate['buyExchange'];
  sellExchange: OpportunityCandidate['sellExchange'];
  tradeAmountUsd: number;
  buyPrice: number;
  sellPrice: number;
  grossSpreadPct: number;
  estimatedNetProfitUsd: number;
  estimatedNetProfitPct: number;
  dataTimestamp: string;
  matchedAt: string;
  assumptions: MatchAssumptions;
  warnings: string[];
}

export type MatchSkipReason =
  | 'unsubscribed'
  | 'not_active'
  | 'missing_trade_amount'
  | 'unsupported_route'
  | 'no_matching_opportunity'
  | 'unknown_trading_fee'
  | 'invalid_financials'
  | 'below_threshold';

export type EvaluateResult =
  | { ok: true; match: QualifiedMatch }
  | { ok: false; reason: MatchSkipReason };

function thresholdsPass(
  alert: AlertSubscription,
  netPct: number,
  netUsd: number,
): boolean {
  const hasPct = alert.minimum_net_profit_pct != null && Number.isFinite(alert.minimum_net_profit_pct);
  const hasUsd = alert.minimum_net_profit_usd != null && Number.isFinite(alert.minimum_net_profit_usd);

  if (!hasPct && !hasUsd) {
    return netPct >= DEFAULT_MIN_NET_PROFIT_PCT;
  }
  if (hasPct && netPct < Number(alert.minimum_net_profit_pct)) return false;
  if (hasUsd && netUsd < Number(alert.minimum_net_profit_usd)) return false;
  return true;
}

export function evaluateOpportunity(
  alert: AlertSubscription,
  opp: OpportunityCandidate,
  opts: { now?: () => Date } = {},
): EvaluateResult {
  if (alert.status === 'unsubscribed') return { ok: false, reason: 'unsubscribed' };
  if (alert.status !== 'active') return { ok: false, reason: 'not_active' };

  const amount = alert.trade_amount_usd;
  if (amount == null || !Number.isFinite(amount) || amount <= 0) {
    return { ok: false, reason: 'missing_trade_amount' };
  }

  if (alert.alert_scope === 'exact_pair') {
    if (!alert.buy_exchange || !alert.sell_exchange) {
      return { ok: false, reason: 'unsupported_route' };
    }
    if (opp.buyExchange !== alert.buy_exchange || opp.sellExchange !== alert.sell_exchange) {
      return { ok: false, reason: 'no_matching_opportunity' };
    }
  } else if (alert.asset !== opp.asset) {
    return { ok: false, reason: 'no_matching_opportunity' };
  }

  if (alert.asset !== opp.asset) return { ok: false, reason: 'no_matching_opportunity' };

  const buyFee = getEstimatedTakerFeePct(opp.buyExchange);
  const sellFee = getEstimatedTakerFeePct(opp.sellExchange);
  if (buyFee == null || sellFee == null) {
    return { ok: false, reason: 'unknown_trading_fee' };
  }

  const result = calculateNetProfit({
    investmentUsd: amount,
    buyExchange: opp.buyExchange,
    sellExchange: opp.sellExchange,
    assetSymbol: opp.asset,
    buyPrice: opp.buyPrice,
    sellPrice: opp.sellPrice,
    buyTradingFeePct: buyFee,
    sellTradingFeePct: sellFee,
    // Unknown transfer costs are NOT treated as verified zero in product copy.
    // Engine requires a number; 0 is math-only and is labeled unavailable below.
    withdrawalFeeAsset: 0,
    networkFeeAsset: 0,
    buySlippagePct: 0,
    sellSlippagePct: 0,
    additionalCostUsd: 0,
  });

  if (result.verdict === 'invalid') {
    return { ok: false, reason: 'invalid_financials' };
  }

  if (!thresholdsPass(alert, result.netProfitPct, result.estimatedNetProfitUsd)) {
    return { ok: false, reason: 'below_threshold' };
  }

  const now = (opts.now ?? (() => new Date()))();
  const warnings = [
    ...(result.warnings ?? []),
    'Trading fees are VIP0-style estimates, not live account rates.',
    'Withdrawal and network fees are unavailable and were not treated as verified zero. Estimated net excludes unknown transfer costs.',
    'Slippage is not modeled from a live order book. Run Validate Live Route before trading.',
    'Prices can change before you finish transferring and trading.',
  ];

  return {
    ok: true,
    match: {
      matched: true,
      asset: alert.asset,
      buyExchange: opp.buyExchange,
      sellExchange: opp.sellExchange,
      tradeAmountUsd: amount,
      buyPrice: opp.buyPrice,
      sellPrice: opp.sellPrice,
      grossSpreadPct: result.grossSpreadPct,
      estimatedNetProfitUsd: result.estimatedNetProfitUsd,
      estimatedNetProfitPct: result.netProfitPct,
      dataTimestamp: opp.dataTimestamp,
      matchedAt: now.toISOString(),
      assumptions: {
        buyFeePct: buyFee,
        sellFeePct: sellFee,
        buyFeeKind: 'estimated',
        sellFeeKind: 'estimated',
        withdrawalFeeKind: 'unavailable',
        networkFeeKind: 'unavailable',
        slippageKind: 'unavailable',
      },
      warnings,
    },
  };
}

export function pickBestCandidate(
  alert: AlertSubscription,
  candidates: OpportunityCandidate[],
  opts: { now?: () => Date } = {},
): EvaluateResult {
  let best: QualifiedMatch | null = null;
  let lastFail: MatchSkipReason = 'no_matching_opportunity';
  for (const opp of candidates) {
    const evaluated = evaluateOpportunity(alert, opp, opts);
    if (!evaluated.ok) {
      lastFail = evaluated.reason;
      continue;
    }
    if (
      !best ||
      evaluated.match.estimatedNetProfitPct > best.estimatedNetProfitPct
    ) {
      best = evaluated.match;
    }
  }
  if (!best) return { ok: false, reason: lastFail };
  return { ok: true, match: best };
}
