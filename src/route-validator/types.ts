/** Live Route Validator — domain types */

export type ValidatorExchange = 'Binance' | 'Bybit' | 'MEXC';
export type ValidatorAsset = 'BTC' | 'ETH' | 'SOL' | 'XRP';
export type QuoteAsset = 'USDT';

export type DataSourceKind = 'live' | 'estimated' | 'unavailable';

export type RouteVerdict =
  | 'potentially_executable'
  | 'marginal'
  | 'not_profitable'
  | 'insufficient_liquidity'
  | 'transfer_unverified'
  | 'transfer_unavailable'
  | 'stale_data'
  | 'unsupported'
  | 'unavailable';

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface OrderBookLevel {
  price: string;
  quantity: string;
}

export interface NormalizedOrderBook {
  exchange: ValidatorExchange;
  symbol: string;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  exchangeTimestampMs: number | null;
  fetchedAt: string;
}

export interface DataSourceMeta {
  exchange: ValidatorExchange;
  category: 'order_book' | 'transfer' | 'fee_estimate';
  kind: DataSourceKind;
  fetchedAt: string | null;
  stale: boolean;
  note?: string;
  sourceUrl?: string;
}

export interface MarketExecutionSide {
  exchange: ValidatorExchange;
  symbol: string;
  bestPrice: number | null;
  averageExecutionPrice: number | null;
  estimatedSlippagePct: number | null;
  quoteSpentOrReceivedUsd: number | null;
  assetQuantity: number | null;
  availableDepthUsd: number | null;
  fullyFillable: boolean;
  unfilledQuoteUsd: number;
  unsoldAssetQty: number;
  levelsUsed: number;
  orderBookTimestampMs: number | null;
  sourceType: DataSourceKind;
}

export interface TransferRouteInfo {
  depositEnabled: boolean | null;
  withdrawalEnabled: boolean | null;
  commonNetworks: string[];
  selectedNetwork: string | null;
  withdrawalFeeAsset: number | null;
  networkFeeAsset: number | null;
  minWithdrawalAsset: number | null;
  confirmations: number | null;
  sourceType: DataSourceKind;
  lastVerified: string | null;
  unavailableReason: string | null;
  note: string | null;
}

export interface RouteValidationOverrides {
  buy_fee_pct?: number | null;
  sell_fee_pct?: number | null;
  withdrawal_fee_asset?: number | null;
  network_fee_asset?: number | null;
}

export interface RouteValidationRequest {
  asset: string;
  quote: string;
  buy_exchange: string;
  sell_exchange: string;
  trade_amount_usd: number;
  preferred_network?: string | null;
  overrides?: RouteValidationOverrides;
}

export interface RouteValidationResult {
  request: {
    asset: ValidatorAsset;
    quote: QuoteAsset;
    buy_exchange: ValidatorExchange;
    sell_exchange: ValidatorExchange;
    trade_amount_usd: number;
    preferred_network: string | null;
  };
  fetched_at: string;
  expires_at: string;
  freshness_seconds: number;
  buy_market: MarketExecutionSide;
  sell_market: MarketExecutionSide;
  transfer_route: TransferRouteInfo;
  net_profit: {
    estimatedNetProfitUsd: number | null;
    netProfitPct: number | null;
    grossSpreadPct: number | null;
    breakEvenSpreadPct: number | null;
    buyTradingFeeUsd: number | null;
    sellTradingFeeUsd: number | null;
    withdrawalCostUsd: number | null;
    engineVerdict: string | null;
  };
  fee_sources: {
    buy_fee_pct: number | null;
    sell_fee_pct: number | null;
    buy_fee_kind: DataSourceKind;
    sell_fee_kind: DataSourceKind;
    withdrawal_fee_kind: DataSourceKind;
  };
  verdict: RouteVerdict;
  confidence: ConfidenceLevel;
  warnings: string[];
  unavailable_fields: string[];
  data_sources: DataSourceMeta[];
}

export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNSUPPORTED'
  | 'MARKET_DATA_UNAVAILABLE'
  | 'RATE_LIMITED'
  | 'METHOD_NOT_ALLOWED'
  | 'PAYLOAD_TOO_LARGE'
  | 'SERVER_ERROR';

export interface ApiErrorBody {
  ok: false;
  error: { code: ApiErrorCode; message: string };
}

export interface ApiSuccessBody {
  ok: true;
  result: RouteValidationResult;
}

export type ApiResponse = ApiSuccessBody | ApiErrorBody;
