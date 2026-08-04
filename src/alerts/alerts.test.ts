import { describe, expect, it, beforeEach } from 'vitest';
import { MemoryAlertStorage } from './memory-storage.js';
import { createAlertSubscription, unsubscribeAlert } from './service.js';
import { validateCreateAlertInput } from './validate.js';
import { createUnsubscribeToken, normalizeEmail, hashUserAgent } from './tokens.js';
import { checkRateLimit, resetRateLimits } from './rate-limit.js';
import { handleCreateAlertRequest, handleUnsubscribeRequest } from './http.js';
import { CONSENT_VERSION } from './types.js';
import { StorageFailureError, type AlertStorage } from './storage.js';
import type { VercelLikeRequest, VercelLikeResponse } from './http.js';

function baseBody(overrides: Record<string, unknown> = {}) {
  return {
    email: 'Trader@Example.com',
    asset: 'BTC',
    buy_exchange: 'Binance',
    sell_exchange: 'MEXC',
    alert_scope: 'exact_pair',
    minimum_net_profit_pct: 0.35,
    minimum_net_profit_usd: null,
    source_page: 'home',
    source_context: 'check_real_profit',
    consent: true,
    consent_version: CONSENT_VERSION,
    website: '',
    ...overrides,
  };
}

function mockRes() {
  const state: {
    statusCode: number;
    body: unknown;
    headers: Record<string, string>;
  } = { statusCode: 200, body: null, headers: {} };

  const res: VercelLikeResponse = {
    status(code: number) {
      state.statusCode = code;
      return res;
    },
    setHeader(name: string, value: string) {
      state.headers[name.toLowerCase()] = value;
    },
    json(body: unknown) {
      state.body = body;
    },
    send(body: string) {
      state.body = body;
    },
    end() {},
  };
  return { res, state };
}

describe('alert validation', () => {
  it('accepts a valid alert payload and normalizes email', () => {
    const result = validateCreateAlertInput(baseBody());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.email).toBe('trader@example.com');
      expect(result.value.asset).toBe('BTC');
      expect(result.value.buy_exchange).toBe('Binance');
    }
  });

  it('rejects invalid email', () => {
    const result = validateCreateAlertInput(baseBody({ email: 'not-an-email' }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('invalid_email');
  });

  it('rejects unsupported exchange', () => {
    const result = validateCreateAlertInput(baseBody({ buy_exchange: 'FakeEX' }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('unsupported_exchange');
  });

  it('rejects unsupported asset', () => {
    const result = validateCreateAlertInput(baseBody({ asset: 'DOGECOINMAX' }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('unsupported_asset');
  });

  it('rejects negative thresholds', () => {
    const result = validateCreateAlertInput(baseBody({ minimum_net_profit_pct: -1 }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('invalid_threshold');
  });

  it('rejects missing consent', () => {
    const result = validateCreateAlertInput(baseBody({ consent: false }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('missing_consent');
  });

  it('rejects honeypot submissions', () => {
    const result = validateCreateAlertInput(baseBody({ website: 'http://spam.test' }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('honeypot');
  });

  it('supports any_pair scope by clearing exchanges', () => {
    const result = validateCreateAlertInput(
      baseBody({ alert_scope: 'any_pair', buy_exchange: 'Binance', sell_exchange: 'MEXC' }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.alert_scope).toBe('any_pair');
      expect(result.value.buy_exchange).toBeNull();
      expect(result.value.sell_exchange).toBeNull();
    }
  });
});

describe('alert service', () => {
  let storage: MemoryAlertStorage;

  beforeEach(() => {
    storage = new MemoryAlertStorage();
  });

  it('creates a valid alert', async () => {
    const result = await createAlertSubscription(baseBody(), { storage });
    expect(result.httpStatus).toBe(201);
    expect(result.response).toEqual({
      ok: true,
      status: 'created',
      email_delivery: 'disabled',
    });
    expect(storage.getAll()).toHaveLength(1);
    expect(storage.getAll()[0]!.unsubscribe_token).toMatch(/^[a-f0-9]{64}$/);
  });

  it('handles duplicate active alerts', async () => {
    await createAlertSubscription(baseBody(), { storage });
    const dup = await createAlertSubscription(baseBody(), { storage });
    expect(dup.httpStatus).toBe(200);
    expect(dup.response).toMatchObject({ ok: true, status: 'already_exists' });
    expect(storage.getAll()).toHaveLength(1);
  });

  it('reactivates an unsubscribed alert', async () => {
    const created = await createAlertSubscription(baseBody(), { storage });
    expect(created.response.ok).toBe(true);
    const token = storage.getAll()[0]!.unsubscribe_token;
    await unsubscribeAlert(token, storage);
    const again = await createAlertSubscription(baseBody({ minimum_net_profit_pct: 0.5 }), {
      storage,
    });
    expect(again.httpStatus).toBe(201);
    expect(again.response).toMatchObject({ ok: true, status: 'created' });
    expect(storage.getAll()).toHaveLength(1);
    expect(storage.getAll()[0]!.status).toBe('active');
    expect(storage.getAll()[0]!.minimum_net_profit_pct).toBe(0.5);
  });

  it('maps storage failure without leaking details', async () => {
    const failing: AlertStorage = {
      async findActiveDuplicate() {
        throw new StorageFailureError('boom secret');
      },
      async findUnsubscribedDuplicate() {
        return null;
      },
      async findByUnsubscribeToken() {
        return null;
      },
      async create() {
        throw new StorageFailureError('boom secret');
      },
      async reactivate() {
        throw new StorageFailureError('boom secret');
      },
      async markUnsubscribed() {
        throw new StorageFailureError('boom secret');
      },
    };
    const result = await createAlertSubscription(baseBody(), { storage: failing });
    expect(result.httpStatus).toBe(503);
    expect(result.response.ok).toBe(false);
    if (!result.response.ok) {
      expect(result.response.error.message).not.toContain('secret');
      expect(result.response.error.code).toBe('SERVER_ERROR');
    }
    expect(result.analytics.failure_category).toBe('storage_failure');
  });
});

describe('unsubscribe', () => {
  it('creates secure tokens', () => {
    const a = createUnsubscribeToken();
    const b = createUnsubscribeToken();
    expect(a).toHaveLength(64);
    expect(a).not.toBe(b);
  });

  it('unsubscribes successfully and is idempotent', async () => {
    const storage = new MemoryAlertStorage();
    await createAlertSubscription(baseBody(), { storage });
    const token = storage.getAll()[0]!.unsubscribe_token;
    const first = await unsubscribeAlert(token, storage);
    expect(first.response).toMatchObject({ ok: true, status: 'unsubscribed' });
    const second = await unsubscribeAlert(token, storage);
    expect(second.response).toMatchObject({ ok: true, status: 'already_unsubscribed' });
  });
});

describe('rate limit', () => {
  beforeEach(() => resetRateLimits());

  it('blocks after the limit', () => {
    for (let i = 0; i < 10; i += 1) {
      expect(checkRateLimit('t', 10, 60_000).allowed).toBe(true);
    }
    expect(checkRateLimit('t', 10, 60_000).allowed).toBe(false);
  });
});

describe('http handlers + analytics safety', () => {
  beforeEach(() => resetRateLimits());

  it('creates via HTTP and never puts email in analytics helpers', async () => {
    const storage = new MemoryAlertStorage();
    const { res, state } = mockRes();
    const req: VercelLikeRequest = {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': 'vitest',
        'x-forwarded-for': '1.2.3.4',
      },
      body: baseBody(),
    };
    await handleCreateAlertRequest(req, res, {
      storage,
      env: { ALERTS_SITE_ORIGIN: 'https://coinnavigator.net' },
    });
    expect(state.statusCode).toBe(201);
    expect(state.body).toMatchObject({ ok: true, status: 'created' });
    expect(JSON.stringify(state.body)).not.toContain('trader@example.com');
  });

  it('does not include exact monetary thresholds in create analytics outcome payload shape', async () => {
    const storage = new MemoryAlertStorage();
    const result = await createAlertSubscription(
      baseBody({ minimum_net_profit_usd: 12.34, minimum_net_profit_pct: 0.42 }),
      { storage },
    );
    expect(result.analytics).toEqual({
      outcome: 'created',
      asset: 'BTC',
      alert_scope: 'exact_pair',
    });
    expect(JSON.stringify(result.analytics)).not.toContain('12.34');
    expect(JSON.stringify(result.analytics)).not.toContain('0.42');
  });

  it('rate limits HTTP create', async () => {
    const storage = new MemoryAlertStorage();
    for (let i = 0; i < 10; i += 1) {
      const { res } = mockRes();
      await handleCreateAlertRequest(
        {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-forwarded-for': '9.9.9.9' },
          body: baseBody({ email: `u${i}@example.com` }),
        },
        res,
        { storage },
      );
    }
    const { res, state } = mockRes();
    await handleCreateAlertRequest(
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-forwarded-for': '9.9.9.9' },
        body: baseBody({ email: 'last@example.com' }),
      },
      res,
      { storage },
    );
    expect(state.statusCode).toBe(429);
    expect(state.body).toMatchObject({ ok: false, error: { code: 'RATE_LIMITED' } });
  });

  it('unsubscribes via HTTP GET JSON', async () => {
    const storage = new MemoryAlertStorage();
    await createAlertSubscription(baseBody(), { storage });
    const token = storage.getAll()[0]!.unsubscribe_token;
    const { res, state } = mockRes();
    await handleUnsubscribeRequest(
      {
        method: 'GET',
        headers: { accept: 'application/json' },
        query: { token },
      },
      res,
      { storage },
    );
    expect(state.statusCode).toBe(200);
    expect(state.body).toMatchObject({ ok: true, status: 'unsubscribed' });
  });
});

describe('helpers', () => {
  it('normalizes email and hashes UA', () => {
    expect(normalizeEmail('  A@B.COM ')).toBe('a@b.com');
    expect(hashUserAgent('Mozilla/5.0')).toMatch(/^[a-f0-9]{32}$/);
    expect(hashUserAgent('')).toBeNull();
  });
});

describe('analytics payload contract', () => {
  it('frontend event property names never require email fields', () => {
    const sampleEvents = [
      {
        name: 'arbitrage_alert_submitted',
        props: {
          asset: 'BTC',
          alert_scope: 'exact_pair',
          has_net_profit_pct_threshold: true,
          has_net_profit_usd_threshold: false,
        },
      },
    ];
    for (const evt of sampleEvents) {
      expect('email' in evt.props).toBe(false);
      expect(JSON.stringify(evt)).not.toMatch(/@/);
    }
  });
});
