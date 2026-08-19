import { createId } from '../tokens.js';
import type { EmailAdapter } from '../email.js';
import type { MatcherStorage } from '../storage.js';
import type { AlertSubscription } from '../types.js';
import { pickBestCandidate, type QualifiedMatch } from './evaluate.js';
import {
  opportunityEventFingerprint,
  opportunityImprovementFingerprint,
} from './fingerprint.js';
import {
  extractOpportunitiesForAsset,
  snapshotAgeMs,
  type SpreadSnapshot,
} from './opportunities.js';
import {
  buildReturnUrl,
  opportunityEmailHtml,
  opportunityEmailSubject,
  opportunityEmailText,
} from './opportunity-email.js';
import {
  ALERT_BATCH_SIZE,
  EMAIL_CONCURRENCY,
  MATCHER_STALE_MS,
} from './policies.js';
import { decideCooldown, netPctRounded, shouldRetryExisting } from './cooldown.js';
import type { MatcherRunSummary } from './types.js';

export interface RunMatcherDeps {
  storage: MatcherStorage;
  email: EmailAdapter;
  snapshot: SpreadSnapshot;
  siteOrigin: string;
  dryRun?: boolean;
  now?: () => Date;
  log?: (entry: Record<string, unknown>) => void;
}

function emptySummary(
  dryRun: boolean,
  skip: string | null,
  durationMs: number,
): MatcherRunSummary {
  return {
    ok: true,
    dry_run: dryRun,
    skip_reason: skip,
    alerts_checked: 0,
    opportunities_checked: 0,
    matches: 0,
    emails_sent: 0,
    emails_failed: 0,
    duplicates_skipped: 0,
    cooldown_skipped: 0,
    stale_data_skips: 0,
    missing_trade_amount: 0,
    duration_ms: durationMs,
  };
}

async function listAllActive(storage: MatcherStorage): Promise<AlertSubscription[]> {
  const out: AlertSubscription[] = [];
  let afterId: string | undefined;
  for (;;) {
    const opts = afterId
      ? { afterId, limit: ALERT_BATCH_SIZE }
      : { limit: ALERT_BATCH_SIZE };
    const batch = await storage.listActiveAlerts(opts);
    if (!batch.length) break;
    out.push(...batch);
    afterId = batch[batch.length - 1]!.id;
    if (batch.length < ALERT_BATCH_SIZE) break;
  }
  return out;
}

async function mapPool<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  if (!items.length) return;
  let i = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (i < items.length) {
      const idx = i;
      i += 1;
      await fn(items[idx]!);
    }
  });
  await Promise.all(workers);
}

function unsubscribeUrl(origin: string, token: string): string {
  return `${origin.replace(/\/$/, '')}/api/alerts/unsubscribe?token=${token}`;
}

export async function runAlertMatcher(deps: RunMatcherDeps): Promise<MatcherRunSummary> {
  const started = Date.now();
  const dryRun = Boolean(deps.dryRun);
  const nowFn = deps.now ?? (() => new Date());
  const log = deps.log ?? ((entry) => console.log(JSON.stringify(entry)));
  const runId = createId();

  const age = snapshotAgeMs(deps.snapshot, nowFn().getTime());
  if (age > MATCHER_STALE_MS) {
    const summary = emptySummary(dryRun, 'stale_data', Date.now() - started);
    summary.stale_data_skips = 1;
    log({
      event: 'alert_matcher_run',
      run_id: runId,
      dry_run: dryRun,
      skip_reason: 'stale_data',
      snapshot_age_ms: age,
      duration_ms: summary.duration_ms,
    });
    return summary;
  }

  const alerts = await listAllActive(deps.storage);
  const summary: MatcherRunSummary = {
    ok: true,
    dry_run: dryRun,
    skip_reason: !dryRun && !deps.email.isEnabled() ? 'missing_config' : null,
    alerts_checked: alerts.length,
    opportunities_checked: 0,
    matches: 0,
    emails_sent: 0,
    emails_failed: 0,
    duplicates_skipped: 0,
    cooldown_skipped: 0,
    stale_data_skips: 0,
    missing_trade_amount: 0,
    duration_ms: 0,
  };

  type WorkItem = { alert: AlertSubscription; match: QualifiedMatch };
  const work: WorkItem[] = [];
  const oppCache = new Map<string, ReturnType<typeof extractOpportunitiesForAsset>>();

  for (const alert of alerts) {
    if (alert.trade_amount_usd == null) {
      summary.missing_trade_amount += 1;
      continue;
    }
    let candidates = oppCache.get(alert.asset);
    if (!candidates) {
      candidates = extractOpportunitiesForAsset(deps.snapshot, alert.asset);
      oppCache.set(alert.asset, candidates);
      summary.opportunities_checked += candidates.length;
    }
    const evaluated = pickBestCandidate(alert, candidates, { now: nowFn });
    if (!evaluated.ok) continue;
    summary.matches += 1;
    work.push({ alert, match: evaluated.match });
  }

  await mapPool(work, EMAIL_CONCURRENCY, async ({ alert, match }) => {
    const now = nowFn();
    const nowMs = now.getTime();
    const eventFp = opportunityEventFingerprint({
      asset: match.asset,
      buyExchange: match.buyExchange,
      sellExchange: match.sellExchange,
      dataTimestamp: match.dataTimestamp,
    });

    const existingEvent = await deps.storage.getDelivery(alert.id, eventFp);
    if (existingEvent && !shouldRetryExisting(existingEvent, nowMs)) {
      summary.duplicates_skipped += 1;
      return;
    }

    const lastSent = await deps.storage.getLastSentForRoute(
      alert.id,
      match.asset,
      match.buyExchange,
      match.sellExchange,
    );
    const cooldown = decideCooldown(lastSent, match, nowMs);
    if (!existingEvent && cooldown.action === 'skip') {
      summary.cooldown_skipped += 1;
      return;
    }

    const fingerprint =
      !existingEvent && cooldown.reason === 'material_improvement'
        ? opportunityImprovementFingerprint({
            asset: match.asset,
            buyExchange: match.buyExchange,
            sellExchange: match.sellExchange,
            netPctRounded: netPctRounded(match.estimatedNetProfitPct),
          })
        : eventFp;

    if (dryRun || !deps.email.isEnabled()) return;

    const existing = existingEvent ?? (await deps.storage.getDelivery(alert.id, fingerprint));
    let deliveryId: string;
    if (existing) {
      if (!shouldRetryExisting(existing, nowMs)) {
        summary.duplicates_skipped += 1;
        return;
      }
      deliveryId = existing.id;
    } else {
      deliveryId = createId();
      const reserved = await deps.storage.insertDeliveryPending({
        id: deliveryId,
        alert_id: alert.id,
        opportunity_fingerprint: fingerprint,
        asset: match.asset,
        buy_exchange: match.buyExchange,
        sell_exchange: match.sellExchange,
        estimated_net_profit_pct: match.estimatedNetProfitPct,
        estimated_net_profit_usd: match.estimatedNetProfitUsd,
        opportunity_data_timestamp: match.dataTimestamp,
        matched_at: match.matchedAt,
        created_at: now.toISOString(),
      });
      if (reserved === 'duplicate') {
        summary.duplicates_skipped += 1;
        return;
      }
    }

    const origin = deps.siteOrigin.replace(/\/$/, '');
    const emailPayload = {
      to: alert.email,
      unsubscribeUrl: unsubscribeUrl(origin, alert.unsubscribe_token),
      ctaUrl: buildReturnUrl(origin, match),
      match,
    };
    const sent = await deps.email.sendOpportunityEmail({
      to: alert.email,
      subject: opportunityEmailSubject(match),
      text: opportunityEmailText(emailPayload),
      html: opportunityEmailHtml(emailPayload),
    });

    if (sent.status === 'queued') {
      await deps.storage.markDeliverySent(deliveryId, {
        sentAt: now.toISOString(),
        provider: sent.provider || 'resend',
        providerMessageId: sent.messageId,
      });
      await deps.storage.updateLatestMatchingOpportunity(alert.id, match.matchedAt);
      summary.emails_sent += 1;
      return;
    }

    await deps.storage.markDeliveryFailed(
      deliveryId,
      sent.failureCategory || 'provider_unavailable',
    );
    summary.emails_failed += 1;
  });

  summary.duration_ms = Date.now() - started;
  log({
    event: 'alert_matcher_run',
    run_id: runId,
    dry_run: dryRun,
    alerts_checked: summary.alerts_checked,
    opportunities_checked: summary.opportunities_checked,
    matches: summary.matches,
    emails_sent: summary.emails_sent,
    emails_failed: summary.emails_failed,
    duplicates_skipped: summary.duplicates_skipped,
    cooldown_skipped: summary.cooldown_skipped,
    stale_data_skips: summary.stale_data_skips,
    missing_trade_amount: summary.missing_trade_amount,
    skip_reason: summary.skip_reason,
    duration_ms: summary.duration_ms,
  });
  return summary;
}
