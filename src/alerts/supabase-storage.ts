import type { AlertStorage, MatcherStorage } from './storage.js';
import { StorageConfigError, StorageFailureError } from './storage.js';
import type { AlertSubscription, ValidatedCreateAlert } from './types.js';
import type { AlertDelivery, InsertDeliveryInput } from './match/types.js';

interface SupabaseConfig {
  url: string;
  serviceRoleKey: string;
}

function getConfig(env: NodeJS.ProcessEnv = process.env): SupabaseConfig | null {
  const url = (env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || '').trim().replace(/\/$/, '');
  const serviceRoleKey = (env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!url || !serviceRoleKey) return null;
  return { url, serviceRoleKey };
}

function mapRow(row: Record<string, unknown>): AlertSubscription {
  return {
    id: String(row.id),
    email: String(row.email),
    asset: row.asset as AlertSubscription['asset'],
    buy_exchange: (row.buy_exchange as AlertSubscription['buy_exchange']) ?? null,
    sell_exchange: (row.sell_exchange as AlertSubscription['sell_exchange']) ?? null,
    alert_scope: row.alert_scope as AlertSubscription['alert_scope'],
    minimum_net_profit_pct:
      row.minimum_net_profit_pct === null || row.minimum_net_profit_pct === undefined
        ? null
        : Number(row.minimum_net_profit_pct),
    minimum_net_profit_usd:
      row.minimum_net_profit_usd === null || row.minimum_net_profit_usd === undefined
        ? null
        : Number(row.minimum_net_profit_usd),
    trade_amount_usd:
      row.trade_amount_usd === null || row.trade_amount_usd === undefined
        ? null
        : Number(row.trade_amount_usd),
    source_page: String(row.source_page ?? ''),
    source_context: String(row.source_context ?? ''),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    status: row.status as AlertSubscription['status'],
    unsubscribe_token: String(row.unsubscribe_token),
    consent_version: String(row.consent_version ?? ''),
    user_agent_hash: row.user_agent_hash == null ? null : String(row.user_agent_hash),
    latest_matching_opportunity_at:
      row.latest_matching_opportunity_at == null
        ? null
        : String(row.latest_matching_opportunity_at),
  };
}

function mapDelivery(row: Record<string, unknown>): AlertDelivery {
  return {
    id: String(row.id),
    alert_id: String(row.alert_id),
    opportunity_fingerprint: String(row.opportunity_fingerprint),
    asset: String(row.asset),
    buy_exchange: String(row.buy_exchange),
    sell_exchange: String(row.sell_exchange),
    estimated_net_profit_pct:
      row.estimated_net_profit_pct === null || row.estimated_net_profit_pct === undefined
        ? null
        : Number(row.estimated_net_profit_pct),
    estimated_net_profit_usd:
      row.estimated_net_profit_usd === null || row.estimated_net_profit_usd === undefined
        ? null
        : Number(row.estimated_net_profit_usd),
    opportunity_data_timestamp:
      row.opportunity_data_timestamp == null ? null : String(row.opportunity_data_timestamp),
    matched_at: String(row.matched_at),
    email_status: row.email_status as AlertDelivery['email_status'],
    email_provider: row.email_provider == null ? null : String(row.email_provider),
    provider_message_id: row.provider_message_id == null ? null : String(row.provider_message_id),
    sent_at: row.sent_at == null ? null : String(row.sent_at),
    failure_category: row.failure_category == null ? null : String(row.failure_category),
    created_at: String(row.created_at),
  };
}

async function rest<T>(
  cfg: SupabaseConfig,
  path: string,
  init: RequestInit & { prefer?: string } = {},
): Promise<{ status: number; json: T | null; text: string }> {
  const headers: Record<string, string> = {
    apikey: cfg.serviceRoleKey,
    Authorization: `Bearer ${cfg.serviceRoleKey}`,
    'Content-Type': 'application/json',
  };
  if (init.prefer) headers.Prefer = init.prefer;
  const res = await fetch(`${cfg.url}/rest/v1/${path}`, {
    ...init,
    headers: { ...headers, ...(init.headers as Record<string, string> | undefined) },
  });
  const text = await res.text();
  let json: T | null = null;
  if (text) {
    try {
      json = JSON.parse(text) as T;
    } catch {
      json = null;
    }
  }
  return { status: res.status, json, text };
}

export class SupabaseAlertStorage implements MatcherStorage {
  constructor(private readonly cfg: SupabaseConfig) {}

  static fromEnv(env: NodeJS.ProcessEnv = process.env): SupabaseAlertStorage | null {
    const cfg = getConfig(env);
    return cfg ? new SupabaseAlertStorage(cfg) : null;
  }

  private async findByStatus(
    input: ValidatedCreateAlert,
    statusFilter: string,
  ): Promise<AlertSubscription | null> {
    let query =
      `arbitrage_alerts?select=*&email=eq.${encodeURIComponent(input.email)}` +
      `&asset=eq.${encodeURIComponent(input.asset)}` +
      `&alert_scope=eq.${encodeURIComponent(input.alert_scope)}` +
      `&status=${statusFilter}&limit=20`;

    if (input.alert_scope === 'exact_pair') {
      query +=
        `&buy_exchange=eq.${encodeURIComponent(String(input.buy_exchange))}` +
        `&sell_exchange=eq.${encodeURIComponent(String(input.sell_exchange))}`;
    }

    const { status, json, text } = await rest<Record<string, unknown>[]>(this.cfg, query, {
      method: 'GET',
    });
    if (status >= 400) {
      throw new StorageFailureError(`findByStatus failed (${status}): ${text.slice(0, 120)}`);
    }
    const rows = Array.isArray(json) ? json : [];
    return rows.length ? mapRow(rows[0]!) : null;
  }

  async findActiveDuplicate(input: ValidatedCreateAlert): Promise<AlertSubscription | null> {
    return this.findByStatus(input, 'in.(pending,active)');
  }

  async findUnsubscribedDuplicate(input: ValidatedCreateAlert): Promise<AlertSubscription | null> {
    return this.findByStatus(input, 'eq.unsubscribed');
  }

  async findByUnsubscribeToken(token: string): Promise<AlertSubscription | null> {
    const query = `arbitrage_alerts?select=*&unsubscribe_token=eq.${encodeURIComponent(token)}&limit=1`;
    const { status, json, text } = await rest<Record<string, unknown>[]>(this.cfg, query, {
      method: 'GET',
    });
    if (status >= 400) {
      throw new StorageFailureError(`findByToken failed (${status}): ${text.slice(0, 120)}`);
    }
    const rows = Array.isArray(json) ? json : [];
    return rows.length ? mapRow(rows[0]!) : null;
  }

  async create(
    input: ValidatedCreateAlert,
    meta: { id: string; unsubscribe_token: string; now: string },
  ): Promise<AlertSubscription> {
    const payload = {
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
    const { status, json, text } = await rest<Record<string, unknown>[]>(
      this.cfg,
      'arbitrage_alerts',
      {
        method: 'POST',
        body: JSON.stringify(payload),
        prefer: 'return=representation',
      },
    );
    if (status >= 400 || !Array.isArray(json) || !json[0]) {
      throw new StorageFailureError(`create failed (${status}): ${text.slice(0, 120)}`);
    }
    return mapRow(json[0]);
  }

  async reactivate(
    existing: AlertSubscription,
    input: ValidatedCreateAlert,
    meta: { unsubscribe_token: string; now: string },
  ): Promise<AlertSubscription> {
    const payload = {
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
    const { status, json, text } = await rest<Record<string, unknown>[]>(
      this.cfg,
      `arbitrage_alerts?id=eq.${encodeURIComponent(existing.id)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
        prefer: 'return=representation',
      },
    );
    if (status >= 400 || !Array.isArray(json) || !json[0]) {
      throw new StorageFailureError(`reactivate failed (${status}): ${text.slice(0, 120)}`);
    }
    return mapRow(json[0]);
  }

  async markUnsubscribed(
    token: string,
    now: string,
  ): Promise<'unsubscribed' | 'already_unsubscribed' | 'not_found'> {
    const existing = await this.findByUnsubscribeToken(token);
    if (!existing) return 'not_found';
    if (existing.status === 'unsubscribed') return 'already_unsubscribed';

    const { status, text } = await rest(
      this.cfg,
      `arbitrage_alerts?unsubscribe_token=eq.${encodeURIComponent(token)}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ status: 'unsubscribed', updated_at: now }),
        prefer: 'return=minimal',
      },
    );
    if (status >= 400) {
      throw new StorageFailureError(`unsubscribe failed (${status}): ${text.slice(0, 120)}`);
    }
    return 'unsubscribed';
  }

  async listActiveAlerts(opts: { afterId?: string; limit: number }): Promise<AlertSubscription[]> {
    let query =
      `arbitrage_alerts?select=*&status=eq.active&order=id.asc&limit=${encodeURIComponent(String(opts.limit))}`;
    if (opts.afterId) {
      query += `&id=gt.${encodeURIComponent(opts.afterId)}`;
    }
    const { status, json, text } = await rest<Record<string, unknown>[]>(this.cfg, query, {
      method: 'GET',
    });
    if (status >= 400) {
      throw new StorageFailureError(`listActiveAlerts failed (${status}): ${text.slice(0, 120)}`);
    }
    const rows = Array.isArray(json) ? json : [];
    return rows.map(mapRow);
  }

  async insertDeliveryPending(row: InsertDeliveryInput): Promise<'inserted' | 'duplicate'> {
    const payload = {
      id: row.id,
      alert_id: row.alert_id,
      opportunity_fingerprint: row.opportunity_fingerprint,
      asset: row.asset,
      buy_exchange: row.buy_exchange,
      sell_exchange: row.sell_exchange,
      estimated_net_profit_pct: row.estimated_net_profit_pct,
      estimated_net_profit_usd: row.estimated_net_profit_usd,
      opportunity_data_timestamp: row.opportunity_data_timestamp,
      matched_at: row.matched_at,
      email_status: 'pending',
      email_provider: null,
      provider_message_id: null,
      sent_at: null,
      failure_category: null,
      created_at: row.created_at,
    };
    const { status, text } = await rest(this.cfg, 'arbitrage_alert_deliveries', {
      method: 'POST',
      body: JSON.stringify(payload),
      prefer: 'return=minimal',
    });
    if (status === 409) return 'duplicate';
    if (status >= 400) {
      throw new StorageFailureError(`insertDeliveryPending failed (${status}): ${text.slice(0, 120)}`);
    }
    return 'inserted';
  }

  async getDelivery(alertId: string, fingerprint: string): Promise<AlertDelivery | null> {
    const query =
      `arbitrage_alert_deliveries?select=*` +
      `&alert_id=eq.${encodeURIComponent(alertId)}` +
      `&opportunity_fingerprint=eq.${encodeURIComponent(fingerprint)}` +
      `&limit=1`;
    const { status, json, text } = await rest<Record<string, unknown>[]>(this.cfg, query, {
      method: 'GET',
    });
    if (status >= 400) {
      throw new StorageFailureError(`getDelivery failed (${status}): ${text.slice(0, 120)}`);
    }
    const rows = Array.isArray(json) ? json : [];
    return rows.length ? mapDelivery(rows[0]!) : null;
  }

  async getLastSentForRoute(
    alertId: string,
    asset: string,
    buyExchange: string,
    sellExchange: string,
  ): Promise<AlertDelivery | null> {
    const query =
      `arbitrage_alert_deliveries?select=*` +
      `&alert_id=eq.${encodeURIComponent(alertId)}` +
      `&asset=eq.${encodeURIComponent(asset)}` +
      `&buy_exchange=eq.${encodeURIComponent(buyExchange)}` +
      `&sell_exchange=eq.${encodeURIComponent(sellExchange)}` +
      `&email_status=eq.sent` +
      `&order=sent_at.desc.nullslast` +
      `&limit=1`;
    const { status, json, text } = await rest<Record<string, unknown>[]>(this.cfg, query, {
      method: 'GET',
    });
    if (status >= 400) {
      throw new StorageFailureError(`getLastSentForRoute failed (${status}): ${text.slice(0, 120)}`);
    }
    const rows = Array.isArray(json) ? json : [];
    return rows.length ? mapDelivery(rows[0]!) : null;
  }

  async markDeliverySent(
    id: string,
    meta: { sentAt: string; provider: string; providerMessageId: string | null },
  ): Promise<void> {
    const { status, text } = await rest(
      this.cfg,
      `arbitrage_alert_deliveries?id=eq.${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          email_status: 'sent',
          sent_at: meta.sentAt,
          email_provider: meta.provider,
          provider_message_id: meta.providerMessageId,
          failure_category: null,
        }),
        prefer: 'return=minimal',
      },
    );
    if (status >= 400) {
      throw new StorageFailureError(`markDeliverySent failed (${status}): ${text.slice(0, 120)}`);
    }
  }

  async markDeliveryFailed(id: string, category: string): Promise<void> {
    const { status, text } = await rest(
      this.cfg,
      `arbitrage_alert_deliveries?id=eq.${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ email_status: 'failed', failure_category: category }),
        prefer: 'return=minimal',
      },
    );
    if (status >= 400) {
      throw new StorageFailureError(`markDeliveryFailed failed (${status}): ${text.slice(0, 120)}`);
    }
  }

  async markDeliverySkipped(id: string, category: string): Promise<void> {
    const { status, text } = await rest(
      this.cfg,
      `arbitrage_alert_deliveries?id=eq.${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ email_status: 'skipped', failure_category: category }),
        prefer: 'return=minimal',
      },
    );
    if (status >= 400) {
      throw new StorageFailureError(`markDeliverySkipped failed (${status}): ${text.slice(0, 120)}`);
    }
  }

  async updateLatestMatchingOpportunity(alertId: string, at: string): Promise<void> {
    const { status, text } = await rest(
      this.cfg,
      `arbitrage_alerts?id=eq.${encodeURIComponent(alertId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          latest_matching_opportunity_at: at,
          updated_at: at,
        }),
        prefer: 'return=minimal',
      },
    );
    if (status >= 400) {
      throw new StorageFailureError(
        `updateLatestMatchingOpportunity failed (${status}): ${text.slice(0, 120)}`,
      );
    }
  }
}

export function requireStorage(env: NodeJS.ProcessEnv = process.env): AlertStorage {
  const supabase = SupabaseAlertStorage.fromEnv(env);
  if (supabase) return supabase;
  if (env.ALERTS_STORAGE === 'memory' || env.NODE_ENV === 'test') {
    // Lazy import avoided — callers in tests inject MemoryAlertStorage.
    throw new StorageConfigError(
      'Memory storage must be injected in tests; set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for production',
    );
  }
  throw new StorageConfigError();
}
