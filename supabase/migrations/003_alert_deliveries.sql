-- Durable opportunity email delivery / deduplication for the alert matcher.
-- Safe to re-run: IF NOT EXISTS throughout.

create table if not exists public.arbitrage_alert_deliveries (
  id text primary key,
  alert_id text not null references public.arbitrage_alerts (id) on delete cascade,
  opportunity_fingerprint text not null,
  asset text not null,
  buy_exchange text not null,
  sell_exchange text not null,
  estimated_net_profit_pct numeric null,
  estimated_net_profit_usd numeric null,
  opportunity_data_timestamp timestamptz null,
  matched_at timestamptz not null default now(),
  email_status text not null check (email_status in ('pending', 'sent', 'failed', 'skipped')),
  email_provider text null,
  provider_message_id text null,
  sent_at timestamptz null,
  failure_category text null,
  created_at timestamptz not null default now()
);

-- Concurrent matcher runs cannot insert the same event twice
create unique index if not exists arbitrage_alert_deliveries_alert_fp_uidx
  on public.arbitrage_alert_deliveries (alert_id, opportunity_fingerprint);

create index if not exists arbitrage_alert_deliveries_alert_id_idx
  on public.arbitrage_alert_deliveries (alert_id);

create index if not exists arbitrage_alert_deliveries_status_idx
  on public.arbitrage_alert_deliveries (email_status);

create index if not exists arbitrage_alert_deliveries_route_sent_idx
  on public.arbitrage_alert_deliveries (alert_id, asset, buy_exchange, sell_exchange, sent_at desc)
  where email_status = 'sent';

alter table public.arbitrage_alert_deliveries enable row level security;

-- No anon/authenticated policies => service role only.
comment on table public.arbitrage_alert_deliveries is
  'Matcher delivery log. Unique (alert_id, opportunity_fingerprint) prevents duplicate sends.';
