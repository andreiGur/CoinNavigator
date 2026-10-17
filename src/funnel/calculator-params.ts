/** Validated calculator URL params (mirrored in assets/js/calculator-params.js). */

export type CalculatorQueryParams = {
  amount?: number;
  spread?: number;
  asset?: string;
  buyFee?: number;
  sellFee?: number;
  transfer?: number;
};

const ASSET_RE = /^[A-Za-z0-9]{2,12}$/;

function clampNum(n: number, min: number, max: number): number | undefined {
  if (!Number.isFinite(n)) return undefined;
  if (n < min || n > max) return undefined;
  return n;
}

function parseNumber(raw: string | null | undefined): number | undefined {
  if (raw == null || raw === '') return undefined;
  const n = Number(String(raw).trim());
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Parse and validate calculator query params.
 * Rejects out-of-range values instead of inventing prices.
 */
export function parseCalculatorParams(
  search: string | URLSearchParams
): CalculatorQueryParams {
  const q = typeof search === 'string' ? new URLSearchParams(search.replace(/^\?/, '')) : search;
  const out: CalculatorQueryParams = {};

  const amount = clampNum(parseNumber(q.get('amount')) ?? NaN, 1, 10_000_000);
  if (amount != null) out.amount = amount;

  const spread = clampNum(parseNumber(q.get('spread')) ?? NaN, 0, 10);
  if (spread != null) out.spread = spread;

  const buyFee = clampNum(parseNumber(q.get('buyFee') || q.get('buy_fee')) ?? NaN, 0, 2);
  if (buyFee != null) out.buyFee = buyFee;

  const sellFee = clampNum(parseNumber(q.get('sellFee') || q.get('sell_fee')) ?? NaN, 0, 2);
  if (sellFee != null) out.sellFee = sellFee;

  const transfer = clampNum(parseNumber(q.get('transfer')) ?? NaN, 0, 100);
  if (transfer != null) out.transfer = transfer;

  const assetRaw = (q.get('asset') || q.get('sym') || '').trim().toUpperCase();
  if (ASSET_RE.test(assetRaw)) out.asset = assetRaw;

  return out;
}

/** Build a calculator URL with only validated params (no invented spreads). */
export function buildCalculatorUrl(
  basePath: string,
  params: CalculatorQueryParams = {}
): string {
  const q = new URLSearchParams();
  if (params.asset) q.set('asset', params.asset);
  if (params.spread != null) q.set('spread', String(params.spread));
  if (params.amount != null) q.set('amount', String(params.amount));
  if (params.buyFee != null) q.set('buyFee', String(params.buyFee));
  if (params.sellFee != null) q.set('sellFee', String(params.sellFee));
  if (params.transfer != null) q.set('transfer', String(params.transfer));
  const qs = q.toString();
  const base = basePath || '/arbitrage-calculator/';
  return qs ? `${base}?${qs}` : base;
}
