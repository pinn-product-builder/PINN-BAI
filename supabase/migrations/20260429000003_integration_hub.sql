-- Integration Hub — registry of available connectors and per-org instances
-- Allows dynamic addition of new integrations without frontend deploys

-- ── integration_providers ─────────────────────────────────────────────────────
-- Platform-level catalogue: what integrations are available
create table if not exists public.integration_providers (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,           -- "meta_ads" | "google_ads" | "kommo" | "hubspot" | "rd_station"
  name          text not null,
  category      text not null,                  -- crm | paid_traffic | analytics | data | messaging
  description   text not null default '',
  logo_url      text,
  auth_flow     text not null default 'api_key', -- api_key | oauth2 | webhook
  credentials_schema jsonb not null default '[]'::jsonb, -- [{key, label, placeholder, type, required}]
  docs_url      text,
  is_active     boolean not null default true,
  sort_order    integer not null default 100,
  created_at    timestamptz not null default now()
);

-- Seed initial providers
insert into public.integration_providers (slug, name, category, description, auth_flow, credentials_schema, sort_order) values
  ('kommo',        'Kommo (amoCRM)',        'crm',          'CRM de conversas líder na América Latina.', 'api_key',
   '[{"key":"subdomain","label":"Subdomínio","placeholder":"minha-empresa","required":true},{"key":"access_token","label":"Access Token","placeholder":"Bearer token OAuth2","type":"password","required":true}]',
   10),
  ('hubspot',      'HubSpot',               'crm',          'CRM completo com automação de marketing.', 'api_key',
   '[{"key":"api_key","label":"API Key","placeholder":"pat-na1-...","type":"password","required":true}]',
   20),
  ('rd_station',   'RD Station CRM',        'crm',          'CRM e automação de marketing para o mercado brasileiro.', 'api_key',
   '[{"key":"api_key","label":"API Key","placeholder":"Sua chave de API do RD Station","type":"password","required":true}]',
   30),
  ('meta_ads',     'Meta Ads',              'paid_traffic', 'Facebook & Instagram Ads. Conecte campanhas e métricas de performance.', 'api_key',
   '[{"key":"access_token","label":"Access Token","placeholder":"Token de longa duração","type":"password","required":true},{"key":"account_id","label":"Ad Account ID","placeholder":"act_123456789","required":true}]',
   40),
  ('google_ads',   'Google Ads',            'paid_traffic', 'Search, Display e YouTube Ads. Acompanhe ROAS e CPL em tempo real.', 'api_key',
   '[{"key":"developer_token","label":"Developer Token","placeholder":"Seu developer token","type":"password","required":true},{"key":"customer_id","label":"Customer ID","placeholder":"123-456-7890","required":true},{"key":"refresh_token","label":"Refresh Token","placeholder":"Token OAuth2 de refresh","type":"password","required":true}]',
   50),
  ('google_analytics', 'Google Analytics 4', 'analytics',  'Análise de tráfego web e comportamento de usuários.', 'api_key',
   '[{"key":"property_id","label":"Property ID","placeholder":"properties/123456789","required":true},{"key":"service_account_json","label":"Service Account JSON","placeholder":"Cole o JSON da service account","type":"textarea","required":true}]',
   60),
  ('google_sheets', 'Google Sheets',        'data',         'Importe dados de planilhas Google diretamente no dashboard.', 'api_key',
   '[{"key":"spreadsheet_id","label":"Spreadsheet ID","placeholder":"1BxiMVs0XRA5nZm4...","required":true},{"key":"service_account_json","label":"Service Account JSON","placeholder":"Cole o JSON da service account","type":"textarea","required":false}]',
   70),
  ('supabase',     'Supabase',              'data',         'Conecte sua base de dados Supabase como fonte de dados externa.', 'api_key',
   '[{"key":"url","label":"Project URL","placeholder":"https://xyz.supabase.co","required":true},{"key":"anon_key","label":"Anon Key","placeholder":"eyJh...","type":"password","required":true}]',
   80),
  ('webhook',      'Webhook Genérico',      'data',         'Receba dados de qualquer sistema via webhook HTTP.', 'webhook',
   '[{"key":"secret","label":"Webhook Secret","placeholder":"Chave para validar o payload","type":"password","required":false}]',
   90),
  ('stripe',       'Stripe',                'data',         'Dados de pagamentos, MRR e churn financeiro.', 'api_key',
   '[{"key":"secret_key","label":"Secret Key","placeholder":"sk_live_...","type":"password","required":true}]',
   100)
on conflict (slug) do nothing;

-- ── hub_connections ───────────────────────────────────────────────────────────
-- Per-org connection instances (replaces/unifies the old "integrations" table concept)
create table if not exists public.hub_connections (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations(id) on delete cascade,
  provider_slug   text not null references public.integration_providers(slug),
  display_name    text not null,               -- user-defined nickname
  credentials     jsonb not null default '{}', -- encrypted at rest by Supabase Vault ideally
  status          text not null default 'pending', -- pending | connected | error | paused
  sync_status     text not null default 'idle',
  last_sync_at    timestamptz,
  sync_error      text,
  sync_config     jsonb not null default '{}', -- {frequency_minutes, sync_days_back, ...}
  metadata        jsonb not null default '{}', -- provider-specific enrichment (account_name, etc.)
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (org_id, provider_slug, display_name)
);

alter table public.hub_connections enable row level security;
create policy "org members can manage their hub connections"
  on public.hub_connections for all
  using (org_id in (select org_id from public.profiles where id = auth.uid()));

create index if not exists hub_connections_org_provider_idx
  on public.hub_connections (org_id, provider_slug);

create trigger update_hub_connections_updated_at
  before update on public.hub_connections
  for each row execute function public.update_updated_at_column();
