import type { MatcherStorage } from './storage.js';
import type { AlertSubscription, ValidatedCreateAlert } from './types.js';
import type { AlertDelivery, InsertDeliveryInput } from './match/types.js';

function samePair(a: AlertSubscription, b: ValidatedCreateAlert): boolean {
  if (a.asset !== b.asset) return false;
  if (a.alert_scope !== b.alert_scope) return false;
  if (a.alert_scope === 'any_pair') return true;
  return a.buy_exchange === b.buy_exchange && a.sell_exchange === b.sell_exchange;
}

function deliveryKey(alertId: string, fingerprint: string): string {
  return `${alertId}:${fingerprint}`;
}

export class MemoryAlertStorage implements MatcherStorage {
  private rows = new Map<string, AlertSubscription>();
  private deliveries = new Map<string, AlertDelivery>();

  clear(): void {
    this.rows.clear();
    this.deliveries.clear();
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
      trade_amount_usd: input.trade_amount_usd,
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
      trade_amount_usd: input.trade_amount_usd,
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

  async listActiveAlerts(opts: { afterId?: string; limit: number }): Promise<AlertSubscription[]> {
    const all = [...this.rows.values()]
      .filter((r) => r.status === 'active')
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    const after = opts.afterId;
    const sliced = after ? all.filter((r) => r.id > after) : all;
    return sliced.slice(0, opts.limit);
  }

  async insertDeliveryPending(row: InsertDeliveryInput): Promise<'inserted' | 'duplicate'> {
    const key = deliveryKey(row.alert_id, row.opportunity_fingerprint);
    if (this.deliveries.has(key)) return 'duplicate';
    const delivery: AlertDelivery = {
      ...row,
      email_status: 'pending',
      email_provider: null,
      provider_message_id: null,
      sent_at: null,
      failure_category: null,
    };
    this.deliveries.set(key, delivery);
    return 'inserted';
  }

  async getDelivery(alertId: string, fingerprint: string): Promise<AlertDelivery | null> {
    return this.deliveries.get(deliveryKey(alertId, fingerprint)) ?? null;
  }

  async getLastSentForRoute(
    alertId: string,
    asset: string,
    buyExchange: string,
    sellExchange: string,
  ): Promise<AlertDelivery | null> {
    let best: AlertDelivery | null = null;
    for (const row of this.deliveries.values()) {
      if (row.alert_id !== alertId) continue;
      if (row.email_status !== 'sent') continue;
      if (row.asset !== asset || row.buy_exchange !== buyExchange || row.sell_exchange !== sellExchange) {
        continue;
      }
      const ts = row.sent_at || row.matched_at;
      if (!best || (best.sent_at || best.matched_at) < ts) best = row;
    }
    return best;
  }

  async markDeliverySent(
    id: string,
    meta: { sentAt: string; provider: string; providerMessageId: string | null },
  ): Promise<void> {
    for (const row of this.deliveries.values()) {
      if (row.id !== id) continue;
      row.email_status = 'sent';
      row.sent_at = meta.sentAt;
      row.email_provider = meta.provider;
      row.provider_message_id = meta.providerMessageId;
      row.failure_category = null;
      return;
    }
  }

  async markDeliveryFailed(id: string, category: string): Promise<void> {
    for (const row of this.deliveries.values()) {
      if (row.id !== id) continue;
      row.email_status = 'failed';
      row.failure_category = category;
      return;
    }
  }

  async markDeliverySkipped(id: string, category: string): Promise<void> {
    for (const row of this.deliveries.values()) {
      if (row.id !== id) continue;
      row.email_status = 'skipped';
      row.failure_category = category;
      return;
    }
  }

  async updateLatestMatchingOpportunity(alertId: string, at: string): Promise<void> {
    const row = this.rows.get(alertId);
    if (!row) return;
    row.latest_matching_opportunity_at = at;
    row.updated_at = at;
  }

  /** Test helper */
  getAll(): AlertSubscription[] {
    return [...this.rows.values()];
  }

  /** Test helper */
  getDeliveries(): AlertDelivery[] {
    return [...this.deliveries.values()];
  }

  /** Test helper — seed a legacy row without trade amount. */
  seed(row: AlertSubscription): void {
    this.rows.set(row.id, row);
  }
}
