import type {
  ConfidenceLevel,
  RouteVerdict,
  TransferRouteInfo,
  MarketExecutionSide,
} from './types.js';

export interface VerdictInput {
  buy: MarketExecutionSide;
  sell: MarketExecutionSide;
  transfer: TransferRouteInfo;
  netProfitUsd: number | null;
  netProfitPct: number | null;
  freshnessSeconds: number;
  bookStale: boolean;
  withdrawalFeeKnown: boolean;
  transferLiveVerified: boolean;
}

export interface VerdictOutput {
  verdict: RouteVerdict;
  confidence: ConfidenceLevel;
  warnings: string[];
}

const SAFETY_PROFIT_USD = 1;
const SAFETY_PROFIT_PCT = 0.05;
const FRESH_SEC = 12;

export function computeVerdict(input: VerdictInput): VerdictOutput {
  const warnings: string[] = [...[]];

  if (input.bookStale) {
    return {
      verdict: 'stale_data',
      confidence: 'low',
      warnings: ['Order-book data may be stale. Recheck before relying on this result.'],
    };
  }

  if (!input.buy.fullyFillable || !input.sell.fullyFillable) {
    return {
      verdict: 'insufficient_liquidity',
      confidence: 'medium',
      warnings: [
        !input.buy.fullyFillable
          ? 'Buy side could not fully fill the requested amount from the live order book.'
          : 'Sell side could not fully fill the transferable quantity from the live order book.',
      ],
    };
  }

  if (input.transfer.withdrawalEnabled === false || input.transfer.depositEnabled === false) {
    return {
      verdict: 'transfer_unavailable',
      confidence: 'high',
      warnings: ['Deposit or withdrawal is reported disabled for the selected network.'],
    };
  }

  const transferVerified =
    input.transferLiveVerified &&
    input.transfer.selectedNetwork != null &&
    input.transfer.commonNetworks.length > 0 &&
    input.transfer.depositEnabled === true &&
    input.transfer.withdrawalEnabled === true &&
    input.withdrawalFeeKnown;

  if (!transferVerified) {
    warnings.push(
      input.transfer.unavailableReason ||
        'Transfer route is not fully verified from live public exchange data.',
    );
    if (!input.withdrawalFeeKnown) {
      warnings.push(
        'Withdrawal fee is unavailable. Provide a user override to improve cost accuracy. Missing fees are not treated as zero.',
      );
    }

    if (input.netProfitUsd == null) {
      return { verdict: 'transfer_unverified', confidence: 'low', warnings };
    }
    if (input.netProfitUsd <= 0) {
      return {
        verdict: 'not_profitable',
        confidence: 'medium',
        warnings,
      };
    }
    return {
      verdict: 'transfer_unverified',
      confidence: input.freshnessSeconds <= FRESH_SEC ? 'medium' : 'low',
      warnings,
    };
  }

  if (input.netProfitUsd == null) {
    return { verdict: 'unavailable', confidence: 'low', warnings: ['Net profit could not be computed.'] };
  }

  if (input.netProfitUsd <= 0) {
    return {
      verdict: 'not_profitable',
      confidence: 'high',
      warnings: ['Estimated net result is not positive after modeled costs.'],
    };
  }

  if (
    input.netProfitUsd < SAFETY_PROFIT_USD ||
    (input.netProfitPct != null && input.netProfitPct < SAFETY_PROFIT_PCT)
  ) {
    return {
      verdict: 'marginal',
      confidence: 'medium',
      warnings: ['Estimated net profit is positive but below the safety threshold.'],
    };
  }

  return {
    verdict: 'potentially_executable',
    confidence: 'high',
    warnings: [
      'Potentially executable based on current public data. Conditions can change before you finish transferring and trading.',
    ],
  };
}

export function verdictLabel(v: RouteVerdict): string {
  switch (v) {
    case 'potentially_executable':
      return 'Potentially executable';
    case 'marginal':
      return 'Marginal after estimated costs';
    case 'not_profitable':
      return 'Not profitable after estimated costs';
    case 'insufficient_liquidity':
      return 'Insufficient liquidity';
    case 'transfer_unverified':
      return 'Transfer route not verified';
    case 'transfer_unavailable':
      return 'Transfer unavailable';
    case 'stale_data':
      return 'Stale data';
    case 'unsupported':
      return 'Unsupported route';
    case 'unavailable':
    default:
      return 'Live data unavailable';
  }
}
