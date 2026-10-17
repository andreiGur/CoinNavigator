import { describe, expect, it } from 'vitest';
import { buildCalculatorUrl, parseCalculatorParams } from './calculator-params.js';

describe('parseCalculatorParams', () => {
  it('accepts valid asset and spread', () => {
    expect(parseCalculatorParams('?asset=BTC&spread=0.35')).toEqual({
      asset: 'BTC',
      spread: 0.35,
    });
  });

  it('accepts sym alias and fee fields', () => {
    expect(parseCalculatorParams('sym=eth&buyFee=0.1&sell_fee=0.075&amount=2500&transfer=1.5')).toEqual({
      asset: 'ETH',
      buyFee: 0.1,
      sellFee: 0.075,
      amount: 2500,
      transfer: 1.5,
    });
  });

  it('rejects out-of-range and invalid values', () => {
    expect(parseCalculatorParams('?spread=99&amount=-1&asset=!!&buyFee=5')).toEqual({});
    expect(parseCalculatorParams('?asset=toolongsymbolx')).toEqual({});
  });

  it('does not invent missing spread or prices', () => {
    expect(parseCalculatorParams('?asset=SOL')).toEqual({ asset: 'SOL' });
  });
});

describe('buildCalculatorUrl', () => {
  it('omits empty query', () => {
    expect(buildCalculatorUrl('/arbitrage-calculator/')).toBe('/arbitrage-calculator/');
  });

  it('encodes only provided validated fields', () => {
    expect(buildCalculatorUrl('/arbitrage-calculator/', { asset: 'BTC', spread: 0.4 })).toBe(
      '/arbitrage-calculator/?asset=BTC&spread=0.4'
    );
  });
});
