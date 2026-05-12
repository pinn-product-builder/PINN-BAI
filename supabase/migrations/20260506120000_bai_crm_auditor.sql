-- BAI CRM Auditor — modelo de dados dedicado (MVP)
-- Observação PINN-BAI: já existem public.crm_connections e public.crm_contacts no sync legado (org_id).
-- Este módulo usa public.tenants + tenant_id UUID próprio do produto auditor.
-- Mapeamento de nomes do spec: crm_connections → crm_auditor_connections; crm_activities → crm_auditor_activities.

-- ── tenants ─────────────────────────────────────────────────────────────────
create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── crm_auditor_connections (spec: crm_connections) ────────────────────────
create table if not exists public.crm_auditor_connections (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  provider text not null default 'kommo',
  display_name text not null default 'default',
  auth_via text not null default 'composio',
  composio_connected_account_id text,
  credentials jsonb not null default '{}',
  last_sync_at timestamptz,
  sync_status text not null default 'idle',
  sync_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, provider)
);

create index if not exists crm_auditor_connections_tenant_idx
  on public.crm_auditor_connections (tenant_id);

-- ── Dimensões CRM ───────────────────────────────────────────────────────────
create table if not exists public.crm_pipelines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  external_id text not null,
  name text not null default '',
  is_active boolean not null default true,
  raw jsonb not null default '{}',
  synced_at timestamptz not null default now(),
  unique (tenant_id, external_id)
);

create table if not exists public.crm_stages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  pipeline_external_id text not null,
  external_id text not null,
  name text not null default '',
  sort_order int,
  stage_type text,
  raw jsonb not null default '{}',
  synced_at timestamptz not null default now(),
  unique (tenant_id, pipeline_external_id, external_id)
);

create table if not exists public.crm_users (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  external_id text not null,
  name text not null default '',
  email text,
  is_active boolean not null default true,
  raw jsonb not null default '{}',
  synced_at timestamptz not null default now(),
  unique (tenant_id, external_id)
);

-- ── Entidades principais ────────────────────────────────────────────────────
create table if not exists public.crm_leads (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  external_id text not null,
  name text not null default '',
  pipeline_external_id text,
  stage_external_id text,
  lead_status text not null default 'open',
  value numeric not null default 0,
  currency text,
  owner_external_id text,
  contact_external_id text,
  company_external_id text,
  source text,
  lost_reason text,
  created_at timestamptz,
  closed_at timestamptz,
  external_updated_at timestamptz,
  raw jsonb not null default '{}',
  synced_at timestamptz not null default now(),
  unique (tenant_id, external_id)
);

create index if not exists crm_leads_tenant_status_idx
  on public.crm_leads (tenant_id, lead_status);

create table if not exists public.crm_norm_contacts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  external_id text not null,
  name text not null default '',
  email text,
  phone text,
  company_external_id text,
  raw jsonb not null default '{}',
  synced_at timestamptz not null default now(),
  unique (tenant_id, external_id)
);

-- Spec: crm_contacts — implementado como crm_norm_contacts (evita colisão com crm_contacts legado).

create table if not exists public.crm_companies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  external_id text not null,
  name text not null default '',
  raw jsonb not null default '{}',
  synced_at timestamptz not null default now(),
  unique (tenant_id, external_id)
);

create table if not exists public.crm_tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  external_id text not null,
  lead_external_id text,
  contact_external_id text,
  title text not null default '',
  due_at timestamptz,
  completed_at timestamptz,
  is_completed boolean not null default false,
  assignee_external_id text,
  raw jsonb not null default '{}',
  synced_at timestamptz not null default now(),
  unique (tenant_id, external_id)
);

create index if not exists crm_tasks_tenant_lead_idx
  on public.crm_tasks (tenant_id, lead_external_id);

create table if not exists public.crm_auditor_activities (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  external_id text not null,
  entity_type text not null default 'lead',
  entity_external_id text not null,
  activity_type text not null default 'note',
  happened_at timestamptz not null,
  raw jsonb not null default '{}',
  synced_at timestamptz not null default now(),
  unique (tenant_id, external_id)
);

create table if not exists public.crm_custom_fields (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  entity_type text not null,
  external_id text not null,
  name text not null default '',
  field_type text,
  raw jsonb not null default '{}',
  synced_at timestamptz not null default now(),
  unique (tenant_id, entity_type, external_id)
);

-- ── Operação / análise ──────────────────────────────────────────────────────
create table if not exists public.crm_sync_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  connection_id uuid references public.crm_auditor_connections(id) on delete set null,
  status text not null default 'running',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  error_message text,
  stats jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists crm_sync_runs_tenant_idx on public.crm_sync_runs (tenant_id, started_at desc);

create table if not exists public.crm_snapshots (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  snapshot_kind text not null default 'post_sync',
  payload jsonb not null default '{}',
  sync_run_id uuid references public.crm_sync_runs(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.crm_analysis_reports (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_score int,
  model_used text,
  report jsonb not null default '{}',
  input_digest text,
  created_at timestamptz not null default now()
);

create index if not exists crm_analysis_reports_tenant_idx
  on public.crm_analysis_reports (tenant_id, created_at desc);

create table if not exists public.crm_alerts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  alert_type text not null,
  severity text not null default 'medium',
  entity_type text,
  entity_external_id text,
  message text not null,
  metadata jsonb not null default '{}',
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists crm_alerts_tenant_idx on public.crm_alerts (tenant_id, resolved, created_at desc);

-- ── Views analíticas ─────────────────────────────────────────────────────────
create or replace view public.vw_pipeline_health as
select
  l.tenant_id,
  l.pipeline_external_id,
  coalesce(p.name, l.pipeline_external_id) as pipeline_name,
  l.stage_external_id,
  coalesce(s.name, l.stage_external_id) as stage_name,
  count(*) filter (where l.lead_status = 'open') as open_leads,
  count(*) filter (where l.lead_status = 'won') as won_leads,
  count(*) filter (where l.lead_status = 'lost') as lost_leads,
  coalesce(sum(l.value) filter (where l.lead_status = 'open'), 0) as open_pipeline_value
from public.crm_leads l
left join public.crm_pipelines p
  on p.tenant_id = l.tenant_id and p.external_id = l.pipeline_external_id
left join public.crm_stages s
  on s.tenant_id = l.tenant_id
  and s.pipeline_external_id = l.pipeline_external_id
  and s.external_id = l.stage_external_id
group by l.tenant_id, l.pipeline_external_id, p.name, l.stage_external_id, s.name;

create or replace view public.vw_leads_stuck_by_stage as
select
  l.*,
  coalesce(s.name, l.stage_external_id) as stage_name,
  extract(epoch from (now() - l.external_updated_at)) / 86400.0 as days_since_update
from public.crm_leads l
left join public.crm_stages s
  on s.tenant_id = l.tenant_id
  and s.pipeline_external_id = l.pipeline_external_id
  and s.external_id = l.stage_external_id
where l.lead_status = 'open'
  and l.external_updated_at is not null
  and l.external_updated_at < now() - interval '7 days';

create or replace view public.vw_owner_performance as
select
  l.tenant_id,
  l.owner_external_id,
  coalesce(u.name, l.owner_external_id) as owner_name,
  count(*) filter (where l.lead_status = 'open') as open_leads,
  count(*) filter (where l.lead_status = 'won') as won_leads,
  count(*) filter (where l.lead_status = 'lost') as lost_leads,
  coalesce(sum(l.value) filter (where l.lead_status = 'open'), 0) as open_value
from public.crm_leads l
left join public.crm_users u
  on u.tenant_id = l.tenant_id and u.external_id = l.owner_external_id
group by l.tenant_id, l.owner_external_id, u.name;

create or replace view public.vw_no_next_action as
select l.*
from public.crm_leads l
where l.lead_status = 'open'
  and not exists (
    select 1 from public.crm_tasks t
    where t.tenant_id = l.tenant_id
      and t.lead_external_id = l.external_id
      and t.is_completed = false
  );

create or replace view public.vw_overdue_tasks as
select t.*
from public.crm_tasks t
where t.is_completed = false
  and t.due_at is not null
  and t.due_at < now();

create or replace view public.vw_stage_conversion as
select
  tenant_id,
  pipeline_external_id,
  stage_external_id,
  stage_name,
  lead_count,
  case
    when sum(lead_count) over (partition by tenant_id, pipeline_external_id) = 0 then 0
    else round(
      100.0 * lead_count::numeric
      / nullif(sum(lead_count) over (partition by tenant_id, pipeline_external_id), 0),
      2
    )
  end as pct_of_open_pipeline
from (
  select
    l.tenant_id,
    l.pipeline_external_id,
    l.stage_external_id,
    coalesce(s.name, l.stage_external_id) as stage_name,
    count(*) as lead_count
  from public.crm_leads l
  left join public.crm_stages s
    on s.tenant_id = l.tenant_id
    and s.pipeline_external_id = l.pipeline_external_id
    and s.external_id = l.stage_external_id
  where l.lead_status = 'open'
  group by l.tenant_id, l.pipeline_external_id, l.stage_external_id, s.name
) x;

create or replace view public.vw_funnel_velocity as
select
  l.tenant_id,
  l.pipeline_external_id,
  l.stage_external_id,
  coalesce(s.name, l.stage_external_id) as stage_name,
  avg(extract(epoch from (now() - l.external_updated_at)) / 86400.0) as avg_days_in_stage_proxy,
  percentile_cont(0.5) within group (order by extract(epoch from (now() - l.external_updated_at)) / 86400.0)
    as median_days_in_stage_proxy
from public.crm_leads l
left join public.crm_stages s
  on s.tenant_id = l.tenant_id
  and s.pipeline_external_id = l.pipeline_external_id
  and s.external_id = l.stage_external_id
where l.lead_status = 'open'
  and l.external_updated_at is not null
group by l.tenant_id, l.pipeline_external_id, l.stage_external_id, s.name;

create or replace view public.vw_lost_reasons as
select
  tenant_id,
  coalesce(nullif(trim(lost_reason), ''), '(não informado)') as lost_reason,
  count(*) as cnt
from public.crm_leads
where lead_status = 'lost'
group by tenant_id, coalesce(nullif(trim(lost_reason), ''), '(não informado)');

create or replace view public.vw_duplicate_contacts as
select
  tenant_id,
  lower(trim(email)) as email_norm,
  count(*) as cnt
from public.crm_norm_contacts
where email is not null and trim(email) <> ''
group by tenant_id, lower(trim(email))
having count(*) > 1;

create or replace view public.vw_forecast_quality as
select
  l.tenant_id,
  count(*) filter (where l.lead_status = 'open' and (l.value is null or l.value = 0)) as open_without_value,
  count(*) filter (where l.lead_status = 'open') as open_total,
  case
    when count(*) filter (where l.lead_status = 'open') = 0 then 0::numeric
    else round(
      100.0 * count(*) filter (where l.lead_status = 'open' and (l.value is null or l.value = 0))::numeric
      / count(*) filter (where l.lead_status = 'open'),
      2
    )
  end as pct_open_missing_value
from public.crm_leads l
group by l.tenant_id;

create or replace view public.vw_crm_data_quality as
select
  c.tenant_id,
  count(*) filter (where c.email is null or trim(c.email) = '') as contacts_no_email,
  count(*) filter (where c.phone is null or trim(c.phone) = '') as contacts_no_phone,
  count(*) as contacts_total
from public.crm_norm_contacts c
group by c.tenant_id;

-- RLS: bloqueia acesso anônimo via API; backend com service role continua com acesso total.
alter table public.tenants enable row level security;
alter table public.crm_auditor_connections enable row level security;
alter table public.crm_pipelines enable row level security;
alter table public.crm_stages enable row level security;
alter table public.crm_users enable row level security;
alter table public.crm_leads enable row level security;
alter table public.crm_norm_contacts enable row level security;
alter table public.crm_companies enable row level security;
alter table public.crm_tasks enable row level security;
alter table public.crm_auditor_activities enable row level security;
alter table public.crm_custom_fields enable row level security;
alter table public.crm_sync_runs enable row level security;
alter table public.crm_snapshots enable row level security;
alter table public.crm_analysis_reports enable row level security;
alter table public.crm_alerts enable row level security;
