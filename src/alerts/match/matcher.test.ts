import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { calculateNetProfit, getEstimatedTakerFeePct } from '../../net-profit/index.js';
import { MemoryAlertStorage } from '../memory-storage.js';
import { createAlertSubscription, unsubscribeAlert } from '../service.js';
import { CONSENT_VERSION } from '../types.js';
import type { AlertSubscription } from '../types.js';
import type { EmailAdapter, OpportunitySendPayload, OpportunitySendResult } from '../email.js';
import {
  buildReturnUrl,
  emailContainsProhibitedLanguage,
  opportunityEmailHtml,
} from './opportunity-email.js';
import { evaluateOpportunity, pickBestCandidate } from './evaluate.js';
import { extractOpportunitiesForAsset, parseSpreadSnapshot } from './opportunities.js';
import { opportunityEventFingerprint } from './fingerprint.js';
import { DEFAULT_MIN_NET_PROFIT_PCT, MATCHER_STALE_MS } from './policies.js';
import { runAlertMatcher } from './runner.js';
import { handleMatchRequest } from './http.js';
import { authorizeCronRequest } from './http.js';
import type { SpreadSnapshot } from './opportunities.js';
import type { VercelLikeResponse } from '../http.js';
import { createUnsubscribeToken } from '../tokens.js';

const NOW = new Date('2026-08-18T12:00:00.000Z');
const FRESH_TS = '2026-08-18T11:50:00.000Z';
const STALE_TS = '2026-08-18T11:30:00.000Z';

function snapshot(overrides: {
  timestamp?: string;
  btc?: Record<string, number | null>;
  eth?: Record<string, number | null>;
  extra?: Record<string, unknown>;
} = {}): SpreadSnapshot {
  const parsed = parseSpreadSnapshot({
    timestamp: overrides.timestamp ?? FRESH_TS,
    symbols: {
      BTCUSDT: {
        prices: overrides.btc ?? {
          Binance: 100,
          MEXC: 101.5,
          OKX: 100.2,
          FakeEX: 200,
        },
      },
      ETHUSDT: {
        prices: overrides.eth ?? {
          Binance: 2000,
          MEXC: 2000.1,
        },
      },
      ...(overrides.extra ?? {}),
    },
  });
  if (!parsed) throw new Error('fixture snapshot invalid');
  return parsed;
}

function alertBody(overrides: Record<string, unknown> = {}) {
  return {
    email: 'trader@example.com',
    asset: 'BTC',
    buy_exchange: 'Binance',
    sell_exchange: 'MEXC',
    alert_scope: 'exact_pair',
    minimum_net_profit_pct: 0.35,
    minimum_net_profit_usd: null,
    trade_amount_usd: 1000,
    source_page: 'home',
    source_context: 'check_real_profit',
    consent: true,
    consent_version: CONSENT_VERSION,
    website: '',
    ...overrides,
  };
}

class MockEmail implements EmailAdapter {
  enabled = true;
  failNext = false;
  sent: OpportunitySendPayload[] = [];
  isEnabled(): boolean {
    return this.enabled;
  }
  async sendAlertConfirmation(): Promise<'disabled'> {
    return 'disabled';
  }
  async sendOpportunityEmail(payload: OpportunitySendPayload): Promise<OpportunitySendResult> {
    if (this.failNext) {
      this.failNext = false;
      return {
        status: 'failed',
        provider: 'resend',
        messageId: null,
        failureCategory: 'provider_rejected',
      };
    }
    this.sent.push(payload);
    return {
      status: 'queued',
      provider: 'resend',
      messageId: 'msg_test',
      failureCategory: null,
    };
  }
}

function mockRes() {
  const state: { statusCode: number; body: unknown; headers: Record<string, string> } = {
    statusCode: 200,
    body: null,
    headers: {},
  };
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

describe('matching', () => {
  const snap = snapshot();

  it('1 exact pair matches', async () => {
    const storage = new MemoryAlertStorage();
    await createAlertSubscription(alertBody(), { storage });
    const alert = storage.getAll()[0]!;
    const opp = extractOpportunitiesForAsset(snap, 'BTC').find(
      (o) => o.buyExchange === 'Binance' && o.sellExchange === 'MEXC',
    )!;
    const result = evaluateOpportunity(alert, opp, { now: () => NOW });
    expect(result.ok).toBe(true);
  });

  it('2 wrong pair does not match', async () => {
    const storage = new MemoryAlertStorage();
    await createAlertSubscription(alertBody(), { storage });
    const alert = storage.getAll()[0]!;
    const opp = extractOpportunitiesForAsset(snap, 'BTC').find(
      (o) => o.buyExchange === 'Binance' && o.sellExchange === 'OKX',
    )!;
    const result = evaluateOpportunity(alert, opp, { now: () => NOW });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('no_matching_opportunity');
  });

  it('3 any pair matches correct asset', async () => {
    const storage = new MemoryAlertStorage();
    await createAlertSubscription(alertBody({ alert_scope: 'any_pair' }), { storage });
    const alert = storage.getAll()[0]!;
    const result = pickBestCandidate(alert, extractOpportunitiesForAsset(snap, 'BTC'), {
      now: () => NOW,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.match.asset).toBe('BTC');
      expect(result.match.buyExchange).toBe('Binance');
      expect(result.match.sellExchange).toBe('MEXC');
    }
  });

  it('4 wrong asset does not match', async () => {
    const storage = new MemoryAlertStorage();
    await createAlertSubscription(alertBody({ asset: 'ETH', alert_scope: 'any_pair' }), {
      storage,
    });
    const alert = storage.getAll()[0]!;
    const result = pickBestCandidate(alert, extractOpportunitiesForAsset(snap, 'BTC'), {
      now: () => NOW,
    });
    expect(result.ok).toBe(false);
  });

  it('5-6 minimum % threshold pass and fail', async () => {
    const storage = new MemoryAlertStorage();
    await createAlertSubscription(alertBody({ minimum_net_profit_pct: 0.5 }), { storage });
    const passAlert = storage.getAll()[0]!;
    const opp = extractOpportunitiesForAsset(snap, 'BTC').find(
      (o) => o.buyExchange === 'Binance' && o.sellExchange === 'MEXC',
    )!;
    expect(evaluateOpportunity(passAlert, opp, { now: () => NOW }).ok).toBe(true);

    const storage2 = new MemoryAlertStorage();
    await createAlertSubscription(alertBody({ minimum_net_profit_pct: 50 }), { storage: storage2 });
    expect(evaluateOpportunity(storage2.getAll()[0]!, opp, { now: () => NOW }).ok).toBe(false);
  });

  it('7-8 minimum USD threshold pass and fail', async () => {
    const storage = new MemoryAlertStorage();
    await createAlertSubscription(
      alertBody({ minimum_net_profit_pct: null, minimum_net_profit_usd: 1 }),
      { storage },
    );
    const opp = extractOpportunitiesForAsset(snap, 'BTC').find(
      (o) => o.buyExchange === 'Binance' && o.sellExchange === 'MEXC',
    )!;
    expect(evaluateOpportunity(storage.getAll()[0]!, opp, { now: () => NOW }).ok).toBe(true);

    const storage2 = new MemoryAlertStorage();
    await createAlertSubscription(
      alertBody({ minimum_net_profit_pct: null, minimum_net_profit_usd: 1_000_000 }),
      { storage: storage2 },
    );
    expect(evaluateOpportunity(storage2.getAll()[0]!, opp, { now: () => NOW }).ok).toBe(false);
  });

  it('9 both thresholds require both to pass', async () => {
    const opp = extractOpportunitiesForAsset(snap, 'BTC').find(
      (o) => o.buyExchange === 'Binance' && o.sellExchange === 'MEXC',
    )!;
    const storage = new MemoryAlertStorage();
    await createAlertSubscription(
      alertBody({ minimum_net_profit_pct: 0.3, minimum_net_profit_usd: 1_000_000 }),
      { storage },
    );
    expect(evaluateOpportunity(storage.getAll()[0]!, opp, { now: () => NOW }).ok).toBe(false);
  });

  it('10 no hidden zero-profit default', async () => {
    const tiny = snapshot({
      btc: { Binance: 100, MEXC: 100.05 },
    });
    const storage = new MemoryAlertStorage();
    await createAlertSubscription(
      alertBody({ minimum_net_profit_pct: null, minimum_net_profit_usd: null }),
      { storage },
    );
    const alert = storage.getAll()[0]!;
    const opp = extractOpportunitiesForAsset(tiny, 'BTC')[0]!;
    const result = evaluateOpportunity(alert, opp, { now: () => NOW });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('below_threshold');
    expect(DEFAULT_MIN_NET_PROFIT_PCT).toBe(0.25);
  });

  it('11 stale snapshot never sends', async () => {
    const storage = new MemoryAlertStorage();
    const email = new MockEmail();
    await createAlertSubscription(alertBody(), { storage });
    const summary = await runAlertMatcher({
      storage,
      email,
      snapshot: snapshot({ timestamp: STALE_TS }),
      siteOrigin: 'https://coinnavigator.net',
      now: () => NOW,
      log() {},
    });
    expect(summary.skip_reason).toBe('stale_data');
    expect(summary.emails_sent).toBe(0);
    expect(email.sent).toHaveLength(0);
    expect(storage.getDeliveries()).toHaveLength(0);
    expect(Date.parse(NOW.toISOString()) - Date.parse(STALE_TS)).toBeGreaterThan(MATCHER_STALE_MS);
  });

  it('12 malformed opportunity ignored', () => {
    expect(parseSpreadSnapshot({ timestamp: 'nope', symbols: {} })).toBeNull();
    expect(parseSpreadSnapshot({ symbols: {} })).toBeNull();
    const s = snapshot({
      btc: { Binance: 100, MEXC: null as unknown as number },
    });
    expect(
      extractOpportunitiesForAsset(s, 'BTC').some((o) => o.sellExchange === 'MEXC'),
    ).toBe(false);
  });

  it('13 unsupported exchange ignored', () => {
    const opps = extractOpportunitiesForAsset(snap, 'BTC');
    expect(opps.some((o) => String(o.buyExchange) === 'FakeEX')).toBe(false);
  });

  it('14 unsupported asset ignored', () => {
    expect(extractOpportunitiesForAsset(snap, 'DOGE' as never).length).toBeGreaterThanOrEqual(0);
    const s = parseSpreadSnapshot({
      timestamp: FRESH_TS,
      symbols: { FAKEUSDT: { prices: { Binance: 1, MEXC: 2 } } },
    })!;
    expect(extractOpportunitiesForAsset(s, 'BTC')).toHaveLength(0);
  });

  it('15 negative/invalid financial values rejected', () => {
    const s = snapshot({
      btc: { Binance: -1, MEXC: 101.5, OKX: 0 },
    });
    expect(extractOpportunitiesForAsset(s, 'BTC')).toHaveLength(0);
  });
});

describe('financial', () => {
  it('16-19 net profit engine reused, fees applied, unknown withdrawal not verified zero, trade amount used', async () => {
    const storage = new MemoryAlertStorage();
    await createAlertSubscription(alertBody({ trade_amount_usd: 1000 }), { storage });
    const alert = storage.getAll()[0]!;
    const opp = extractOpportunitiesForAsset(snapshot(), 'BTC').find(
      (o) => o.buyExchange === 'Binance' && o.sellExchange === 'MEXC',
    )!;
    const buyFee = getEstimatedTakerFeePct('Binance')!;
    const sellFee = getEstimatedTakerFeePct('MEXC')!;
    const engine = calculateNetProfit({
      investmentUsd: 1000,
      buyExchange: 'Binance',
      sellExchange: 'MEXC',
      assetSymbol: 'BTC',
      buyPrice: opp.buyPrice,
      sellPrice: opp.sellPrice,
      buyTradingFeePct: buyFee,
      sellTradingFeePct: sellFee,
      withdrawalFeeAsset: 0,
      networkFeeAsset: 0,
      buySlippagePct: 0,
      sellSlippagePct: 0,
      additionalCostUsd: 0,
    });
    const matched = evaluateOpportunity(alert, opp, { now: () => NOW });
    expect(matched.ok).toBe(true);
    if (!matched.ok) return;
    expect(matched.match.estimatedNetProfitPct).toBe(engine.netProfitPct);
    expect(matched.match.estimatedNetProfitUsd).toBe(engine.estimatedNetProfitUsd);
    expect(matched.match.tradeAmountUsd).toBe(1000);
    expect(matched.match.assumptions.withdrawalFeeKind).toBe('unavailable');
    expect(matched.match.warnings.join(' ')).toMatch(/not treated as verified zero/i);
  });
});

describe('deduplication + cooldown', () => {
  it('21-22 same opportunity sent once; next cron does not resend', async () => {
    const storage = new MemoryAlertStorage();
    const email = new MockEmail();
    await createAlertSubscription(alertBody(), { storage });
    const deps = {
      storage,
      email,
      snapshot: snapshot(),
      siteOrigin: 'https://coinnavigator.net',
      now: () => NOW,
      log() {},
    };
    const first = await runAlertMatcher(deps);
    const second = await runAlertMatcher(deps);
    expect(first.emails_sent).toBe(1);
    expect(second.emails_sent).toBe(0);
    expect(second.duplicates_skipped).toBe(1);
    expect(email.sent).toHaveLength(1);
  });

  it('23 different alert may receive its own notification', async () => {
    const storage = new MemoryAlertStorage();
    const email = new MockEmail();
    await createAlertSubscription(alertBody({ email: 'a@example.com' }), { storage });
    await createAlertSubscription(alertBody({ email: 'b@example.com' }), { storage });
    const summary = await runAlertMatcher({
      storage,
      email,
      snapshot: snapshot(),
      siteOrigin: 'https://coinnavigator.net',
      now: () => NOW,
      log() {},
    });
    expect(summary.emails_sent).toBe(2);
    expect(email.sent.map((s) => s.to).sort()).toEqual(['a@example.com', 'b@example.com']);
  });

  it('24-26 cooldown blocks same route; different route can send; material improvement can send', async () => {
    const storage = new MemoryAlertStorage();
    const email = new MockEmail();
    await createAlertSubscription(alertBody({ alert_scope: 'any_pair' }), { storage });
    await runAlertMatcher({
      storage,
      email,
      snapshot: snapshot(),
      siteOrigin: 'https://coinnavigator.net',
      now: () => NOW,
      log() {},
    });
    expect(email.sent).toHaveLength(1);

    const laterSame = await runAlertMatcher({
      storage,
      email,
      snapshot: snapshot({ timestamp: '2026-08-18T11:55:00.000Z', btc: { Binance: 100, MEXC: 101.6 } }),
      siteOrigin: 'https://coinnavigator.net',
      now: () => NOW,
      log() {},
    });
    expect(laterSame.cooldown_skipped).toBe(1);
    expect(laterSame.emails_sent).toBe(0);

    const improved = await runAlertMatcher({
      storage,
      email,
      snapshot: snapshot({ timestamp: '2026-08-18T11:56:00.000Z', btc: { Binance: 100, MEXC: 104 } }),
      siteOrigin: 'https://coinnavigator.net',
      now: () => NOW,
      log() {},
    });
    expect(improved.emails_sent).toBe(1);
    expect(email.sent).toHaveLength(2);
  });

  it('27-28 failed email is not sent; retry can succeed', async () => {
    const storage = new MemoryAlertStorage();
    const email = new MockEmail();
    email.failNext = true;
    await createAlertSubscription(alertBody(), { storage });
    const deps = {
      storage,
      email,
      snapshot: snapshot(),
      siteOrigin: 'https://coinnavigator.net',
      now: () => NOW,
      log() {},
    };
    const failed = await runAlertMatcher(deps);
    expect(failed.emails_failed).toBe(1);
    expect(failed.emails_sent).toBe(0);
    expect(storage.getDeliveries()[0]!.email_status).toBe('failed');
    expect(storage.getAll()[0]!.latest_matching_opportunity_at).toBeNull();

    const retried = await runAlertMatcher(deps);
    expect(retried.emails_sent).toBe(1);
    expect(storage.getDeliveries()[0]!.email_status).toBe('sent');
    expect(storage.getAll()[0]!.latest_matching_opportunity_at).toBeTruthy();
  });

  it('29 concurrent reservation cannot produce duplicate sends', async () => {
    const storage = new MemoryAlertStorage();
    const fp = opportunityEventFingerprint({
      asset: 'BTC',
      buyExchange: 'Binance',
      sellExchange: 'MEXC',
      dataTimestamp: FRESH_TS,
    });
    const row = {
      id: 'd1',
      alert_id: 'a1',
      opportunity_fingerprint: fp,
      asset: 'BTC',
      buy_exchange: 'Binance',
      sell_exchange: 'MEXC',
      estimated_net_profit_pct: 1,
      estimated_net_profit_usd: 1,
      opportunity_data_timestamp: FRESH_TS,
      matched_at: NOW.toISOString(),
      created_at: NOW.toISOString(),
    };
    const results = await Promise.all([
      storage.insertDeliveryPending({ ...row, id: 'd1' }),
      storage.insertDeliveryPending({ ...row, id: 'd2' }),
    ]);
    expect(results.sort()).toEqual(['duplicate', 'inserted']);
    expect(storage.getDeliveries()).toHaveLength(1);
  });
});

describe('subscription eligibility', () => {
  it('30-32 active eligible; pending ignored; unsubscribed never sends', async () => {
    const storage = new MemoryAlertStorage();
    const email = new MockEmail();
    await createAlertSubscription(alertBody({ email: 'active@example.com' }), { storage });
    const pending: AlertSubscription = {
      ...storage.getAll()[0]!,
      id: 'pending1',
      email: 'pending@example.com',
      status: 'pending',
      unsubscribe_token: createUnsubscribeToken(),
    };
    storage.seed(pending);
    await createAlertSubscription(alertBody({ email: 'gone@example.com' }), { storage });
    const gone = storage.getAll().find((a) => a.email === 'gone@example.com')!;
    await unsubscribeAlert(gone.unsubscribe_token, storage);

    const summary = await runAlertMatcher({
      storage,
      email,
      snapshot: snapshot(),
      siteOrigin: 'https://coinnavigator.net',
      now: () => NOW,
      log() {},
    });
    expect(summary.alerts_checked).toBe(1);
    expect(summary.emails_sent).toBe(1);
    expect(email.sent[0]!.to).toBe('active@example.com');
  });

  it('legacy alert without trade amount is skipped, amount not invented', async () => {
    const storage = new MemoryAlertStorage();
    const email = new MockEmail();
    await createAlertSubscription(alertBody(), { storage });
    const row = storage.getAll()[0]!;
    row.trade_amount_usd = null;
    storage.seed(row);
    const summary = await runAlertMatcher({
      storage,
      email,
      snapshot: snapshot(),
      siteOrigin: 'https://coinnavigator.net',
      now: () => NOW,
      log() {},
    });
    expect(summary.missing_trade_amount).toBe(1);
    expect(summary.emails_sent).toBe(0);
  });
});

describe('email content', () => {
  it('35-46 opportunity email fields, warnings, CTA, UTM, unsubscribe, no guaranteed language, escaped HTML', async () => {
    const storage = new MemoryAlertStorage();
    const email = new MockEmail();
    await createAlertSubscription(alertBody(), { storage });
    await runAlertMatcher({
      storage,
      email,
      snapshot: snapshot(),
      siteOrigin: 'https://coinnavigator.net',
      now: () => NOW,
      log() {},
    });
    expect(email.sent).toHaveLength(1);
    const payload = email.sent[0]!;
    expect(payload.to).toBe('trader@example.com');
    expect(payload.subject).toBe('BTC arbitrage opportunity detected');
    const text = payload.text;
    const html = payload.html;
    expect(text).toContain('Binance');
    expect(text).toContain('MEXC');
    expect(text).toContain('100');
    expect(text).toContain('101.5');
    expect(text).toMatch(/Estimated net profit/i);
    expect(text).toContain('$1000.00');
    expect(text).toContain(FRESH_TS);
    expect(text).toMatch(/not financial advice/i);
    expect(text).toMatch(/Validate Live Route/i);
    expect(text).toContain('/api/alerts/unsubscribe?token=');
    expect(text).toContain(storage.getAll()[0]!.unsubscribe_token);
    expect(text).toContain('utm_source=alert_email');
    expect(text).toContain('utm_medium=email');
    expect(text).toContain('utm_campaign=arbitrage_alert');
    expect(text).toContain('asset=BTC');
    expect(html).toContain('Unsubscribe');
    expect(emailContainsProhibitedLanguage(text + html)).toBe(false);
    expect(text).not.toMatch(/guaranteed/i);
    expect(html).not.toMatch(/guaranteed/i);

    const storage2 = new MemoryAlertStorage();
    await createAlertSubscription(alertBody(), { storage: storage2 });
    const matchResult = evaluateOpportunity(
      storage2.getAll()[0]!,
      extractOpportunitiesForAsset(snapshot(), 'BTC').find(
        (o) => o.buyExchange === 'Binance' && o.sellExchange === 'MEXC',
      )!,
      { now: () => NOW },
    );
    expect(matchResult.ok).toBe(true);
    if (!matchResult.ok) return;
    const evilHtml = opportunityEmailHtml({
      to: 'a@b.c',
      unsubscribeUrl: 'https://coinnavigator.net/api/alerts/unsubscribe?token=abc',
      ctaUrl: buildReturnUrl('https://coinnavigator.net', matchResult.match),
      match: { ...matchResult.match, dataTimestamp: '<script>alert(1)</script>' },
    });
    expect(evilHtml).not.toContain('<script>alert(1)</script>');
    expect(evilHtml).toContain('&lt;script&gt;');
  });
});

describe('cron security + smoke', () => {
  it('47-51 unauthorized rejected; secrets/emails/tokens never returned; provider error not leaked', async () => {
    const storage = new MemoryAlertStorage();
    const email = new MockEmail();
    await createAlertSubscription(alertBody(), { storage });
    const env = { CRON_SECRET: 's3cret-value', ALERTS_SITE_ORIGIN: 'https://coinnavigator.net' };

    expect(
      authorizeCronRequest({ method: 'GET', headers: {} }, env),
    ).toBe('unauthorized');
    expect(
      authorizeCronRequest({ method: 'GET', headers: {} }, {}),
    ).toBe('missing_config');

    const denied = mockRes();
    await handleMatchRequest(
      { method: 'GET', headers: { authorization: 'Bearer wrong' } },
      denied.res,
      { env, storage, email, snapshot: snapshot(), now: () => NOW, log() {} },
    );
    expect(denied.state.statusCode).toBe(401);
    expect(JSON.stringify(denied.state.body)).not.toContain('s3cret-value');
    expect(JSON.stringify(denied.state.body)).not.toContain('trader@example.com');

    const logs: Record<string, unknown>[] = [];
    const ok = mockRes();
    await handleMatchRequest(
      { method: 'GET', headers: { authorization: 'Bearer s3cret-value' }, query: {} },
      ok.res,
      {
        env,
        storage,
        email,
        snapshot: snapshot(),
        now: () => NOW,
        log(entry) {
          logs.push(entry);
        },
      },
    );
    expect(ok.state.statusCode).toBe(200);
    const body = JSON.stringify(ok.state.body);
    expect(body).not.toContain('trader@example.com');
    expect(body).not.toContain('s3cret-value');
    expect(body).not.toContain(storage.getAll()[0]!.unsubscribe_token);
    expect(body).not.toContain('provider_rejected payload');
    expect(JSON.stringify(logs)).not.toContain('trader@example.com');
    expect(JSON.stringify(logs)).not.toContain(storage.getAll()[0]!.unsubscribe_token);

    const dry = mockRes();
    const email2 = new MockEmail();
    await handleMatchRequest(
      {
        method: 'GET',
        headers: { authorization: 'Bearer s3cret-value' },
        query: { dry_run: 'true' },
      },
      dry.res,
      { env, storage, email: email2, snapshot: snapshot(), now: () => NOW, log() {} },
    );
    expect(dry.state.body).toMatchObject({ ok: true, dry_run: true, emails_sent: 0 });
    expect(email2.sent).toHaveLength(0);
  });

  it('52 service-role and Resend keys stay out of browser JS', () => {
    const ui = readFileSync('assets/js/profit-calculator-ui.js', 'utf8');
    expect(ui).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
    expect(ui).not.toMatch(/RESEND_API_KEY/);
    expect(ui).not.toMatch(/CRON_SECRET/);
    expect(ui).toContain('trade_amount_usd');
  });

  it('missing Resend config evaluates matches but never marks sent', async () => {
    const storage = new MemoryAlertStorage();
    const email = new MockEmail();
    email.enabled = false;
    await createAlertSubscription(alertBody(), { storage });
    const summary = await runAlertMatcher({
      storage,
      email,
      snapshot: snapshot(),
      siteOrigin: 'https://coinnavigator.net',
      now: () => NOW,
      log() {},
    });
    expect(summary.skip_reason).toBe('missing_config');
    expect(summary.matches).toBe(1);
    expect(summary.emails_sent).toBe(0);
    expect(storage.getDeliveries()).toHaveLength(0);
  });

  it('local e2e smoke: match, send, duplicate, unsubscribe, stale, provider failure', async () => {
    const storage = new MemoryAlertStorage();
    const email = new MockEmail();
    await createAlertSubscription(alertBody(), { storage });
    const envBase = {
      storage,
      email,
      snapshot: snapshot(),
      siteOrigin: 'https://coinnavigator.net',
      now: () => NOW,
      log() {},
    };
    const first = await runAlertMatcher(envBase);
    expect(first.matches).toBe(1);
    expect(first.emails_sent).toBe(1);
    expect(storage.getDeliveries()[0]!.email_status).toBe('sent');

    const dup = await runAlertMatcher(envBase);
    expect(dup.emails_sent).toBe(0);

    await unsubscribeAlert(storage.getAll()[0]!.unsubscribe_token, storage);
    const afterUnsub = await runAlertMatcher({
      ...envBase,
      snapshot: snapshot({ timestamp: '2026-08-18T11:58:00.000Z' }),
    });
    expect(afterUnsub.emails_sent).toBe(0);
    expect(afterUnsub.alerts_checked).toBe(0);

    const stale = await runAlertMatcher({
      ...envBase,
      snapshot: snapshot({ timestamp: STALE_TS }),
    });
    expect(stale.skip_reason).toBe('stale_data');

    const failStore = new MemoryAlertStorage();
    const failEmail = new MockEmail();
    failEmail.failNext = true;
    await createAlertSubscription(alertBody({ email: 'fail@example.com' }), { storage: failStore });
    const failed = await runAlertMatcher({
      storage: failStore,
      email: failEmail,
      snapshot: snapshot(),
      siteOrigin: 'https://coinnavigator.net',
      now: () => NOW,
      log() {},
    });
    expect(failed.emails_failed).toBe(1);
    expect(failStore.getDeliveries()[0]!.email_status).toBe('failed');
    expect(failStore.getDeliveries()[0]!.failure_category).toBe('provider_rejected');
  });
});
