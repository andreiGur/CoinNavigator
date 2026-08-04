import type { AlertStorage } from './storage.js';
import { StorageConfigError, StorageFailureError } from './storage.js';
import type { AlertSubscription, ValidatedCreateAlert } from './types.js';

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

export class SupabaseAlertStorage implements AlertStorage {
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
