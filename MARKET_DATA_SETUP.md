# Market Data Gateway

Server-side path for homepage live market data. Browser code must never call exchange APIs directly.

## Endpoint

`GET /api/market-data`

Built from `src/market-data` → `api/market-data/index.js`:

```bash
npm run build:market-data
```

## Operations

| operation | Purpose |
|---|---|
| `spread_snapshot` | Live multi-exchange ticker snapshot for homepage fallback |
| `reference_price` | Single reference price (Binance BTC/USDT freshness check) |

## Fallback order (homepage)

1. Valid `data/spread_data.json` / `spread_data.json` (preferred when age ≤ 8 minutes)
2. `/api/market-data?operation=spread_snapshot` when snapshot missing, invalid, stale, or user clicks Refresh
3. Clear unavailable / keep last snapshot if gateway fails

## Cache

- `spread_snapshot`: ~10s TTL
- `reference_price`: ~8s TTL
- Errors: ~2s dampening only
- In-memory / best-effort on Vercel isolates

## Env vars

None. Public exchange endpoints only.

## CoinGecko

Browser still calls CoinGecko for decorative sparkline charts only. Not used for spreads, freshness, or profit math.
