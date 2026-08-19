/**
 * Matcher policy constants — documented, testable, conservative MVP.
 */

/** Homepage snapshot refreshes ~every 15 min; matcher skips older than this. */
export const MATCHER_STALE_MS = 20 * 60 * 1000;

/**
 * When neither min % nor min USD is set, require at least this estimated net %.
 * Same default the Check Real Profit alert form uses (0.25%).
 * Never treat a missing threshold as 0%.
 */
export const DEFAULT_MIN_NET_PROFIT_PCT = 0.25;

/** Do not re-notify the same alert + route within this window unless material improvement. */
export const ROUTE_COOLDOWN_MS = 6 * 60 * 60 * 1000;

/** Extra send during cooldown only if estimated net % rises by at least this many percentage points. */
export const MATERIAL_IMPROVEMENT_PCT_POINTS = 0.5;

export const ALERT_BATCH_SIZE = 50;
export const EMAIL_CONCURRENCY = 2;

export const MIN_TRADE_AMOUNT_USD = 10;
export const MAX_TRADE_AMOUNT_USD = 100_000;
