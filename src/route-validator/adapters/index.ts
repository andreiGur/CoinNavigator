import type { ExchangeAdapter } from './base.js';
import { UpstreamError } from './base.js';
import { binanceAdapter } from './binance.js';
import { bybitAdapter } from './bybit.js';
import { mexcAdapter } from './mexc.js';
import type { ValidatorExchange } from '../types.js';

const ADAPTERS: Record<ValidatorExchange, ExchangeAdapter> = {
  Binance: binanceAdapter,
  Bybit: bybitAdapter,
  MEXC: mexcAdapter,
};

export function getAdapter(exchange: ValidatorExchange): ExchangeAdapter {
  const adapter = ADAPTERS[exchange];
  if (!adapter) throw new UpstreamError('unsupported_exchange', 'unsupported');
  return adapter;
}

export { UpstreamError };
export type { ExchangeAdapter };
