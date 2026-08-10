/** Shared display / analytics helpers for live route validation (server + mirrored in UI). */

import type { RouteVerdict } from './types.js';
import { verdictLabel } from './verdict.js';

export { verdictLabel };

export function formatMaybeNumber(
  value: number | null | undefined,
  opts: { digits?: number; suffix?: string; unavailable?: string } = {},
): string {
  const unavailable = opts.unavailable ?? 'Unavailable';
  if (value == null || !Number.isFinite(value)) return unavailable;
  const digits = opts.digits ?? 4;
  return value.toFixed(digits) + (opts.suffix ?? '');
}

export function formatStatusBool(value: boolean | null | undefined): string {
  if (value === true) return 'Open (verified)';
  if (value === false) return 'Closed (verified)';
  return 'Unavailable';
}

export function latencyBucketMs(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return 'unknown';
  if (ms < 500) return 'under_500ms';
  if (ms < 1500) return '500_1499ms';
  if (ms < 3000) return '1500_2999ms';
  return '3000ms_plus';
}

export function netProfitBucketSafe(net: number | null | undefined): string {
  if (net == null || !Number.isFinite(net)) return 'unknown';
  if (net < 0) return 'negative';
  if (net < 1) return '0_1';
  if (net < 10) return '1_10';
  if (net < 50) return '10_50';
  return '50_plus';
}

/** Ensure analytics payloads never include exact money figures. */
export function sanitizeAnalyticsProps(props: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const blocked = /amount(?!_bucket)|profit(?!_bucket)|email|ip|order.?book|raw|token|secret/i;
  for (const [k, v] of Object.entries(props)) {
    if (blocked.test(k) && !/_bucket$/.test(k) && k !== 'fully_fillable' && k !== 'transfer_verified') {
      continue;
    }
    if (typeof v === 'number' && !Number.isInteger(v) && Math.abs(v) > 0 && Math.abs(v) < 1e-6) {
      continue;
    }
    out[k] = v;
  }
  return out;
}

export function qualifiedVerdictCopy(verdict: RouteVerdict): string {
  return verdictLabel(verdict);
}
