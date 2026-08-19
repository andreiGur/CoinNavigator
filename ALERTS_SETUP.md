# Arbitrage Opportunity Alerts + Matcher — Production Setup

CoinNavigator can collect alert subscriptions **and** email qualified opportunities from the shared `spread_data.json` snapshot.

This is **candidate detection**, not live execution. The email tells the subscriber to open CoinNavigator and run **Validate Live Route** before trading.

## Architecture

- Frontend CTA inside Check Real Profit (`assets/js/profit-calculator-ui.js`)
- `POST /api/alerts` creates/reactivates subscriptions
- `GET|POST /api/alerts/unsubscribe?token=` (existing token; idempotent)
- `GET|POST /api/alerts/match` — protected matcher (cron / GitHub Actions)
- Storage: Supabase `arbitrage_alerts` + `arbitrage_alert_deliveries` via **service role only**
- Opportunity source: shared `data/spread_data.json` (never per-alert exchange calls, never Live Route Validator)
- Net profit: existing `src/net-profit` engine (estimated VIP0 taker fees)
- Email: Resend, one recipient per send, unsubscribe link on every opportunity email

## Matching rules (do not change silently)

| Scope | Behavior |
| --- | --- |
| `exact_pair` | Only the stored buy/sell route for that asset |
| `any_pair` | Any supported buy/sell pair for that asset; **one email** for the **best** estimated net % |

Thresholds:

- Only `%` set → estimated net `%` must be ≥ that value
- Only USD set → estimated net USD must be ≥ that value
- Both set → **both** must pass
- Neither set → require **≥ 0.25% estimated net** (same floor as the Check Real Profit alert form). This is **not** a hidden 0% alert.
- Explicit `0` is allowed if the subscriber stored it

Trade amount:

- New subscriptions **require** `trade_amount_usd` ($10–$100,000), taken from Check Real Profit `calc-amount`
- Legacy rows with `NULL` trade amount are **skipped** (matcher will not invent $100 / $1,000)

Freshness:

- Snapshot older than **20 minutes** → no emails, `skip_reason: stale_data`, no delivery rows marked sent
- Homepage live fallback is 8 minutes; matcher is looser because the Python snapshot refreshes every ~15 minutes plus deploy lag

Dedup / cooldown:

- Fingerprint: `asset + buy + sell + snapshot timestamp` (hashed; **no email**)
- Unique `(alert_id, opportunity_fingerprint)` prevents concurrent double-sends
- Route cooldown: **6 hours** after a **sent** email for the same alert + route
- Material improvement exception: estimated net `%` ≥ last sent `%` + **0.50** percentage points
- `latest_matching_opportunity_at` updates **only after Resend accepts** the message

## 1) Supabase — run these NEW migrations (do not edit `001`)

`001_arbitrage_alerts.sql` is already applied in production. **Do not re-run or edit it.**

1. Open Supabase → **SQL Editor**
2. Paste and run `supabase/migrations/002_alert_trade_amount.sql`
3. Paste and run `supabase/migrations/003_alert_deliveries.sql`
4. Confirm:
   - `arbitrage_alerts.trade_amount_usd` exists (nullable)
   - table `public.arbitrage_alert_deliveries` exists
   - RLS enabled on both tables
   - **no** `anon` / `authenticated` policies

## 2) Resend (manual)

Do not put real API keys in git.

1. Create or log in at https://resend.com
2. Add domain `coinnavigator.net`
3. Add the DNS records Resend shows (typically SPF, DKIM, and MX/verification as instructed)
4. Wait until the domain is **Verified**
5. Create an API key (sending access only)
6. Recommended sender: `CoinNavigator Alerts <alerts@coinnavigator.net>`

Until the key is on Vercel, the matcher evaluates matches but **does not send** (`skip_reason: missing_config`).

## 3) Vercel environment variables

Production (and Preview if you want matcher tests there):

| Variable | Required | Notes |
| --- | --- | --- |
| `SUPABASE_URL` | Yes | Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service role. **Never** in browser code |
| `ALERTS_SITE_ORIGIN` | Yes | `https://coinnavigator.net` — unsubscribe + CTA origin |
| `CRON_SECRET` | Yes | Long random secret. Matcher returns 401 without a matching `Authorization: Bearer` header. 503 if unset |
| `RESEND_API_KEY` | Yes for sending | Leave unset until domain is verified if you only want dry-run |
| `ALERTS_FROM_EMAIL` | Recommended | `CoinNavigator Alerts <alerts@coinnavigator.net>` |

Then **Redeploy** Production so serverless functions pick up env vars.

## 4) GitHub Actions scheduler

Primary schedule: **minute 5, 20, 35, 50** every hour (`5,20,35,50 * * * *`), ~5 minutes after `spread_data.json` refresh (`*/15`).

Add repository secrets:

| Secret | Value |
| --- | --- |
| `CRON_SECRET` | **Same value** as Vercel `CRON_SECRET` |
| `ALERT_MATCHER_URL` | Optional. Defaults to `https://coinnavigator.net/api/alerts/match` |

Workflow: `.github/workflows/alert_matcher.yml`  
Manual dry-run: Actions → **Alert matcher** → Run workflow → `dry_run` = true.

Vercel Cron is **not** enabled in `vercel.json` (Hobby plans often allow only a daily cron and would fail deploy). GitHub Actions is the scheduler.

## 5) Dry-run (authorized only)

```bash
curl -sS -H "Authorization: Bearer $CRON_SECRET" \
  "https://coinnavigator.net/api/alerts/match?dry_run=1"
```

Dry-run loads alerts, evaluates the snapshot, returns counts, **does not send email**, **does not mark deliveries sent**.

Unauthorized callers get a generic `401`. The JSON never includes emails, tokens, or secrets.

## Measurement (privacy-safe)

No subscriber emails are sent to GA4.

| Step | How it is measured |
| --- | --- |
| `alert_created` | Existing frontend event (no email property) |
| `alert_email_sent` | Supabase `arbitrage_alert_deliveries.email_status = sent` |
| `alert_email_return` | CTA UTMs: `utm_source=alert_email&utm_medium=email&utm_campaign=arbitrage_alert` |
| `live_route_validation_started` | Existing Validate Live Route client event |
| `affiliate_exchange_clicked` | Existing affiliate click tracking |

## Known limitations

- Matcher uses the shared snapshot, not live order books
- Withdrawal/network fees are **unavailable** (not treated as verified zero); copy says **estimated** net profit
- Legacy alerts without `trade_amount_usd` never match until the user recreates the alert
- Bybit prices are often missing in the snapshot; those routes simply do not match
- Rate limits on create/unsubscribe remain per-instance
