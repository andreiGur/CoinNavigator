# Net Profit Calculation Engine

Pure TypeScript engine for estimating whether a cross-exchange spot arbitrage
trade is realistically profitable after fees, withdrawal, slippage, and extras.

## Usage (Node / tests)

```ts
import { calculateNetProfit, getEstimatedTakerFeePct } from './src/net-profit/index.js';

const buyFee = getEstimatedTakerFeePct('Binance'); // may be null — do not invent 0.1%
const result = calculateNetProfit({
  investmentUsd: 1000,
  buyExchange: 'Binance',
  sellExchange: 'MEXC',
  assetSymbol: 'BTC',
  buyPrice: 65000,
  sellPrice: 65200,
  buyTradingFeePct: buyFee ?? 0.1, // caller chooses fallback explicitly
  sellTradingFeePct: 0.05,
  withdrawalFeeAsset: 0.0005,
  buySlippagePct: 0.05,
  sellSlippagePct: 0.05,
});
```

## Browser

Built IIFE: `/assets/js/net-profit-engine.js`

```html
<script src="/assets/js/net-profit-engine.js"></script>
<script>
  const r = CoinNavigatorNetProfit.calculateNetProfit({ /* ... */ });
</script>
```

## Scripts

- `npm run typecheck`
- `npm test`
- `npm run build:engine`
- `npm run check`
