-- ── Dashboard public sharing ──────────────────────────────────────────────────

create table if not exists public.dashboard_shares (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  dashboard_id uuid not null references public.dashboards(id) on delete cascade,
  token       text not null unique default encode(gen_random_bytes(24), 'base64url'),
  title       text,
  expires_at  timestamptz,
  password_hash text,
  allow_filters boolean not null default true,
  view_count  integer not null default 0,
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.dashboard_shares enable row level security;

create policy "org members manage shares"
  on public.dashboard_shares for all
  using (org_id in (select org_id from public.org_members where user_id = auth.uid()));

create policy "public read by token"
  on public.dashboard_shares for select
  using (true);

create index on public.dashboard_shares (token);
create index on public.dashboard_shares (dashboard_id);
create index on public.dashboard_shares (org_id);
