-- Tokens OAuth de Google Calendar por organização.
-- Um único app OAuth (configurado no GCP) atende todas as orgs.
-- Cada org persiste seu access_token + refresh_token aqui.
-- Edge function `google-oauth-callback` grava após o handshake.

create table if not exists public.google_oauth_credentials (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null default 'google_calendar',
  google_email text,                            -- email da conta conectada
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  scope text,
  connected_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (org_id, provider)
);

create or replace function public.touch_google_oauth()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;

drop trigger if exists trg_touch_google_oauth on public.google_oauth_credentials;
create trigger trg_touch_google_oauth
  before update on public.google_oauth_credentials
  for each row execute function public.touch_google_oauth();

alter table public.google_oauth_credentials enable row level security;

-- Tokens são sensíveis — só platform_admin lê em SELECT direto.
-- Edge functions usam service_role, que ignora RLS.
drop policy if exists "google_oauth read (admin)" on public.google_oauth_credentials;
create policy "google_oauth read (admin)"
  on public.google_oauth_credentials for select
  using (public.is_platform_admin(auth.uid()));

drop policy if exists "google_oauth write (admin)" on public.google_oauth_credentials;
create policy "google_oauth write (admin)"
  on public.google_oauth_credentials for all
  using (public.is_platform_admin(auth.uid()))
  with check (public.is_platform_admin(auth.uid()));

comment on table public.google_oauth_credentials is
  'Tokens OAuth Google Calendar per-org. Apenas platform_admin lê via UI; edges usam service_role pra refresh.';
