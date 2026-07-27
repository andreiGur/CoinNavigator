import type { ProfitVerdict } from './types.js';

const VERDICT_LABELS: Record<ProfitVerdict, string> = {
  profitable: 'Potentially profitable',
  marginal: 'Marginal opportunity',
  not_profitable: 'Not profitable after costs',
  invalid: 'Cannot calculate',
};

export function verdictLabel(verdict: ProfitVerdict): string {
  return VERDICT_LABELS[verdict];
}

/** Format USD for display — handles tiny and large values. */
export function formatUsd(value: number, signed = false): string {
  if (!Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  let body: string;
  if (abs === 0) body = '0.00';
  else if (abs < 0.01) body = abs.toFixed(6);
  else if (abs < 10) body = abs.toFixed(4);
  else if (abs < 1000) body = abs.toFixed(2);
  else body = abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const sign = signed ? (value > 0 ? '+' : value < 0 ? '−' : '') : value < 0 ? '−' : '';
  return `${sign}$${body}`;
}

export function formatPct(value: number, signed = false): string {
  if (!Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  const body = abs < 0.001 ? abs.toFixed(6) : abs.toFixed(4);
  const sign = signed ? (value > 0 ? '+' : value < 0 ? '−' : '') : value < 0 ? '−' : '';
  return `${sign}${body}%`;
}

export function formatQty(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  if (abs === 0) return '0';
  if (abs < 0.0001) return abs.toExponential(2);
  if (abs < 1) return abs.toFixed(6);
  if (abs < 1000) return abs.toFixed(4);
  return abs.toLocaleString('en-US', { maximumFractionDigits: 4 });
}

/** Parse a form field; returns null for empty/invalid (does not coerce to 0). */
export function parseOptionalNumber(raw: string): number | null {
  const t = (raw || '').trim();
  if (t === '') return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return n;
}

export function isNonNegativeNumber(n: number | null): n is number {
  return n !== null && Number.isFinite(n) && n >= 0;
}

export function isPositiveNumber(n: number | null): n is number {
  return n !== null && Number.isFinite(n) && n > 0;
}
