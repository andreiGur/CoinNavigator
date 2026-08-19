import { createHash } from 'node:crypto';
import type { SupportedAsset, SupportedExchange } from '../allowlist.js';

export function opportunityEventFingerprint(input: {
  asset: SupportedAsset;
  buyExchange: SupportedExchange;
  sellExchange: SupportedExchange;
  dataTimestamp: string;
}): string {
  const raw = [
    'event',
    input.asset,
    input.buyExchange,
    input.sellExchange,
    input.dataTimestamp,
  ].join('|');
  return createHash('sha256').update(raw).digest('hex').slice(0, 40);
}

export function opportunityImprovementFingerprint(input: {
  asset: SupportedAsset;
  buyExchange: SupportedExchange;
  sellExchange: SupportedExchange;
  netPctRounded: string;
}): string {
  const raw = [
    'improve',
    input.asset,
    input.buyExchange,
    input.sellExchange,
    input.netPctRounded,
  ].join('|');
  return createHash('sha256').update(raw).digest('hex').slice(0, 40);
}
