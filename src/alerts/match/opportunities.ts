import { normalizeAsset, normalizeExchange } from '../allowlist.js';
import type { SupportedAsset, SupportedExchange } from '../allowlist.js';

export interface SpreadSnapshot {
  timestamp: string;
  symbols: Record<string, SpreadSymbolRow | undefined>;
}

export interface SpreadSymbolRow {
  prices?: Record<string, number | null | undefined>;
  best_buy?: { exchange?: string; price?: number } | null;
  best_sell?: { exchange?: string; price?: number } | null;
  spread_percent?: number | null;
}

export interface OpportunityCandidate {
  asset: SupportedAsset;
  symbol: string;
  buyExchange: SupportedExchange;
  sellExchange: SupportedExchange;
  buyPrice: number;
  sellPrice: number;
  dataTimestamp: string;
}

export function parseSpreadSnapshot(raw: unknown): SpreadSnapshot | null {
  if (!raw || typeof raw !== 'object') return null;
  const body = raw as Record<string, unknown>;
  if (typeof body.timestamp !== 'string' || !body.timestamp.trim()) return null;
  if (!body.symbols || typeof body.symbols !== 'object') return null;
  const ts = Date.parse(body.timestamp);
  if (!Number.isFinite(ts)) return null;
  return {
    timestamp: body.timestamp,
    symbols: body.symbols as SpreadSnapshot['symbols'],
  };
}

export function snapshotAgeMs(snapshot: SpreadSnapshot, now = Date.now()): number {
  const ts = Date.parse(snapshot.timestamp);
  if (!Number.isFinite(ts)) return Number.POSITIVE_INFINITY;
  return Math.max(0, now - ts);
}

function validPrice(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0;
}

/**
 * All directed exchange pairs with valid prices for one asset.
 * Does not call exchanges — uses the shared snapshot only.
 */
export function extractOpportunitiesForAsset(
  snapshot: SpreadSnapshot,
  asset: SupportedAsset,
): OpportunityCandidate[] {
  const symbol = `${asset}USDT`;
  const row = snapshot.symbols[symbol];
  if (!row || typeof row !== 'object') return [];
  const prices = row.prices || {};
  const exchanges: SupportedExchange[] = [];
  const priceMap = new Map<SupportedExchange, number>();
  for (const [name, price] of Object.entries(prices)) {
    const ex = normalizeExchange(name);
    if (!ex || !validPrice(price)) continue;
    priceMap.set(ex, price);
    exchanges.push(ex);
  }
  const out: OpportunityCandidate[] = [];
  for (const buy of exchanges) {
    for (const sell of exchanges) {
      if (buy === sell) continue;
      const buyPrice = priceMap.get(buy);
      const sellPrice = priceMap.get(sell);
      if (!validPrice(buyPrice) || !validPrice(sellPrice)) continue;
      if (sellPrice <= buyPrice) continue;
      out.push({
        asset,
        symbol,
        buyExchange: buy,
        sellExchange: sell,
        buyPrice,
        sellPrice,
        dataTimestamp: snapshot.timestamp,
      });
    }
  }
  return out;
}

export function findExactPairOpportunity(
  snapshot: SpreadSnapshot,
  asset: SupportedAsset,
  buyExchange: SupportedExchange,
  sellExchange: SupportedExchange,
): OpportunityCandidate | null {
  return (
    extractOpportunitiesForAsset(snapshot, asset).find(
      (o) => o.buyExchange === buyExchange && o.sellExchange === sellExchange,
    ) ?? null
  );
}

export function normalizeAssetFromSymbol(symbol: string): SupportedAsset | null {
  return normalizeAsset(symbol);
}
