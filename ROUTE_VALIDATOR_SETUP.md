# Live Route Validator setup

Server-side MVP that answers: **Can this specific arbitrage route realistically be executed right now?**

## Endpoint

`POST /api/route-validator`

Built from `src/route-validator` → `api/route-validator/index.js` via:

```bash
npm run build:route-validator
```

## Environment variables

No private exchange API keys are required.

Optional (none required for MVP):

| Variable | Purpose |
|---|---|
| *(none)* | Public Binance / Bybit / MEXC market data only |

Existing alerts env vars (`SUPABASE_*`, etc.) are unrelated to this endpoint.

## Public upstream APIs used

| Exchange | Order book | Transfer metadata |
|---|---|---|
| Binance | `GET https://api.binance.com/api/v3/depth` | Not available without API key → **unavailable** |
| Bybit | `GET https://api.bybit.com/v5/market/orderbook?category=spot` | Not reliably public → **unavailable** |
| MEXC | `GET https://api.mexc.com/api/v3/depth` | Not reliably public → **unavailable** |

## Rate limits / caching

- Client IP rate limit: **20 requests / 60s** (in-memory, best-effort on serverless)
- Result cache TTL: **~8 seconds** for identical payloads
- Upstream timeout: **6 seconds** per exchange call

## Failure-mode checklist

1. Upstream timeout / HTTP error → `503 MARKET_DATA_UNAVAILABLE` (generic message)
2. Unsupported asset/exchange / same exchange → `400 VALIDATION_ERROR`
3. Transfer status missing → verdict `transfer_unverified` (never “potentially executable”)
4. Missing withdrawal fee → field **Unavailable** (not zero); user may override in Advanced costs after touching the field
5. Empty / thin book → `insufficient_liquidity`

## Deploy notes

1. `npm ci`
2. `npm run check`
3. Commit generated `api/route-validator/index.js`
4. Deploy to Vercel (existing `vercel.json` already routes `/api/*` and sets noindex/no-store)

No new Vercel function config is required beyond shipping the built handler.
