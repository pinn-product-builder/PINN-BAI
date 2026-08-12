-- BASELINE CAPTURE (tabelas do drift) — #41. Colunas+defaults do catálogo; PK como comentário.
-- FKs/índices/RLS NÃO incluídos (revisar antes de aplicar em DB nova).
-- kommo_leads = dívida Quitou BR; onboarding_* = sistema de onboarding externo. Generalizar/mover conforme fase.

-- TABLE dashboard_uploaded_datasets  (PK: id)
create table if not exists public.dashboard_uploaded_datasets (
  id uuid not null default gen_random_uuid(),
  org_id uuid,
  key text not null,
  display_name text not null,
  columns jsonb not null default '[]'::jsonb,
  rows jsonb not null default '[]'::jsonb,
  source_filename text,
  row_count integer default 0,
  created_by uuid,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- TABLE external_data_connections  (PK: id)
create table if not exists public.external_data_connections (
  id uuid not null default gen_random_uuid(),
  org_id uuid,
  name text not null,
  type text not null,
  config jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_by uuid,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- TABLE kommo_leads  (PK: org_id, lead_id)
create table if not exists public.kommo_leads (
  org_id uuid not null,
  lead_id bigint not null,
  pipeline_id bigint,
  status_id bigint,
  created_at_ts bigint,
  created_at_iso text,
  updated_at_ts bigint,
  updated_at_iso text,
  closed_at_ts bigint,
  closed_at_iso text,
  won_at_ts bigint,
  won_at_iso text,
  lost_at_ts bigint,
  lost_at_iso text,
  agendamento_ts bigint,
  agendamento_iso text,
  email text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  referrer text,
  fbclid text,
  gclid text,
  origem text,
  device text,
  browser text,
  criativo text,
  conjunto text,
  encaminhado boolean default false,
  atendimento_feito boolean default false,
  reuniao_confirmada boolean default false,
  reuniao_realizada boolean default false,
  nao_confirmou boolean default false,
  faltou_reuniao boolean default false,
  venda boolean default false,
  desqualificado boolean default false,
  synced_at_iso text,
  inserted_at timestamp with time zone default now(),
  updated_in_db_at timestamp with time zone default now()
);

-- TABLE linkedin_ai_settings  (PK: id)
create table if not exists public.linkedin_ai_settings (
  id uuid not null default gen_random_uuid(),
  tenant_id uuid not null,
  unipile_account_id text not null,
  is_enabled boolean not null default true,
  paused_at timestamp with time zone,
  paused_by uuid,
  paused_reason text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- TABLE linkedin_sdr_aliases  (PK: sdr_slug, unipile_account_id)
create table if not exists public.linkedin_sdr_aliases (
  sdr_slug text not null,
  unipile_account_id text not null,
  active_since date,
  active_until date,
  notes text
);

-- TABLE onboarding_requests  (PK: id)
create table if not exists public.onboarding_requests (
  id uuid not null default gen_random_uuid(),
  company_name text not null,
  contact_name text,
  contact_email text,
  cpf_cnpj text,
  products jsonb not null default '{}'::jsonb,
  form_data jsonb default '{}'::jsonb,
  origin text not null default 'pinn'::text,
  status text not null default 'pending'::text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- TABLE onboarding_steps  (PK: id)
create table if not exists public.onboarding_steps (
  id uuid not null default gen_random_uuid(),
  request_id uuid not null,
  step text not null,
  status text not null default 'pending'::text,
  result jsonb,
  error text,
  attempts integer not null default 0,
  updated_at timestamp with time zone default now()
);
