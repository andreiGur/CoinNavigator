import Decimal from 'decimal.js';
import type { NetProfitInput } from './types.js';

Decimal.set({
  precision: 28,
  rounding: Decimal.ROUND_HALF_UP,
});

export { Decimal };

export function d(value: Decimal.Value): Decimal {
  return new Decimal(value);
}

export function toNumber(value: Decimal): number {
  return value.toNumber();
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export interface ValidationIssue {
  field: string;
  message: string;
}

/**
 * Rejects NaN / ±Infinity / non-numbers and applies domain rules.
 * Optional fields may be omitted; when present they must be valid.
 */
export function validateNetProfitInput(input: NetProfitInput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  function requireFinite(field: keyof NetProfitInput, value: unknown): void {
    if (!isFiniteNumber(value)) {
      issues.push({ field, message: `${field} must be a finite number` });
    }
  }

  function requirePositive(field: keyof NetProfitInput, value: number): void {
    if (!(value > 0)) {
      issues.push({ field, message: `${field} must be greater than zero` });
    }
  }

  function requireNonNegative(field: keyof NetProfitInput, value: number): void {
    if (value < 0) {
      issues.push({ field, message: `${field} must be >= 0` });
    }
  }

  requireFinite('investmentUsd', input.investmentUsd);
  requireFinite('buyPrice', input.buyPrice);
  requireFinite('sellPrice', input.sellPrice);
  requireFinite('buyTradingFeePct', input.buyTradingFeePct);
  requireFinite('sellTradingFeePct', input.sellTradingFeePct);
  requireFinite('withdrawalFeeAsset', input.withdrawalFeeAsset);
  requireFinite('buySlippagePct', input.buySlippagePct);
  requireFinite('sellSlippagePct', input.sellSlippagePct);

  if (issues.length > 0) return issues;

  requirePositive('investmentUsd', input.investmentUsd);
  requirePositive('buyPrice', input.buyPrice);
  requirePositive('sellPrice', input.sellPrice);
  requireNonNegative('buyTradingFeePct', input.buyTradingFeePct);
  requireNonNegative('sellTradingFeePct', input.sellTradingFeePct);
  requireNonNegative('withdrawalFeeAsset', input.withdrawalFeeAsset);
  requireNonNegative('buySlippagePct', input.buySlippagePct);
  requireNonNegative('sellSlippagePct', input.sellSlippagePct);

  if (typeof input.assetSymbol !== 'string' || input.assetSymbol.trim() === '') {
    issues.push({ field: 'assetSymbol', message: 'assetSymbol is required' });
  }
  if (typeof input.buyExchange !== 'string' || input.buyExchange.trim() === '') {
    issues.push({ field: 'buyExchange', message: 'buyExchange is required' });
  }
  if (typeof input.sellExchange !== 'string' || input.sellExchange.trim() === '') {
    issues.push({ field: 'sellExchange', message: 'sellExchange is required' });
  }

  if (input.networkFeeAsset !== undefined) {
    if (!isFiniteNumber(input.networkFeeAsset)) {
      issues.push({ field: 'networkFeeAsset', message: 'networkFeeAsset must be a finite number' });
    } else if (input.networkFeeAsset < 0) {
      issues.push({ field: 'networkFeeAsset', message: 'networkFeeAsset must be >= 0' });
    }
  }

  if (input.additionalCostUsd !== undefined) {
    if (!isFiniteNumber(input.additionalCostUsd)) {
      issues.push({ field: 'additionalCostUsd', message: 'additionalCostUsd must be a finite number' });
    } else if (input.additionalCostUsd < 0) {
      issues.push({ field: 'additionalCostUsd', message: 'additionalCostUsd must be >= 0' });
    }
  }

  return issues;
}
