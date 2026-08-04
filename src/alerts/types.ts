import type { SupportedAsset, SupportedExchange } from './allowlist.js';

export type AlertStatus = 'pending' | 'active' | 'unsubscribed';
export type AlertScope = 'exact_pair' | 'any_pair';

export const CONSENT_VERSION = 'alerts-v1-2026-08-04';

export interface AlertSubscription {
  id: string;
  email: string;
  asset: SupportedAsset;
  buy_exchange: SupportedExchange | null;
  sell_exchange: SupportedExchange | null;
  alert_scope: AlertScope;
  minimum_net_profit_pct: number | null;
  minimum_net_profit_usd: number | null;
  source_page: string;
  source_context: string;
  created_at: string;
  updated_at: string;
  status: AlertStatus;
  unsubscribe_token: string;
  consent_version: string;
  user_agent_hash: string | null;
  latest_matching_opportunity_at: string | null;
}

export interface CreateAlertInput {
  email: string;
  asset: string;
  buy_exchange: string;
  sell_exchange: string;
  alert_scope: AlertScope;
  minimum_net_profit_pct: number | null;
  minimum_net_profit_usd: number | null;
  source_page: string;
  source_context: string;
  consent: boolean;
  consent_version: string;
  /** Honeypot — must be empty */
  website?: string;
  user_agent?: string;
}

export interface ValidatedCreateAlert {
  email: string;
  asset: SupportedAsset;
  buy_exchange: SupportedExchange | null;
  sell_exchange: SupportedExchange | null;
  alert_scope: AlertScope;
  minimum_net_profit_pct: number | null;
  minimum_net_profit_usd: number | null;
  source_page: string;
  source_context: string;
  consent_version: string;
  user_agent_hash: string | null;
}

export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'RATE_LIMITED'
  | 'UNSUPPORTED'
  | 'MISSING_CONFIG'
  | 'SERVER_ERROR'
  | 'METHOD_NOT_ALLOWED'
  | 'PAYLOAD_TOO_LARGE'
  | 'NOT_FOUND';

export interface ApiErrorBody {
  ok: false;
  error: {
    code: ApiErrorCode;
    message: string;
  };
}

export interface ApiSuccessBody {
  ok: true;
  status: 'created' | 'already_exists' | 'unsubscribed' | 'already_unsubscribed';
  email_delivery?: 'disabled' | 'queued' | 'skipped';
}

export type ApiResponse = ApiSuccessBody | ApiErrorBody;
