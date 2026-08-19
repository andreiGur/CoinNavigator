-- Optional trade amount used for estimated net profit USD on opportunity emails.
-- Backward compatible: existing rows remain NULL.
-- Matcher skips alerts with NULL trade_amount_usd (does not invent $100 / $1,000).

alter table public.arbitrage_alerts
  add column if not exists trade_amount_usd numeric null;

comment on column public.arbitrage_alerts.trade_amount_usd is
  'USD notional used for estimated net profit. NULL = legacy alert; matcher will not invent an amount.';

create index if not exists arbitrage_alerts_trade_amount_idx
  on public.arbitrage_alerts (trade_amount_usd)
  where trade_amount_usd is not null;

-- Same bounds as Live Route Validator. NULL remains valid for legacy rows.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'arbitrage_alerts_trade_amount_usd_chk'
  ) then
    alter table public.arbitrage_alerts
      add constraint arbitrage_alerts_trade_amount_usd_chk
      check (
        trade_amount_usd is null
        or (trade_amount_usd >= 10 and trade_amount_usd <= 100000)
      );
  end if;
end $$;
