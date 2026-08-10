import { calculateNetProfit, getEstimatedTakerFeePct } from '../net-profit/index.js';
import { getAdapter, UpstreamError } from './adapters/index.js';
import { cacheGet, cacheSet } from './cache.js';
import { simulateBuyFromAsks, simulateSellFromBids } from './order-book.js';
import { resolveSymbol, RESULT_TTL_SECONDS, STALE_BOOK_MS } from './symbols.js';
import { buildTransferRoute } from './transfer.js';
import type {
  DataSourceMeta,
  MarketExecutionSide,
  RouteValidationResult,
} from './types.js';
import { validateRouteRequest } from './validate.js';
import { computeVerdict } from './verdict.js';

export interface ValidateRouteOutcome {
  ok: true;
  result: RouteValidationResult;
  cacheHit: boolean;
}

export interface ValidateRouteFailure {
  ok: false;
  category:
    | 'validation'
    | 'unsupported'
    | 'market_unavailable'
    | 'server_error';
  reason: string;
}

function sideFromBuy(
  exchange: RouteValidationResult['request']['buy_exchange'],
  symbol: string,
  bookTs: number | null,
  sim: ReturnType<typeof simulateBuyFromAsks>,
): MarketExecutionSide {
  return {
    exchange,
    symbol,
    bestPrice: sim.bestAsk,
    averageExecutionPrice: sim.averageExecutionPrice,
    estimatedSlippagePct: sim.estimatedSlippagePct,
    quoteSpentOrReceivedUsd: sim.quoteSpentUsd,
    assetQuantity: sim.assetQuantity,
    availableDepthUsd: sim.availableDepthUsd,
    fullyFillable: sim.fullyFillable,
    unfilledQuoteUsd: sim.unfilledQuoteUsd,
    unsoldAssetQty: 0,
    levelsUsed: sim.levelsUsed,
    orderBookTimestampMs: bookTs,
    sourceType: 'live',
  };
}

function sideFromSell(
  exchange: RouteValidationResult['request']['sell_exchange'],
  symbol: string,
  bookTs: number | null,
  sim: ReturnType<typeof simulateSellFromBids>,
): MarketExecutionSide {
  return {
    exchange,
    symbol,
    bestPrice: sim.bestBid,
    averageExecutionPrice: sim.averageExecutionPrice,
    estimatedSlippagePct: sim.estimatedSlippagePct,
    quoteSpentOrReceivedUsd: sim.quoteReceivedUsd,
    assetQuantity: sim.assetSold,
    availableDepthUsd: sim.availableDepthUsd,
    fullyFillable: sim.fullyFillable,
    unfilledQuoteUsd: 0,
    unsoldAssetQty: sim.unsoldAssetQty,
    levelsUsed: sim.levelsUsed,
    orderBookTimestampMs: bookTs,
    sourceType: 'live',
  };
}

export async function validateLiveRoute(
  raw: unknown,
  opts: { skipCache?: boolean; now?: () => Date } = {},
): Promise<ValidateRouteOutcome | ValidateRouteFailure> {
  const validated = validateRouteRequest(raw);
  if (!validated.ok) {
    const unsupported =
      validated.reason === 'unsupported_asset' ||
      validated.reason === 'unsupported_exchange' ||
      validated.reason === 'unsupported_quote' ||
      validated.reason === 'usdt_asset_unsupported' ||
      validated.reason === 'same_exchange';
    return {
      ok: false,
      category: unsupported ? 'unsupported' : 'validation',
      reason: validated.reason,
    };
  }

  const req = validated.value;
  const cacheKey = JSON.stringify({
    a: req.asset,
    b: req.buy_exchange,
    s: req.sell_exchange,
    amt: req.trade_amount_usd,
    n: req.preferred_network,
    o: req.overrides,
  });

  if (!opts.skipCache) {
    const cached = cacheGet<RouteValidationResult>(cacheKey);
    if (cached) return { ok: true, result: cached, cacheHit: true };
  }

  const buySymbol = resolveSymbol(req.buy_exchange, req.asset);
  const sellSymbol = resolveSymbol(req.sell_exchange, req.asset);
  const now = (opts.now ?? (() => new Date()))();

  let buyBook;
  let sellBook;
  try {
    const buyAdapter = getAdapter(req.buy_exchange);
    const sellAdapter = getAdapter(req.sell_exchange);
    [buyBook, sellBook] = await Promise.all([
      buyAdapter.fetchOrderBook(buySymbol),
      sellAdapter.fetchOrderBook(sellSymbol),
    ]);
  } catch (err) {
    const category =
      err instanceof UpstreamError && err.category === 'timeout'
        ? 'market_unavailable'
        : 'market_unavailable';
    return { ok: false, category, reason: 'upstream_failed' };
  }

  let buySim;
  let sellSim;
  try {
    buySim = simulateBuyFromAsks(buyBook.asks, req.trade_amount_usd);
    if (buySim.assetQuantity <= 0) {
      return { ok: false, category: 'market_unavailable', reason: 'zero_quantity' };
    }
  } catch {
    return { ok: false, category: 'market_unavailable', reason: 'book_simulation_failed' };
  }

  const transfer = await buildTransferRoute({
    asset: req.asset,
    buyExchange: req.buy_exchange,
    sellExchange: req.sell_exchange,
    preferredNetwork: req.preferred_network,
    withdrawalFeeOverride: req.overrides.withdrawal_fee_asset,
    networkFeeOverride: req.overrides.network_fee_asset,
  });

  const withdrawalFeeKnown =
    transfer.withdrawalFeeAsset != null && Number.isFinite(transfer.withdrawalFeeAsset);
  const withdrawalFeeAsset = withdrawalFeeKnown ? Number(transfer.withdrawalFeeAsset) : 0;
  const networkFeeAsset =
    transfer.networkFeeAsset != null && Number.isFinite(transfer.networkFeeAsset)
      ? Number(transfer.networkFeeAsset)
      : 0;

  // Sell quantity for book + engine accounts for withdrawal when known.
  // When unknown we still simulate full acquired qty but mark fee unavailable (not zero as truth).
  const sellQtyForBook = Math.max(
    0,
    buySim.assetQuantity - (withdrawalFeeKnown ? withdrawalFeeAsset : 0) - networkFeeAsset,
  );

  try {
    if (sellQtyForBook <= 0) {
      sellSim = {
        fullyFillable: false,
        quoteReceivedUsd: 0,
        assetSold: 0,
        averageExecutionPrice: null as number | null,
        bestBid: null as number | null,
        estimatedSlippagePct: null as number | null,
        availableDepthUsd: 0,
        unsoldAssetQty: buySim.assetQuantity,
        levelsUsed: 0,
      };
    } else {
      sellSim = simulateSellFromBids(sellBook.bids, sellQtyForBook);
    }
  } catch {
    return { ok: false, category: 'market_unavailable', reason: 'sell_simulation_failed' };
  }

  const buyFeeEst = getEstimatedTakerFeePct(req.buy_exchange);
  const sellFeeEst = getEstimatedTakerFeePct(req.sell_exchange);
  const buyFee =
    req.overrides.buy_fee_pct != null ? req.overrides.buy_fee_pct : buyFeeEst;
  const sellFee =
    req.overrides.sell_fee_pct != null ? req.overrides.sell_fee_pct : sellFeeEst;

  const unavailable: string[] = [];
  if (!withdrawalFeeKnown) unavailable.push('withdrawal_fee_asset');
  if (transfer.depositEnabled == null) unavailable.push('deposit_status');
  if (transfer.withdrawalEnabled == null) unavailable.push('withdrawal_status');
  if (!transfer.selectedNetwork) unavailable.push('common_network');
  if (transfer.networkFeeAsset == null && req.overrides.network_fee_asset == null) {
    unavailable.push('network_fee_asset');
  }

  let netProfit = null;
  if (
    buySim.averageExecutionPrice != null &&
    sellSim.averageExecutionPrice != null &&
    buyFee != null &&
    sellFee != null &&
    buySim.assetQuantity > 0
  ) {
    // Slippage already baked into average execution prices → pass 0% slippage to engine.
    netProfit = calculateNetProfit({
      investmentUsd: req.trade_amount_usd,
      buyExchange: req.buy_exchange,
      sellExchange: req.sell_exchange,
      assetSymbol: req.asset,
      buyPrice: buySim.averageExecutionPrice,
      sellPrice: sellSim.averageExecutionPrice,
      buyTradingFeePct: buyFee,
      sellTradingFeePct: sellFee,
      withdrawalFeeAsset: withdrawalFeeKnown ? withdrawalFeeAsset : 0,
      networkFeeAsset,
      buySlippagePct: 0,
      sellSlippagePct: 0,
      additionalCostUsd: 0,
    });
  }

  const buySide = sideFromBuy(req.buy_exchange, buySymbol, buyBook.exchangeTimestampMs, buySim);
  const sellSide = sideFromSell(req.sell_exchange, sellSymbol, sellBook.exchangeTimestampMs, sellSim);

  const freshestMs = Math.max(
    Date.parse(buyBook.fetchedAt) || 0,
    Date.parse(sellBook.fetchedAt) || 0,
  );
  const freshnessSeconds = Math.max(0, Math.round((now.getTime() - freshestMs) / 1000));
  const bookStale =
    (buyBook.exchangeTimestampMs != null &&
      now.getTime() - buyBook.exchangeTimestampMs > STALE_BOOK_MS) ||
    (sellBook.exchangeTimestampMs != null &&
      now.getTime() - sellBook.exchangeTimestampMs > STALE_BOOK_MS);

  const transferLiveVerified = transfer.sourceType === 'live';

  const verdictOut = computeVerdict({
    buy: buySide,
    sell: sellSide,
    transfer,
    netProfitUsd: netProfit ? netProfit.estimatedNetProfitUsd : null,
    netProfitPct: netProfit ? netProfit.netProfitPct : null,
    freshnessSeconds,
    bookStale,
    withdrawalFeeKnown,
    transferLiveVerified,
  });

  const dataSources: DataSourceMeta[] = [
    {
      exchange: req.buy_exchange,
      category: 'order_book',
      kind: 'live',
      fetchedAt: buyBook.fetchedAt,
      stale: bookStale,
      note: 'Public spot order book',
    },
    {
      exchange: req.sell_exchange,
      category: 'order_book',
      kind: 'live',
      fetchedAt: sellBook.fetchedAt,
      stale: bookStale,
      note: 'Public spot order book',
    },
    {
      exchange: req.buy_exchange,
      category: 'transfer',
      kind: transfer.sourceType,
      fetchedAt: transfer.lastVerified,
      stale: false,
      ...(transfer.note || transfer.unavailableReason
        ? { note: transfer.note ?? transfer.unavailableReason ?? '' }
        : {}),
    },
    {
      exchange: req.buy_exchange,
      category: 'fee_estimate',
      kind: 'estimated',
      fetchedAt: null,
      stale: false,
      note: req.overrides.buy_fee_pct != null ? 'User-provided value' : 'VIP0-style estimated taker fee',
    },
    {
      exchange: req.sell_exchange,
      category: 'fee_estimate',
      kind: 'estimated',
      fetchedAt: null,
      stale: false,
      note: req.overrides.sell_fee_pct != null ? 'User-provided value' : 'VIP0-style estimated taker fee',
    },
  ];

  const expires = new Date(now.getTime() + RESULT_TTL_SECONDS * 1000);
  const result: RouteValidationResult = {
    request: {
      asset: req.asset,
      quote: 'USDT',
      buy_exchange: req.buy_exchange,
      sell_exchange: req.sell_exchange,
      trade_amount_usd: req.trade_amount_usd,
      preferred_network: req.preferred_network,
    },
    fetched_at: now.toISOString(),
    expires_at: expires.toISOString(),
    freshness_seconds: freshnessSeconds,
    buy_market: buySide,
    sell_market: sellSide,
    transfer_route: transfer,
    net_profit: {
      estimatedNetProfitUsd: netProfit ? netProfit.estimatedNetProfitUsd : null,
      netProfitPct: netProfit ? netProfit.netProfitPct : null,
      grossSpreadPct: netProfit ? netProfit.grossSpreadPct : null,
      breakEvenSpreadPct: netProfit ? netProfit.breakEvenSpreadPct : null,
      buyTradingFeeUsd: netProfit ? netProfit.buyTradingFeeUsd : null,
      sellTradingFeeUsd: netProfit ? netProfit.sellTradingFeeUsd : null,
      withdrawalCostUsd: netProfit && withdrawalFeeKnown ? netProfit.withdrawalCostUsd : null,
      engineVerdict: netProfit ? netProfit.verdict : null,
    },
    fee_sources: {
      buy_fee_pct: buyFee,
      sell_fee_pct: sellFee,
      buy_fee_kind: req.overrides.buy_fee_pct != null ? 'estimated' : 'estimated',
      sell_fee_kind: req.overrides.sell_fee_pct != null ? 'estimated' : 'estimated',
      withdrawal_fee_kind: withdrawalFeeKnown
        ? req.overrides.withdrawal_fee_asset != null
          ? 'estimated'
          : transfer.sourceType
        : 'unavailable',
    },
    verdict: verdictOut.verdict,
    confidence: verdictOut.confidence,
    warnings: [...verdictOut.warnings, ...(netProfit?.warnings ?? [])],
    unavailable_fields: unavailable,
    data_sources: dataSources,
  };

  cacheSet(cacheKey, result, RESULT_TTL_SECONDS * 1000);
  return { ok: true, result, cacheHit: false };
}
