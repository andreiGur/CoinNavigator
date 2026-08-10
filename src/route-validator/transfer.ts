/**
 * Transfer feasibility helpers.
 *
 * Public authenticated-free capital/network APIs are unreliable or gated for
 * Binance/Bybit/MEXC spot. This MVP never invents live transfer status.
 *
 * Optional estimated withdrawal fees are centralized and explicitly marked.
 */

import type { TransferRouteInfo, ValidatorAsset, ValidatorExchange } from './types.js';
import { getAdapter } from './adapters/index.js';

export interface EstimatedWithdrawalFee {
  asset: ValidatorAsset;
  exchange: ValidatorExchange;
  network: string;
  feeAsset: number;
  sourceNote: string;
  lastVerified: string;
  sourceUrl: string;
}

/**
 * Conservative estimated withdrawal fees — NOT live truth.
 * Used only as labeled estimates when user has not provided an override
 * and live transfer metadata is unavailable.
 */
export const ESTIMATED_WITHDRAWAL_FEES: readonly EstimatedWithdrawalFee[] = [
  {
    asset: 'BTC',
    exchange: 'Binance',
    network: 'BTC',
    feeAsset: 0.0002,
    sourceNote: 'Estimated on-chain BTC withdrawal fee (not live).',
    lastVerified: '2026-08-06',
    sourceUrl: 'https://www.binance.com/en/fee/cryptoFee',
  },
  {
    asset: 'ETH',
    exchange: 'Binance',
    network: 'ETH',
    feeAsset: 0.0015,
    sourceNote: 'Estimated ETH network withdrawal fee (not live).',
    lastVerified: '2026-08-06',
    sourceUrl: 'https://www.binance.com/en/fee/cryptoFee',
  },
  {
    asset: 'SOL',
    exchange: 'Binance',
    network: 'SOL',
    feeAsset: 0.01,
    sourceNote: 'Estimated SOL withdrawal fee (not live).',
    lastVerified: '2026-08-06',
    sourceUrl: 'https://www.binance.com/en/fee/cryptoFee',
  },
  {
    asset: 'XRP',
    exchange: 'Binance',
    network: 'XRP',
    feeAsset: 0.25,
    sourceNote: 'Estimated XRP withdrawal fee (not live).',
    lastVerified: '2026-08-06',
    sourceUrl: 'https://www.binance.com/en/fee/cryptoFee',
  },
];

export function findEstimatedWithdrawal(
  exchange: ValidatorExchange,
  asset: ValidatorAsset,
  preferredNetwork?: string | null,
): EstimatedWithdrawalFee | null {
  const rows = ESTIMATED_WITHDRAWAL_FEES.filter(
    (r) => r.exchange === exchange && r.asset === asset,
  );
  if (!rows.length) return null;
  if (preferredNetwork) {
    const match = rows.find(
      (r) => r.network.toUpperCase() === preferredNetwork.toUpperCase(),
    );
    if (match) return match;
  }
  return rows[0] ?? null;
}

export async function buildTransferRoute(opts: {
  asset: ValidatorAsset;
  buyExchange: ValidatorExchange;
  sellExchange: ValidatorExchange;
  preferredNetwork?: string | null;
  withdrawalFeeOverride?: number | null;
  networkFeeOverride?: number | null;
}): Promise<TransferRouteInfo> {
  const buyAdapter = getAdapter(opts.buyExchange);
  const sellAdapter = getAdapter(opts.sellExchange);

  let buyMeta = null;
  let sellMeta = null;
  try {
    buyMeta = (await buyAdapter.fetchTransferMeta?.(opts.asset)) ?? null;
  } catch {
    buyMeta = null;
  }
  try {
    sellMeta = (await sellAdapter.fetchTransferMeta?.(opts.asset)) ?? null;
  } catch {
    sellMeta = null;
  }

  // Live transfer metadata not available on public APIs for this MVP.
  if (!buyMeta || !sellMeta) {
    const estimated = findEstimatedWithdrawal(
      opts.buyExchange,
      opts.asset,
      opts.preferredNetwork,
    );
    const override =
      opts.withdrawalFeeOverride != null && Number.isFinite(opts.withdrawalFeeOverride)
        ? opts.withdrawalFeeOverride
        : null;

    return {
      depositEnabled: null,
      withdrawalEnabled: null,
      // Common network only when both exchanges clearly support it (not from estimates).
      commonNetworks: [],
      selectedNetwork: opts.preferredNetwork ?? null,
      withdrawalFeeAsset: override,
      networkFeeAsset:
        opts.networkFeeOverride != null && Number.isFinite(opts.networkFeeOverride)
          ? opts.networkFeeOverride
          : null,
      minWithdrawalAsset: null,
      confirmations: null,
      sourceType: override != null ? 'estimated' : 'unavailable',
      lastVerified: estimated?.lastVerified ?? null,
      unavailableReason:
        'Public transfer metadata is not available for this exchange pair without private API keys.',
      note:
        override != null
          ? 'Withdrawal fee provided by user override. Deposit/withdrawal status still unverified.'
          : estimated
            ? `Live transfer status unavailable. Optional estimated fee for ${estimated.network} exists but is not applied unless you override.`
            : 'Live transfer status and fees unavailable.',
    };
  }

  // Future path if public meta becomes available
  const buyNets = new Set(buyMeta.networks.map((n) => n.network.toUpperCase()));
  const sellNets = sellMeta.networks
    .map((n) => n.network)
    .filter((n) => buyNets.has(n.toUpperCase()));
  let selected =
    opts.preferredNetwork &&
    sellNets.some((n) => n.toUpperCase() === opts.preferredNetwork!.toUpperCase())
      ? opts.preferredNetwork
      : sellNets[0] ?? null;

  const buyRow = buyMeta.networks.find(
    (n) => selected && n.network.toUpperCase() === selected.toUpperCase(),
  );
  const sellRow = sellMeta.networks.find(
    (n) => selected && n.network.toUpperCase() === selected.toUpperCase(),
  );

  const withdrawalFee =
    opts.withdrawalFeeOverride != null && Number.isFinite(opts.withdrawalFeeOverride)
      ? opts.withdrawalFeeOverride
      : buyRow?.withdrawFee ?? null;

  return {
    depositEnabled: sellRow?.depositEnable ?? null,
    withdrawalEnabled: buyRow?.withdrawEnable ?? null,
    commonNetworks: sellNets,
    selectedNetwork: selected,
    withdrawalFeeAsset: withdrawalFee,
    networkFeeAsset:
      opts.networkFeeOverride != null && Number.isFinite(opts.networkFeeOverride)
        ? opts.networkFeeOverride
        : null,
    minWithdrawalAsset: buyRow?.minWithdraw ?? null,
    confirmations: buyRow?.confirmations ?? null,
    sourceType: 'live',
    lastVerified: buyMeta.fetchedAt,
    unavailableReason: sellNets.length ? null : 'No common network found.',
    note: null,
  };
}
