import {
  MATERIAL_IMPROVEMENT_PCT_POINTS,
  ROUTE_COOLDOWN_MS,
} from './policies.js';
import type { AlertDelivery } from './types.js';
import type { QualifiedMatch } from './evaluate.js';

export type CooldownDecision =
  | { action: 'send'; reason: 'no_prior' | 'cooldown_expired' | 'material_improvement' }
  | { action: 'skip'; reason: 'cooldown' };

export function netPctRounded(n: number): string {
  return n.toFixed(2);
}

export function decideCooldown(
  lastSent: AlertDelivery | null,
  match: QualifiedMatch,
  nowMs: number,
): CooldownDecision {
  if (!lastSent || !lastSent.sent_at) {
    return { action: 'send', reason: 'no_prior' };
  }
  const sentMs = Date.parse(lastSent.sent_at);
  if (!Number.isFinite(sentMs)) {
    return { action: 'send', reason: 'no_prior' };
  }
  if (nowMs - sentMs >= ROUTE_COOLDOWN_MS) {
    return { action: 'send', reason: 'cooldown_expired' };
  }
  const prevPct =
    lastSent.estimated_net_profit_pct == null
      ? null
      : Number(lastSent.estimated_net_profit_pct);
  if (
    prevPct != null &&
    Number.isFinite(prevPct) &&
    match.estimatedNetProfitPct >= prevPct + MATERIAL_IMPROVEMENT_PCT_POINTS
  ) {
    return { action: 'send', reason: 'material_improvement' };
  }
  return { action: 'skip', reason: 'cooldown' };
}

export const STALE_PENDING_RETRY_MS = 10 * 60 * 1000;

export function shouldRetryExisting(existing: AlertDelivery, nowMs: number): boolean {
  if (existing.email_status === 'failed') return true;
  if (existing.email_status === 'pending') {
    const created = Date.parse(existing.created_at || existing.matched_at);
    if (!Number.isFinite(created)) return true;
    return nowMs - created >= STALE_PENDING_RETRY_MS;
  }
  return false;
}
