-- ── KPI Threshold Alert Rules ─────────────────────────────────────────────────

create table if not exists public.kpi_alert_rules (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  name        text not null,
  metric_key  text not null,  -- e.g. 'conversion_rate', 'cpl', 'roas', 'churn_rate'
  operator    text not null check (operator in ('lt', 'lte', 'gt', 'gte', 'eq')),
  threshold   numeric not null,
  severity    text not null default 'warning' check (severity in ('info', 'warning', 'critical')),
  channel     text not null default 'in_app' check (channel in ('in_app', 'email')),
  enabled     boolean not null default true,
  last_triggered_at timestamptz,
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ── KPI Rule Trigger Log ──────────────────────────────────────────────────────

create table if not exists public.kpi_alert_triggers (
  id          uuid primary key default gen_random_uuid(),
  rule_id     uuid not null references public.kpi_alert_rules(id) on delete cascade,
  org_id      uuid not null,
  metric_key  text not null,
  actual_value numeric not null,
  threshold   numeric not null,
  operator    text not null,
  resolved    boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ── Goals (targets per KPI / period) ─────────────────────────────────────────

create table if not exists public.kpi_goals (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  name        text not null,
  metric_key  text not null,
  target_value numeric not null,
  current_value numeric,
  unit        text not null default 'number' check (unit in ('number', 'currency', 'percent')),
  period_type text not null default 'month' check (period_type in ('day', 'week', 'month', 'quarter', 'year')),
  period_start date not null,
  period_end  date not null,
  icon        text,
  color       text default '#6366f1',
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- RLS
alter table public.kpi_alert_rules    enable row level security;
alter table public.kpi_alert_triggers enable row level security;
alter table public.kpi_goals          enable row level security;

create policy "org kpi_alert_rules"    on public.kpi_alert_rules    for all using (org_id in (select org_id from public.org_members where user_id = auth.uid()));
create policy "org kpi_alert_triggers" on public.kpi_alert_triggers for all using (org_id in (select org_id from public.org_members where user_id = auth.uid()));
create policy "org kpi_goals"          on public.kpi_goals          for all using (org_id in (select org_id from public.org_members where user_id = auth.uid()));

create index on public.kpi_alert_rules (org_id, enabled);
create index on public.kpi_goals (org_id, period_start, period_end);
