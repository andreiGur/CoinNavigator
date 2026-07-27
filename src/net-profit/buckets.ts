/** Analytics bucketing — never send exact monetary amounts. */

export type AmountBucket =
  | 'under_100'
  | '100_499'
  | '500_999'
  | '1000_4999'
  | '5000_plus';

export function bucketAmountUsd(amount: number): AmountBucket {
  if (!Number.isFinite(amount) || amount < 100) return 'under_100';
  if (amount < 500) return '100_499';
  if (amount < 1000) return '500_999';
  if (amount < 5000) return '1000_4999';
  return '5000_plus';
}

export function bucketSpreadPct(spreadPct: number): string {
  if (!Number.isFinite(spreadPct)) return 'unknown';
  if (spreadPct < 0.1) return 'under_0_1';
  if (spreadPct < 0.3) return '0_1_0_3';
  if (spreadPct < 0.5) return '0_3_0_5';
  if (spreadPct < 1) return '0_5_1';
  return '1_plus';
}

export function bucketNetProfitUsd(net: number): string {
  if (!Number.isFinite(net)) return 'unknown';
  if (net < 0) return 'loss';
  if (net === 0) return 'zero';
  if (net < 1) return 'under_1';
  if (net < 10) return '1_9';
  if (net < 50) return '10_49';
  return '50_plus';
}
