import type { AlertSubscription, ValidatedCreateAlert } from './types.js';
import type { AlertDelivery, InsertDeliveryInput } from './match/types.js';

export interface AlertStorage {
  findActiveDuplicate(input: ValidatedCreateAlert): Promise<AlertSubscription | null>;
  findUnsubscribedDuplicate(input: ValidatedCreateAlert): Promise<AlertSubscription | null>;
  findByUnsubscribeToken(token: string): Promise<AlertSubscription | null>;
  create(input: ValidatedCreateAlert, meta: { id: string; unsubscribe_token: string; now: string }): Promise<AlertSubscription>;
  reactivate(
    existing: AlertSubscription,
    input: ValidatedCreateAlert,
    meta: { unsubscribe_token: string; now: string },
  ): Promise<AlertSubscription>;
  markUnsubscribed(token: string, now: string): Promise<'unsubscribed' | 'already_unsubscribed' | 'not_found'>;
}

/** Matcher-only storage. Create/unsubscribe callers may implement AlertStorage alone. */
export interface MatcherStorage extends AlertStorage {
  listActiveAlerts(opts: { afterId?: string; limit: number }): Promise<AlertSubscription[]>;
  insertDeliveryPending(row: InsertDeliveryInput): Promise<'inserted' | 'duplicate'>;
  getDelivery(alertId: string, fingerprint: string): Promise<AlertDelivery | null>;
  getLastSentForRoute(
    alertId: string,
    asset: string,
    buyExchange: string,
    sellExchange: string,
  ): Promise<AlertDelivery | null>;
  markDeliverySent(
    id: string,
    meta: { sentAt: string; provider: string; providerMessageId: string | null },
  ): Promise<void>;
  markDeliveryFailed(id: string, category: string): Promise<void>;
  markDeliverySkipped(id: string, category: string): Promise<void>;
  updateLatestMatchingOpportunity(alertId: string, at: string): Promise<void>;
}

export class StorageConfigError extends Error {
  constructor(message = 'Alert storage is not configured') {
    super(message);
    this.name = 'StorageConfigError';
  }
}

export class StorageFailureError extends Error {
  constructor(message = 'Alert storage failed') {
    super(message);
    this.name = 'StorageFailureError';
  }
}
