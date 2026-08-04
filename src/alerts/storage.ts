import type { AlertSubscription, ValidatedCreateAlert } from './types.js';

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
