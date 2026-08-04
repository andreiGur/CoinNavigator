-- CoinNavigator arbitrage opportunity alerts
-- Run in Supabase SQL editor (or via CLI) before enabling the API in production.
-- Safe to re-run: uses IF NOT EXISTS throughout.

create table if not exists public.arbitrage_alerts (
  id text primary key,
  email text not null,
  asset text not null,
  buy_exchange text null,
  sell_exchange text null,
  alert_scope text not null check (alert_scope in ('exact_pair', 'any_pair')),
  minimum_net_profit_pct numeric null,
  minimum_net_profit_usd numeric null,
  source_page text not null default 'home',
  source_context text not null default 'check_real_profit',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status text not null check (status in ('pending', 'active', 'unsubscribed')),
  unsubscribe_token text not null unique,
  consent_version text not null,
  user_agent_hash text null,
  latest_matching_opportunity_at timestamptz null
);

-- Duplicate / lookup helpers (email is stored lowercase by the API)
create index if not exists arbitrage_alerts_email_idx
  on public.arbitrage_alerts (email);

create index if not exists arbitrage_alerts_status_idx
  on public.arbitrage_alerts (status);

create index if not exists arbitrage_alerts_asset_idx
  on public.arbitrage_alerts (asset);

create index if not exists arbitrage_alerts_alert_scope_idx
  on public.arbitrage_alerts (alert_scope);

create index if not exists arbitrage_alerts_buy_exchange_idx
  on public.arbitrage_alerts (buy_exchange);

create index if not exists arbitrage_alerts_sell_exchange_idx
  on public.arbitrage_alerts (sell_exchange);

create index if not exists arbitrage_alerts_email_status_idx
  on public.arbitrage_alerts (email, status);

-- Active duplicate detection: email + asset + scope + pair
create index if not exists arbitrage_alerts_active_match_idx
  on public.arbitrage_alerts (email, asset, alert_scope, buy_exchange, sell_exchange)
  where status in ('pending', 'active');

-- Future matcher: active alerts by asset / last match time
create index if not exists arbitrage_alerts_active_asset_idx
  on public.arbitrage_alerts (asset, status)
  where status in ('pending', 'active');

create index if not exists arbitrage_alerts_latest_match_idx
  on public.arbitrage_alerts (latest_matching_opportunity_at);

create unique index if not exists arbitrage_alerts_unsubscribe_token_uidx
  on public.arbitrage_alerts (unsubscribe_token);

-- Service role key is used by the Vercel function. Keep RLS enabled and deny anon/authenticated.
alter table public.arbitrage_alerts enable row level security;

-- No policies for anon/authenticated => only service role can access.
comment on table public.arbitrage_alerts is
  'MVP alert subscriptions collected from Check Real Profit. Email delivery is optional and separate.';
