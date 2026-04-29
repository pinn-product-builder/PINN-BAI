-- CRM plug-and-play tables
-- Stores connection credentials and synced CRM data per tenant

-- ── crm_connections ─────────────────────────────────────────────────────────
create table if not exists public.crm_connections (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  crm_slug      text not null,                -- e.g. "kommo"
  credentials   jsonb not null default '{}', -- access_token, subdomain, etc.
  last_sync_at  timestamptz,
  sync_status   text not null default 'idle', -- idle | syncing | success | error
  sync_error    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (org_id, crm_slug)
);

alter table public.crm_connections enable row level security;

create policy "org members can manage their crm connections"
  on public.crm_connections
  for all
  using (
    org_id in (
      select org_id from public.profiles where id = auth.uid()
    )
  );

-- ── crm_contacts ─────────────────────────────────────────────────────────────
create table if not exists public.crm_contacts (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations(id) on delete cascade,
  crm_slug     text not null,
  external_id  text not null,
  name         text not null default '',
  email        text,
  phone        text,
  created_at   timestamptz not null,
  synced_at    timestamptz not null default now(),
  raw          jsonb not null default '{}',
  unique (org_id, crm_slug, external_id)
);

alter table public.crm_contacts enable row level security;

create policy "org members can read their crm contacts"
  on public.crm_contacts
  for select
  using (
    org_id in (
      select org_id from public.profiles where id = auth.uid()
    )
  );

create index if not exists crm_contacts_org_slug_idx
  on public.crm_contacts (org_id, crm_slug);

-- ── crm_appointments ─────────────────────────────────────────────────────────
create table if not exists public.crm_appointments (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations(id) on delete cascade,
  crm_slug     text not null,
  external_id  text not null,
  contact_id   text not null, -- external_id do contato
  scheduled_at timestamptz not null,
  status       text not null default 'scheduled',
  synced_at    timestamptz not null default now(),
  raw          jsonb not null default '{}',
  unique (org_id, crm_slug, external_id)
);

alter table public.crm_appointments enable row level security;

create policy "org members can read their crm appointments"
  on public.crm_appointments
  for select
  using (
    org_id in (
      select org_id from public.profiles where id = auth.uid()
    )
  );

create index if not exists crm_appointments_org_slug_idx
  on public.crm_appointments (org_id, crm_slug);

-- ── crm_deals ────────────────────────────────────────────────────────────────
create table if not exists public.crm_deals (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations(id) on delete cascade,
  crm_slug     text not null,
  external_id  text not null,
  contact_id   text not null,
  stage        text not null default '',
  value        numeric not null default 0,
  created_at   timestamptz not null,
  closed_at    timestamptz,
  synced_at    timestamptz not null default now(),
  raw          jsonb not null default '{}',
  unique (org_id, crm_slug, external_id)
);

alter table public.crm_deals enable row level security;

create policy "org members can read their crm deals"
  on public.crm_deals
  for select
  using (
    org_id in (
      select org_id from public.profiles where id = auth.uid()
    )
  );

create index if not exists crm_deals_org_slug_idx
  on public.crm_deals (org_id, crm_slug);

-- ── crm_activities ───────────────────────────────────────────────────────────
create table if not exists public.crm_activities (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations(id) on delete cascade,
  crm_slug     text not null,
  external_id  text not null,
  contact_id   text not null,
  type         text not null default 'note', -- call | email | note | meeting
  happened_at  timestamptz not null,
  synced_at    timestamptz not null default now(),
  raw          jsonb not null default '{}',
  unique (org_id, crm_slug, external_id)
);

alter table public.crm_activities enable row level security;

create policy "org members can read their crm activities"
  on public.crm_activities
  for select
  using (
    org_id in (
      select org_id from public.profiles where id = auth.uid()
    )
  );

create index if not exists crm_activities_org_slug_idx
  on public.crm_activities (org_id, crm_slug);
