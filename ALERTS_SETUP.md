# Arbitrage Opportunity Alerts — Production Setup

MVP status: **collect + store subscriptions**. Opportunity delivery emails are **not** sent in this release.

Confirmation email (Resend) remains optional and **disabled** unless `RESEND_API_KEY` is set. The UI never claims that an email was sent.

## Architecture

- Frontend CTA inside Check Real Profit (`assets/js/profit-calculator-ui.js`)
- API: `POST /api/alerts`, `GET|POST /api/alerts/unsubscribe`
- Storage: Supabase table `arbitrage_alerts` via service-role REST (server only)
- Email (optional): Resend confirmation adapter — not required for create

## 1) Create Supabase project + run migration

1. Create a project at https://supabase.com
2. Open **SQL Editor**
3. Paste and run `supabase/migrations/001_arbitrage_alerts.sql`
4. Confirm table `public.arbitrage_alerts` exists
5. Confirm **RLS is enabled** and there are **no policies** for `anon` / `authenticated`

The Vercel function uses the **service role** key. Browser clients must never receive that key.

## 2) Vercel environment variables (exact)

In the Vercel project for CoinNavigator → **Settings → Environment Variables** → add for **Production** (and Preview if desired):

| Variable | Required | Example / notes |
|----------|----------|-----------------|
| `SUPABASE_URL` | **Yes** | `https://YOUR_PROJECT.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | **Yes** | Supabase → Settings → API → `service_role` (secret) |
| `ALERTS_SITE_ORIGIN` | Recommended | `https://coinnavigator.net` |
| `RESEND_API_KEY` | No — leave unset | Opportunity emails stay off; confirmation adapter stays disabled |
| `ALERTS_FROM_EMAIL` | No | Only used if Resend is enabled later |

Then **Redeploy** the Production deployment (Deployments → … → Redeploy) so functions pick up the new env.

### Without Supabase env

`POST /api/alerts` returns HTTP **503**:

```json
{
  "ok": false,
  "error": {
    "code": "MISSING_CONFIG",
    "message": "Alert storage is temporarily unavailable."
  }
}
```

No configuration details are exposed.

## 3) Verify after deploy

```bash
# Expect 503 MISSING_CONFIG until Supabase env is set; then 201 created
curl -s -X POST https://coinnavigator.net/api/alerts \
  -H 'content-type: application/json' \
  -d '{
    "email":"you@example.com",
    "asset":"BTC",
    "buy_exchange":"Binance",
    "sell_exchange":"MEXC",
    "alert_scope":"exact_pair",
    "minimum_net_profit_pct":0.35,
    "minimum_net_profit_usd":null,
    "source_page":"home",
    "source_context":"check_real_profit",
    "consent":true,
    "consent_version":"alerts-v1-2026-08-04",
    "website":""
  }'
```

Browser checklist:

1. Open https://coinnavigator.net (incognito)
2. Check Real Profit → Alert me about similar opportunities
3. Invalid email / missing consent → errors
4. Valid submit → **Alert created** (no “email sent” claim)
5. Row in Supabase: lowercase email, `consent_version`, unique `unsubscribe_token`, `status=active`
6. Duplicate submit → `already_exists` / success without second active row
7. Unsubscribe URL with token → success; repeat → already unsubscribed

## Email delivery status

| Condition | Behavior |
|-----------|----------|
| `RESEND_API_KEY` missing | `email_delivery: "disabled"` — UI does not claim a confirmation email |
| Key present | Adapter may queue a confirmation email only; still no opportunity matcher |

## Known limitations

- No alert matcher / scheduler yet (collection-only MVP)
- Rate limiting is per serverless instance (best-effort)
- Without Supabase env vars, API returns `MISSING_CONFIG` (503)

## Recommended next product task

Build a matcher job that reads `spread_data.json` + active alerts and sends qualified notifications through one email provider.
