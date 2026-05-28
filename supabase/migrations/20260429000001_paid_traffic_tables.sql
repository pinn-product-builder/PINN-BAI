-- Paid Traffic integration tables
-- Supports Meta Ads, Google Ads (extensible to any ad platform)

-- ── paid_traffic_connections ──────────────────────────────────────────────────
create table if not exists public.paid_traffic_connections (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  platform_slug text not null,                -- "meta_ads" | "google_ads"
  credentials   jsonb not null default '{}', -- access_token, account_id, etc.
  account_id    text,                         -- ad account ID (denormalized for easy filter)
  account_name  text,
  last_sync_at  timestamptz,
  sync_status   text not null default 'idle', -- idle | syncing | success | error
  sync_error    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (org_id, platform_slug, account_id)
);

alter table public.paid_traffic_connections enable row level security;
create policy "org members can manage their ad connections"
  on public.paid_traffic_connections for all
  using (org_id in (select org_id from public.profiles where id = auth.uid()));

-- ── paid_traffic_campaigns ────────────────────────────────────────────────────
create table if not exists public.paid_traffic_campaigns (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizations(id) on delete cascade,
  platform_slug  text not null,
  external_id    text not null,
  account_id     text not null,
  name           text not null default '',
  status         text not null default 'UNKNOWN', -- ACTIVE | PAUSED | ARCHIVED | DELETED
  objective      text,                             -- CONVERSIONS | LEAD_GENERATION | TRAFFIC | etc.
  daily_budget   numeric(14,2),
  lifetime_budget numeric(14,2),
  start_date     date,
  end_date       date,
  synced_at      timestamptz not null default now(),
  raw            jsonb not null default '{}',
  unique (org_id, platform_slug, external_id)
);

alter table public.paid_traffic_campaigns enable row level security;
create policy "org members can read their campaigns"
  on public.paid_traffic_campaigns for select
  using (org_id in (select org_id from public.profiles where id = auth.uid()));

create index if not exists paid_traffic_campaigns_org_platform_idx
  on public.paid_traffic_campaigns (org_id, platform_slug);

-- ── paid_traffic_adsets ───────────────────────────────────────────────────────
create table if not exists public.paid_traffic_adsets (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizations(id) on delete cascade,
  platform_slug  text not null,
  external_id    text not null,
  campaign_id    text not null,  -- external_id da campanha
  name           text not null default '',
  status         text not null default 'UNKNOWN',
  daily_budget   numeric(14,2),
  synced_at      timestamptz not null default now(),
  raw            jsonb not null default '{}',
  unique (org_id, platform_slug, external_id)
);

alter table public.paid_traffic_adsets enable row level security;
create policy "org members can read their adsets"
  on public.paid_traffic_adsets for select
  using (org_id in (select org_id from public.profiles where id = auth.uid()));

create index if not exists paid_traffic_adsets_org_campaign_idx
  on public.paid_traffic_adsets (org_id, platform_slug, campaign_id);

-- ── paid_traffic_daily_metrics ────────────────────────────────────────────────
-- Uma linha por (org, platform, campaign, date) — granularidade diária
create table if not exists public.paid_traffic_daily_metrics (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizations(id) on delete cascade,
  platform_slug  text not null,
  campaign_id    text not null,   -- external_id da campanha
  adset_id       text,            -- external_id do adset (nullable para métricas de campanha)
  date           date not null,
  impressions    bigint not null default 0,
  clicks         bigint not null default 0,
  spend          numeric(14,2) not null default 0,
  reach          bigint,
  leads          integer not null default 0,    -- conversões de lead
  purchases      integer not null default 0,    -- conversões de compra
  purchase_value numeric(14,2) not null default 0,
  -- métricas derivadas (calculadas no upsert via trigger ou app)
  ctr            numeric(8,4),   -- clicks / impressions * 100
  cpl            numeric(14,2),  -- spend / leads
  cpa            numeric(14,2),  -- spend / purchases
  roas           numeric(10,4),  -- purchase_value / spend
  synced_at      timestamptz not null default now(),
  raw            jsonb not null default '{}',
  unique (org_id, platform_slug, campaign_id, coalesce(adset_id, ''), date)
);

alter table public.paid_traffic_daily_metrics enable row level security;
create policy "org members can read their ad metrics"
  on public.paid_traffic_daily_metrics for select
  using (org_id in (select org_id from public.profiles where id = auth.uid()));

create index if not exists paid_traffic_metrics_org_date_idx
  on public.paid_traffic_daily_metrics (org_id, platform_slug, date desc);
create index if not exists paid_traffic_metrics_campaign_date_idx
  on public.paid_traffic_daily_metrics (org_id, platform_slug, campaign_id, date desc);

-- trigger para calcular métricas derivadas automaticamente
create or replace function public.calc_ad_derived_metrics()
returns trigger language plpgsql as $$
begin
  new.ctr := case when new.impressions > 0 then round((new.clicks::numeric / new.impressions * 100)::numeric, 4) else 0 end;
  new.cpl := case when new.leads > 0 then round((new.spend / new.leads)::numeric, 2) else null end;
  new.cpa := case when new.purchases > 0 then round((new.spend / new.purchases)::numeric, 2) else null end;
  new.roas := case when new.spend > 0 then round((new.purchase_value / new.spend)::numeric, 4) else null end;
  return new;
end;
$$;

create trigger paid_traffic_metrics_derived
  before insert or update on public.paid_traffic_daily_metrics
  for each row execute function public.calc_ad_derived_metrics();
