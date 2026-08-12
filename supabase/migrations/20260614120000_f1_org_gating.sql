-- F1 (#42) — Gating por org via DB.
-- Tira os UUID/slug hardcoded de src/lib/featureFlags.ts, ClientLayout.tsx e App.tsx
-- e move pra config no banco. Aditiva (nenhum drop). O frontend lê isso com
-- fallback pro hardcode atual, então a ausência de seed não quebra nada.

-- ── 1. Colunas de gating em organizations ──────────────────────────────────
alter table public.organizations
  add column if not exists org_type text not null default 'client',
  add column if not exists is_demo_org boolean not null default false,
  add column if not exists default_landing_path text;

comment on column public.organizations.org_type is
  'client | demo | pinn_internal. Substitui o name-match %pinn% (useIsPinnProductBuilderOrg) e o UUID Arguto.';
comment on column public.organizations.is_demo_org is
  'Org de demonstração: hooks servem dados mock (substitui DEMO_ORG_IDS/DEMO_ORG_SLUGS em featureFlags.ts).';
comment on column public.organizations.default_landing_path is
  'Leaf do path de landing pós-login (ex.: arguto, dashboard). null => dashboard. Substitui isArgutoOrg no ClientRootRedirect.';

-- ── 2. org_feature_flags — toggles de módulo por org ────────────────────────
-- flag_key livre (ex.: rfm_churn). Ausência de linha => usar default do código.
create table if not exists public.org_feature_flags (
  org_id uuid not null references public.organizations(id) on delete cascade,
  flag_key text not null,
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (org_id, flag_key)
);

comment on table public.org_feature_flags is
  'Feature flags por org. Substitui RFM_CHURN_ALLOWED_ORG_IDS e afins em featureFlags.ts. Gerenciado em Admin -> Org -> Features & Navegacao.';

-- ── 3. org_menu_visibility — override de visibilidade de item de menu ───────
-- menu_key = path do item (dashboard, arguto, customer-health, unit-economics...).
-- Só guarda OVERRIDES vs o default do código; ausência de linha => default do item.
create table if not exists public.org_menu_visibility (
  org_id uuid not null references public.organizations(id) on delete cascade,
  menu_key text not null,
  visible boolean not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (org_id, menu_key)
);

comment on table public.org_menu_visibility is
  'Override de visibilidade de item de menu por org. Substitui onlyForSlugs/hideForSlugs em ClientLayout.tsx.';

-- updated_at automático (uma função genérica reaproveitável).
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;

drop trigger if exists tg_org_feature_flags_updated on public.org_feature_flags;
create trigger tg_org_feature_flags_updated
  before update on public.org_feature_flags
  for each row execute function public.touch_updated_at();

drop trigger if exists tg_org_menu_visibility_updated on public.org_menu_visibility;
create trigger tg_org_menu_visibility_updated
  before update on public.org_menu_visibility
  for each row execute function public.touch_updated_at();

-- ── 4. RLS — leitura por membro da org; escrita só platform_admin ───────────
-- (gating é decisão de plataforma; client_admin não muda seu próprio menu.)
alter table public.org_feature_flags enable row level security;
alter table public.org_menu_visibility enable row level security;

drop policy if exists "org_feature_flags read" on public.org_feature_flags;
create policy "org_feature_flags read"
  on public.org_feature_flags for select
  using (public.user_can_read_tenant(org_id));

drop policy if exists "org_feature_flags write (platform_admin)" on public.org_feature_flags;
create policy "org_feature_flags write (platform_admin)"
  on public.org_feature_flags for all
  using (public.is_platform_admin(auth.uid()))
  with check (public.is_platform_admin(auth.uid()));

drop policy if exists "org_menu_visibility read" on public.org_menu_visibility;
create policy "org_menu_visibility read"
  on public.org_menu_visibility for select
  using (public.user_can_read_tenant(org_id));

drop policy if exists "org_menu_visibility write (platform_admin)" on public.org_menu_visibility;
create policy "org_menu_visibility write (platform_admin)"
  on public.org_menu_visibility for all
  using (public.is_platform_admin(auth.uid()))
  with check (public.is_platform_admin(auth.uid()));

-- ── 5. Seed — reproduz o comportamento hardcoded de hoje ────────────────────
-- Resolvido por SLUG (estável entre dev/staging/prod), não por UUID.

-- Arguto: org demo, landing em /arguto, módulo RFM/churn ligado.
update public.organizations
  set org_type = 'demo', is_demo_org = true, default_landing_path = 'arguto'
  where slug = 'arguto';

-- Pinn Product Builder: org interna (hospeda telas Pinn SDR / LinkedIn SDR).
update public.organizations
  set org_type = 'pinn_internal'
  where slug like 'pinn-product-builder%';

-- Feature flags.
insert into public.org_feature_flags (org_id, flag_key, enabled)
select id, 'rfm_churn', true from public.organizations where slug = 'arguto'
on conflict (org_id, flag_key) do update set enabled = excluded.enabled;

-- Menu overrides.
-- Arguto: item "arguto" visível (default do item é oculto = onlyForSlugs);
--         "dashboard" oculto (duplica /arguto = hideForSlugs).
insert into public.org_menu_visibility (org_id, menu_key, visible)
select id, 'arguto', true from public.organizations where slug = 'arguto'
on conflict (org_id, menu_key) do update set visible = excluded.visible;

insert into public.org_menu_visibility (org_id, menu_key, visible)
select id, 'dashboard', false from public.organizations where slug = 'arguto'
on conflict (org_id, menu_key) do update set visible = excluded.visible;

-- Ecológica (turismo SDR): sem métricas de receita/valor — esconde Saúde do
-- Cliente e CAC/LTV (era hideForSlugs ["ecologica-turismo-kommo"]).
insert into public.org_menu_visibility (org_id, menu_key, visible)
select id, 'customer-health', false from public.organizations where slug = 'ecologica-turismo-kommo'
on conflict (org_id, menu_key) do update set visible = excluded.visible;

insert into public.org_menu_visibility (org_id, menu_key, visible)
select id, 'unit-economics', false from public.organizations where slug = 'ecologica-turismo-kommo'
on conflict (org_id, menu_key) do update set visible = excluded.visible;
