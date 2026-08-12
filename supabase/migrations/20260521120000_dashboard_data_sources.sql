-- Catálogo curado de fontes de dados pra widgets.
-- Resolve o problema "tabela hardcoded": agora admin cadastra novas views
-- pela UI, e WidgetEditorDialog / live_generate leem desse catálogo.

create table if not exists public.dashboard_data_sources (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  key text not null,
  display_name text not null,
  description text,
  category text,
  columns jsonb default '[]'::jsonb,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- key único por org (e único globalmente quando org_id is null).
create unique index if not exists dashboard_data_sources_org_key_uniq
  on public.dashboard_data_sources (org_id, key) where org_id is not null;
create unique index if not exists dashboard_data_sources_global_key_uniq
  on public.dashboard_data_sources (key) where org_id is null;
create index if not exists dashboard_data_sources_active_idx
  on public.dashboard_data_sources (is_active) where is_active = true;

-- updated_at automático.
create or replace function public.touch_dashboard_data_sources()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;

drop trigger if exists tg_dashboard_data_sources_updated on public.dashboard_data_sources;
create trigger tg_dashboard_data_sources_updated
  before update on public.dashboard_data_sources
  for each row execute function public.touch_dashboard_data_sources();

-- RLS: SELECT pra qualquer membro da org (ou global se org_id null).
-- INSERT/UPDATE/DELETE só platform_admin e client_admin.
alter table public.dashboard_data_sources enable row level security;

drop policy if exists "data_sources read" on public.dashboard_data_sources;
create policy "data_sources read"
  on public.dashboard_data_sources for select
  using (
    org_id is null
    or public.user_can_read_tenant(org_id)
  );

drop policy if exists "data_sources write (admin)" on public.dashboard_data_sources;
create policy "data_sources write (admin)"
  on public.dashboard_data_sources for all
  using (
    public.is_platform_admin(auth.uid())
    or (
      org_id is not null
      and public.user_can_read_tenant(org_id)
    )
  )
  with check (
    public.is_platform_admin(auth.uid())
    or (
      org_id is not null
      and public.user_can_read_tenant(org_id)
    )
  );

-- Seed inicial — fontes globais (org_id = null) com as views/tabelas já
-- usadas hoje. Catalogadas aqui pra eliminar a lista hardcoded em
-- DashboardAdminMenu.handleLiveGenerate.
insert into public.dashboard_data_sources (org_id, key, display_name, description, category)
values
  (null, 'crm_leads',                          'CRM · Leads',                   'Leads sincronizados do CRM (tabela bruta).',       'crm'),
  (null, 'crm_norm_contacts',                  'CRM · Contatos unificados',     'Contatos normalizados de Kommo/Ploomes/Omie.',     'crm'),
  (null, 'paid_traffic_daily_metrics',         'Tráfego pago · Métricas diárias','Spend/clicks/impressions por dia (Meta/Google).',  'ads'),
  (null, 'bai_kpi_snapshots',                  'BAI · Snapshots de KPI',        'Snapshot diário de KPIs por org (job 03:30 UTC).',  'kpi'),
  (null, 'vw_pipeline_health',                 'View · Saúde do pipeline',      'KPIs agregados de pipeline (conv, ticket, etc.).', 'kpi'),
  (null, 'vw_owner_performance',               'View · Performance por dono',   'Atividade e conversão por SDR/closer.',            'kpi'),
  (null, 'vw_forecast_revenue',                'View · Forecast ponderado',     'Receita projetada ponderada por estágio.',         'kpi'),
  (null, 'vw_contact_person_type_distribution','View · Distribuição PF/PJ',     'Contatos por tipo de pessoa (CNPJ vs CPF).',       'crm')
on conflict do nothing;

comment on table public.dashboard_data_sources is
  'Catálogo curado de tabelas/views consumíveis por widgets. Admin gerencia via /admin/data-sources.';
