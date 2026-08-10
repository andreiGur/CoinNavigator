import {
  MAX_TRADE_USD,
  MIN_TRADE_USD,
  normalizeValidatorAsset,
  normalizeValidatorExchange,
} from './symbols.js';
import type { RouteValidationRequest, ValidatorAsset, ValidatorExchange } from './types.js';

export type RequestValidationFailure = { ok: false; reason: string };
export type RequestValidationSuccess = {
  ok: true;
  value: {
    asset: ValidatorAsset;
    quote: 'USDT';
    buy_exchange: ValidatorExchange;
    sell_exchange: ValidatorExchange;
    trade_amount_usd: number;
    preferred_network: string | null;
    overrides: {
      buy_fee_pct: number | null;
      sell_fee_pct: number | null;
      withdrawal_fee_asset: number | null;
      network_fee_asset: number | null;
    };
  };
};

function optNum(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === '') return null;
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) ? n : Number.NaN;
}

export function validateRouteRequest(raw: unknown): RequestValidationFailure | RequestValidationSuccess {
  if (!raw || typeof raw !== 'object') return { ok: false, reason: 'invalid_payload' };
  const body = raw as Partial<RouteValidationRequest> & Record<string, unknown>;

  const assetRaw = normalizeValidatorAsset(body.asset);
  if (assetRaw === 'USDT') return { ok: false, reason: 'usdt_asset_unsupported' };
  if (!assetRaw) return { ok: false, reason: 'unsupported_asset' };

  const quote = typeof body.quote === 'string' ? body.quote.trim().toUpperCase() : 'USDT';
  if (quote !== 'USDT') return { ok: false, reason: 'unsupported_quote' };

  const buy = normalizeValidatorExchange(body.buy_exchange);
  const sell = normalizeValidatorExchange(body.sell_exchange);
  if (!buy || !sell) return { ok: false, reason: 'unsupported_exchange' };
  if (buy === sell) return { ok: false, reason: 'same_exchange' };

  const amount = optNum(body.trade_amount_usd);
  if (amount === null || Number.isNaN(amount) || amount < MIN_TRADE_USD || amount > MAX_TRADE_USD) {
    return { ok: false, reason: 'invalid_amount' };
  }

  const overridesRaw =
    body.overrides && typeof body.overrides === 'object'
      ? (body.overrides as Record<string, unknown>)
      : {};

  const buyFee = optNum(overridesRaw.buy_fee_pct);
  const sellFee = optNum(overridesRaw.sell_fee_pct);
  const wd = optNum(overridesRaw.withdrawal_fee_asset);
  const net = optNum(overridesRaw.network_fee_asset);
  for (const n of [buyFee, sellFee, wd, net]) {
    if (Number.isNaN(n) || (n != null && n < 0)) return { ok: false, reason: 'invalid_override' };
  }
  if (buyFee != null && buyFee > 5) return { ok: false, reason: 'invalid_override' };
  if (sellFee != null && sellFee > 5) return { ok: false, reason: 'invalid_override' };

  const preferred =
    typeof body.preferred_network === 'string' && body.preferred_network.trim()
      ? body.preferred_network.trim().slice(0, 32)
      : null;

  return {
    ok: true,
    value: {
      asset: assetRaw,
      quote: 'USDT',
      buy_exchange: buy,
      sell_exchange: sell,
      trade_amount_usd: amount,
      preferred_network: preferred,
      overrides: {
        buy_fee_pct: buyFee,
        sell_fee_pct: sellFee,
        withdrawal_fee_asset: wd,
        network_fee_asset: net,
      },
    },
  };
}
