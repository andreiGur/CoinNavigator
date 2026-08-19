import type { SupportedAsset, SupportedExchange } from '../allowlist.js';

export type DeliveryEmailStatus = 'pending' | 'sent' | 'failed' | 'skipped';

export type DeliveryFailureCategory =
  | 'provider_unavailable'
  | 'provider_rejected'
  | 'stale_data'
  | 'duplicate'
  | 'cooldown'
  | 'invalid_alert'
  | 'no_matching_opportunity'
  | 'missing_config'
  | 'missing_trade_amount'
  | 'below_threshold'
  | 'unknown_trading_fee'
  | 'invalid_financials'
  | 'dry_run'
  | 'in_flight';

export interface AlertDelivery {
  id: string;
  alert_id: string;
  opportunity_fingerprint: string;
  asset: SupportedAsset | string;
  buy_exchange: SupportedExchange | string;
  sell_exchange: SupportedExchange | string;
  estimated_net_profit_pct: number | null;
  estimated_net_profit_usd: number | null;
  opportunity_data_timestamp: string | null;
  matched_at: string;
  email_status: DeliveryEmailStatus;
  email_provider: string | null;
  provider_message_id: string | null;
  sent_at: string | null;
  failure_category: DeliveryFailureCategory | string | null;
  created_at: string;
}

export interface InsertDeliveryInput {
  id: string;
  alert_id: string;
  opportunity_fingerprint: string;
  asset: string;
  buy_exchange: string;
  sell_exchange: string;
  estimated_net_profit_pct: number | null;
  estimated_net_profit_usd: number | null;
  opportunity_data_timestamp: string | null;
  matched_at: string;
  created_at: string;
}

export interface MatcherRunSummary {
  ok: true;
  dry_run: boolean;
  skip_reason: string | null;
  alerts_checked: number;
  opportunities_checked: number;
  matches: number;
  emails_sent: number;
  emails_failed: number;
  duplicates_skipped: number;
  cooldown_skipped: number;
  stale_data_skips: number;
  missing_trade_amount: number;
  duration_ms: number;
}
