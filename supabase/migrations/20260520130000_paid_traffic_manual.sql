-- A4 — CAC/LTV via entrada manual quando OAuth direto não está disponível.
--
-- Nem sempre o cliente conecta Meta/Google Ads pelo OAuth (conta gerenciada,
-- restrições, MCP indisponível). Para ainda calcular CAC/LTV nessas orgs,
-- o consultor Pinn lança o gasto mensal manualmente. As entradas convivem
-- com os dados de `paid_traffic_campaigns` (vindos do OAuth) — a view abaixo
-- consolida ambos.

create table if not exists public.paid_traffic_manual_entries (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  channel     text not null,                              -- 'meta_ads' | 'google_ads' | 'tiktok' | 'linkedin' | 'outro'
  period_start date not null,
  period_end   date not null,
  spend        numeric not null default 0,
  impressions  numeric,
  clicks       numeric,
  conversions  numeric,
  notes        text,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check (period_end >= period_start),
  check (spend >= 0)
);

create index if not exists idx_paid_manual_org_period
  on public.paid_traffic_manual_entries (org_id, period_start desc);

comment on table public.paid_traffic_manual_entries is
  'Lançamentos manuais de gasto de mídia para orgs sem OAuth direto. Usado como fallback no cálculo de CAC/LTV.';

alter table public.paid_traffic_manual_entries enable row level security;

drop policy if exists "paid_manual_select_org" on public.paid_traffic_manual_entries;
create policy "paid_manual_select_org" on public.paid_traffic_manual_entries
  for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.org_id = paid_traffic_manual_entries.org_id
    )
    or public.is_platform_admin(auth.uid())
  );

drop policy if exists "paid_manual_write_admin" on public.paid_traffic_manual_entries;
create policy "paid_manual_write_admin" on public.paid_traffic_manual_entries
  for all to authenticated
  using (
    public.is_platform_admin(auth.uid())
    or exists (
      select 1 from public.profiles p
      join public.user_roles ur on ur.user_id = p.user_id
      where p.id = auth.uid()
        and p.org_id = paid_traffic_manual_entries.org_id
        and ur.role = 'client_admin'
    )
  )
  with check (
    public.is_platform_admin(auth.uid())
    or exists (
      select 1 from public.profiles p
      join public.user_roles ur on ur.user_id = p.user_id
      where p.id = auth.uid()
        and p.org_id = paid_traffic_manual_entries.org_id
        and ur.role = 'client_admin'
    )
  );

create or replace function public.touch_paid_manual()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_touch_paid_manual on public.paid_traffic_manual_entries;
create trigger trg_touch_paid_manual
  before update on public.paid_traffic_manual_entries
  for each row execute function public.touch_paid_manual();

-- ── View consolidada: OAuth + manual ──────────────────────────────────────────
-- Lê de paid_traffic_daily_metrics (OAuth) e da nova tabela manual. "conversions"
-- mapeia para `purchases` (vendas atribuídas) com fallback em `leads` quando
-- a plataforma não traz purchases (ex: campanha de geração de lead).
create or replace view public.vw_paid_traffic_unified as
  select
    d.org_id,
    d.platform_slug                                                       as channel,
    d.date                                                                as period_start,
    d.date                                                                as period_end,
    coalesce(d.spend, 0)::numeric                                         as spend,
    coalesce(d.impressions, 0)::numeric                                   as impressions,
    coalesce(d.clicks, 0)::numeric                                        as clicks,
    coalesce(nullif(d.purchases, 0), d.leads, 0)::numeric                 as conversions,
    'oauth'::text                                                         as source
  from public.paid_traffic_daily_metrics d
  union all
  select
    m.org_id,
    m.channel,
    m.period_start,
    m.period_end,
    m.spend,
    coalesce(m.impressions, 0),
    coalesce(m.clicks, 0),
    coalesce(m.conversions, 0),
    'manual'
  from public.paid_traffic_manual_entries m;
