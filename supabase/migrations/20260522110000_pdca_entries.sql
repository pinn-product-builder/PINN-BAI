-- Diário PDCA (Plan-Do-Check-Act) semanal por organização.
-- Complementa bai_kpi_snapshots: os snapshots dão os NÚMEROS, o PDCA
-- captura as DECISÕES/aprendizados de cada semana. Juntos viram a
-- "revisão semanal" da operação.

create table if not exists public.pdca_entries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  week_start date not null,                         -- segunda-feira da semana
  plan text default '',                             -- o que vai fazer
  do_notes text default '',                         -- o que foi feito (column "do" é reserved)
  check_notes text default '',                      -- o que aprendeu/observou
  act text default '',                              -- próximo ciclo
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (org_id, week_start)
);

create index if not exists pdca_entries_org_week_idx
  on public.pdca_entries (org_id, week_start desc);

create or replace function public.touch_pdca_entries()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;

drop trigger if exists trg_touch_pdca on public.pdca_entries;
create trigger trg_touch_pdca
  before update on public.pdca_entries
  for each row execute function public.touch_pdca_entries();

alter table public.pdca_entries enable row level security;

drop policy if exists "pdca read" on public.pdca_entries;
create policy "pdca read"
  on public.pdca_entries for select
  using (public.user_can_read_tenant(org_id));

drop policy if exists "pdca write" on public.pdca_entries;
create policy "pdca write"
  on public.pdca_entries for all
  using (
    public.is_platform_admin(auth.uid())
    or public.user_can_read_tenant(org_id)
  )
  with check (
    public.is_platform_admin(auth.uid())
    or public.user_can_read_tenant(org_id)
  );

comment on table public.pdca_entries is
  'Plan-Do-Check-Act semanal — captura decisões/aprendizados pra contextualizar os snapshots de KPI.';

-- RPC complementar: retorna série temporal de snapshots pra graficar.
create or replace function public.bai_kpi_snapshot_series(
  _tenant_id uuid,
  _metric_key text,
  _days integer default 60
)
returns table (snapshot_date date, metric_value numeric)
language sql stable as $$
  select snapshot_date, metric_value
    from public.bai_kpi_snapshots
   where tenant_id = _tenant_id
     and metric_key = _metric_key
     and snapshot_date >= (current_date - _days)
   order by snapshot_date asc;
$$;

comment on function public.bai_kpi_snapshot_series is
  'Série temporal pra gráficos PDCA — N dias da métrica X.';
