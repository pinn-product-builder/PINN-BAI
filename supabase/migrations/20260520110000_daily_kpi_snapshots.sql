-- F8 — Snapshots diários (D-1) de KPIs para comparativos week-over-week e
-- month-over-month sem depender de série temporal nas tabelas operacionais.
--
-- Schema: linha-por-dia-por-tenant-por-métrica. Compacto (key/value) para
-- permitir adicionar métricas novas sem ALTER TABLE.

create table if not exists public.bai_kpi_snapshots (
  id            bigserial primary key,
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  snapshot_date date not null,
  metric_key    text not null,
  metric_value  numeric not null,
  meta          jsonb not null default '{}'::jsonb,
  captured_at   timestamptz not null default now(),
  unique (tenant_id, snapshot_date, metric_key)
);

create index if not exists bai_kpi_snapshots_tenant_date_idx
  on public.bai_kpi_snapshots (tenant_id, snapshot_date desc);

create index if not exists bai_kpi_snapshots_metric_idx
  on public.bai_kpi_snapshots (tenant_id, metric_key, snapshot_date desc);

comment on table public.bai_kpi_snapshots is
  'Snapshot diário (D-1) dos KPIs principais. Preenchido por job/scheduler. Permite comparativos semana/mês sem reconstrução de série.';

-- ── Função RPC: agregar últimos 30/60/90 dias com delta vs período anterior ────
create or replace function public.bai_kpi_snapshot_compare(
  _tenant_id uuid,
  _metric_key text,
  _window_days int default 7
) returns table (
  current_value     numeric,
  previous_value    numeric,
  delta_abs         numeric,
  delta_pct         numeric,
  current_start     date,
  current_end       date,
  previous_start    date,
  previous_end      date
)
language sql stable as $$
  with cur as (
    select coalesce(avg(metric_value), 0)::numeric as v
    from public.bai_kpi_snapshots
    where tenant_id = _tenant_id
      and metric_key = _metric_key
      and snapshot_date >= (current_date - _window_days)
  ),
  prev as (
    select coalesce(avg(metric_value), 0)::numeric as v
    from public.bai_kpi_snapshots
    where tenant_id = _tenant_id
      and metric_key = _metric_key
      and snapshot_date >= (current_date - 2 * _window_days)
      and snapshot_date <  (current_date - _window_days)
  )
  select
    cur.v as current_value,
    prev.v as previous_value,
    (cur.v - prev.v) as delta_abs,
    case when prev.v = 0 then null else round(100.0 * (cur.v - prev.v) / prev.v, 2) end as delta_pct,
    (current_date - _window_days)::date as current_start,
    current_date as current_end,
    (current_date - 2 * _window_days)::date as previous_start,
    (current_date - _window_days - 1)::date as previous_end
  from cur cross join prev;
$$;

-- ── Função de captura: agrega métricas atuais e grava o snapshot de hoje ──────
-- Idempotente (ON CONFLICT). Chamada por job externo (scheduler/cron) ou
-- manualmente via SQL para forçar recálculo.
create or replace function public.bai_capture_daily_snapshot(_tenant_id uuid)
returns int
language plpgsql as $$
declare
  rows_inserted int := 0;
  d date := current_date;
begin
  -- KPI 1: total de leads em aberto
  insert into public.bai_kpi_snapshots (tenant_id, snapshot_date, metric_key, metric_value)
  select _tenant_id, d, 'open_leads',
         count(*)::numeric
  from public.crm_leads where tenant_id = _tenant_id and lead_status = 'open'
  on conflict (tenant_id, snapshot_date, metric_key) do update
    set metric_value = excluded.metric_value, captured_at = now();
  rows_inserted := rows_inserted + 1;

  -- KPI 2: pipeline em aberto (valor comercial)
  insert into public.bai_kpi_snapshots (tenant_id, snapshot_date, metric_key, metric_value)
  select _tenant_id, d, 'open_pipeline_value',
         coalesce(sum(coalesce(opportunity_value, 0)), 0)::numeric
  from public.crm_leads where tenant_id = _tenant_id and lead_status = 'open'
  on conflict (tenant_id, snapshot_date, metric_key) do update
    set metric_value = excluded.metric_value, captured_at = now();
  rows_inserted := rows_inserted + 1;

  -- KPI 3: leads ganhos no dia
  insert into public.bai_kpi_snapshots (tenant_id, snapshot_date, metric_key, metric_value)
  select _tenant_id, d, 'won_leads_today',
         count(*) filter (where closed_at::date = d and lead_status = 'won')::numeric
  from public.crm_leads where tenant_id = _tenant_id
  on conflict (tenant_id, snapshot_date, metric_key) do update
    set metric_value = excluded.metric_value, captured_at = now();
  rows_inserted := rows_inserted + 1;

  -- KPI 4: leads perdidos no dia
  insert into public.bai_kpi_snapshots (tenant_id, snapshot_date, metric_key, metric_value)
  select _tenant_id, d, 'lost_leads_today',
         count(*) filter (where closed_at::date = d and lead_status = 'lost')::numeric
  from public.crm_leads where tenant_id = _tenant_id
  on conflict (tenant_id, snapshot_date, metric_key) do update
    set metric_value = excluded.metric_value, captured_at = now();
  rows_inserted := rows_inserted + 1;

  return rows_inserted;
end;
$$;

-- RLS: snapshot é leitura para usuários da org, escrita só service_role.
alter table public.bai_kpi_snapshots enable row level security;

drop policy if exists "bai_snapshots_select_org" on public.bai_kpi_snapshots;
create policy "bai_snapshots_select_org" on public.bai_kpi_snapshots
  for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.org_id = bai_kpi_snapshots.tenant_id
    )
    or public.is_platform_admin(auth.uid())
  );
