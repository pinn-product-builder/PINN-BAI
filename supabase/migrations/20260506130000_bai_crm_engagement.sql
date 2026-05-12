-- BAI CRM Auditor — notas, eventos e conversas (Kommo) para análise ampliada

create table if not exists public.crm_auditor_notes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  external_id text not null,
  scope_entity_type text not null,
  entity_external_id text,
  note_type text,
  content_preview text,
  note_at timestamptz,
  raw jsonb not null default '{}',
  synced_at timestamptz not null default now(),
  unique (tenant_id, external_id)
);

create index if not exists crm_auditor_notes_tenant_idx
  on public.crm_auditor_notes (tenant_id, note_at desc nulls last);

create table if not exists public.crm_auditor_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  external_id text not null,
  event_type text,
  entity_type text,
  entity_external_id text,
  occurred_at timestamptz,
  raw jsonb not null default '{}',
  synced_at timestamptz not null default now(),
  unique (tenant_id, external_id)
);

create index if not exists crm_auditor_events_tenant_idx
  on public.crm_auditor_events (tenant_id, occurred_at desc nulls last);

create index if not exists crm_auditor_events_type_idx
  on public.crm_auditor_events (tenant_id, event_type);

create table if not exists public.crm_auditor_conversations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  external_id text not null,
  contact_external_id text,
  status text,
  last_message_preview text,
  last_message_at timestamptz,
  raw jsonb not null default '{}',
  synced_at timestamptz not null default now(),
  unique (tenant_id, external_id)
);

create index if not exists crm_auditor_conversations_tenant_idx
  on public.crm_auditor_conversations (tenant_id, last_message_at desc nulls last);

alter table public.crm_auditor_notes enable row level security;
alter table public.crm_auditor_events enable row level security;
alter table public.crm_auditor_conversations enable row level security;
