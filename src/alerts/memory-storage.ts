import type { AlertStorage } from './storage.js';
import type { AlertSubscription, ValidatedCreateAlert } from './types.js';

function samePair(a: AlertSubscription, b: ValidatedCreateAlert): boolean {
  if (a.asset !== b.asset) return false;
  if (a.alert_scope !== b.alert_scope) return false;
  if (a.alert_scope === 'any_pair') return true;
  return a.buy_exchange === b.buy_exchange && a.sell_exchange === b.sell_exchange;
}

export class MemoryAlertStorage implements AlertStorage {
  private rows = new Map<string, AlertSubscription>();

  clear(): void {
    this.rows.clear();
  }

  async findActiveDuplicate(input: ValidatedCreateAlert): Promise<AlertSubscription | null> {
    for (const row of this.rows.values()) {
      if (row.email !== input.email) continue;
      if (row.status === 'unsubscribed') continue;
      if (samePair(row, input)) return row;
    }
    return null;
  }

  async findUnsubscribedDuplicate(input: ValidatedCreateAlert): Promise<AlertSubscription | null> {
    for (const row of this.rows.values()) {
      if (row.email !== input.email) continue;
      if (row.status !== 'unsubscribed') continue;
      if (samePair(row, input)) return row;
    }
    return null;
  }

  async findByUnsubscribeToken(token: string): Promise<AlertSubscription | null> {
    for (const row of this.rows.values()) {
      if (row.unsubscribe_token === token) return row;
    }
    return null;
  }

  async create(
    input: ValidatedCreateAlert,
    meta: { id: string; unsubscribe_token: string; now: string },
  ): Promise<AlertSubscription> {
    const row: AlertSubscription = {
      id: meta.id,
      email: input.email,
      asset: input.asset,
      buy_exchange: input.buy_exchange,
      sell_exchange: input.sell_exchange,
      alert_scope: input.alert_scope,
      minimum_net_profit_pct: input.minimum_net_profit_pct,
      minimum_net_profit_usd: input.minimum_net_profit_usd,
      source_page: input.source_page,
      source_context: input.source_context,
      created_at: meta.now,
      updated_at: meta.now,
      status: 'active',
      unsubscribe_token: meta.unsubscribe_token,
      consent_version: input.consent_version,
      user_agent_hash: input.user_agent_hash,
      latest_matching_opportunity_at: null,
    };
    this.rows.set(row.id, row);
    return row;
  }

  async reactivate(
    existing: AlertSubscription,
    input: ValidatedCreateAlert,
    meta: { unsubscribe_token: string; now: string },
  ): Promise<AlertSubscription> {
    const next: AlertSubscription = {
      ...existing,
      asset: input.asset,
      buy_exchange: input.buy_exchange,
      sell_exchange: input.sell_exchange,
      alert_scope: input.alert_scope,
      minimum_net_profit_pct: input.minimum_net_profit_pct,
      minimum_net_profit_usd: input.minimum_net_profit_usd,
      source_page: input.source_page,
      source_context: input.source_context,
      consent_version: input.consent_version,
      user_agent_hash: input.user_agent_hash,
      status: 'active',
      unsubscribe_token: meta.unsubscribe_token,
      updated_at: meta.now,
    };
    this.rows.set(next.id, next);
    return next;
  }

  async markUnsubscribed(
    token: string,
    now: string,
  ): Promise<'unsubscribed' | 'already_unsubscribed' | 'not_found'> {
    const row = await this.findByUnsubscribeToken(token);
    if (!row) return 'not_found';
    if (row.status === 'unsubscribed') return 'already_unsubscribed';
    row.status = 'unsubscribed';
    row.updated_at = now;
    this.rows.set(row.id, row);
    return 'unsubscribed';
  }

  /** Test helper */
  getAll(): AlertSubscription[] {
    return [...this.rows.values()];
  }
}
