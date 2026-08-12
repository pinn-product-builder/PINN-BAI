-- ─────────────────────────────────────────────────────────────────────────────
-- F3 / Fase A — Camada de configuração de CRM por org (overlay sobre o descoberto)
--
-- Contexto: a sync do crm_auditor já descobre da API e persiste, por tenant:
--   • crm_stages       (name, sort_order, stage_type)        ← etapas reais do funil
--   • crm_custom_fields (name, field_type, raw->>'code')     ← catálogo de campos
--   • crm_leads        (stage_external_id, value, ...)       ← leads normalizados
--
-- O problema: a APRESENTAÇÃO (nome de exibição, cor, ordem, qual campo é email/
-- telefone) vive HOJE em constantes TypeScript hardcoded por cliente
-- (CANONICAL_SERIES_ORDER, SERIES_COLOR_MAP, TECH_NAME_MAP, "EMAIL"/"PHONE").
--
-- Esta migration move isso para o banco, SEM duplicar o que já é descoberto:
--   1. org_crm_stage_mappings — OVERLAY de OVERRIDES sobre crm_stages. Guarda só
--      o que o humano ajusta (nome/cor/ordem/visível). A sync NUNCA escreve aqui
--      → re-sync jamais sobrescreve escolha humana.
--   2. vw_org_stage_presentation — RESOLVER: junta crm_stages (default descoberto)
--      com o overlay (override), via coalesce. O dashboard lê daqui.
--   3. org_field_mappings — qual campo descoberto corresponde a cada campo lógico
--      (email/phone/...). Aqui SIM há auto-detecção (seed_org_field_mappings),
--      porque o mapper precisa saber qual é qual; mas insert é "do nothing" em
--      conflito → confirmação humana é preservada.
--
-- invariante usada: tenants.id == organizations.id (auto_provision_tenant).
-- Aditivo: nenhum objeto existente é alterado.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Overlay de apresentação de etapas (só overrides humanos) ──────────────
create table if not exists public.org_crm_stage_mappings (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  pipeline_external_id text not null,
  stage_external_id   text not null,
  display_name        text,            -- null → usa crm_stages.name
  color               text,            -- hex; null → frontend aplica paleta determinística por posição
  sort_order          int,             -- null → usa crm_stages.sort_order
  is_visible          boolean not null default true,
  stage_type_override text,            -- won|lost|progress; null → usa crm_stages.stage_type
  source              text not null default 'manual',  -- 'manual' (UI) | 'auto' (futuro seed)
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (tenant_id, pipeline_external_id, stage_external_id)
);

create index if not exists org_crm_stage_mappings_tenant_idx
  on public.org_crm_stage_mappings (tenant_id);

comment on table public.org_crm_stage_mappings is
  'Overlay de overrides humanos sobre crm_stages (nome/cor/ordem/visível). A sync nunca escreve aqui.';

-- ── 2. Resolver: default descoberto + override humano ────────────────────────
-- O dashboard consome esta view em vez das constantes hardcoded.
-- color fica NULL quando não houver override → o frontend computa cor
-- determinística por sort_order (substitui o SERIES_COLOR_MAP por-nome-de-etapa).
create or replace view public.vw_org_stage_presentation as
select
  s.tenant_id,
  s.pipeline_external_id,
  s.external_id                                          as stage_external_id,
  coalesce(m.display_name, nullif(s.name, ''), s.external_id) as display_name,
  m.color                                                as color,
  coalesce(m.sort_order, s.sort_order, 0)                as sort_order,
  coalesce(m.is_visible, true)                           as is_visible,
  coalesce(m.stage_type_override, s.stage_type)          as stage_type
from public.crm_stages s
left join public.org_crm_stage_mappings m
  on  m.tenant_id            = s.tenant_id
  and m.pipeline_external_id = s.pipeline_external_id
  and m.stage_external_id    = s.external_id;

comment on view public.vw_org_stage_presentation is
  'Apresentação resolvida das etapas por tenant: crm_stages (descoberto) + override do overlay.';

-- ── 3. Mapeamento de campos lógicos → campo descoberto ───────────────────────
-- logical_field: email | phone | document | value | name | source | (extensível)
create table if not exists public.org_field_mappings (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenants(id) on delete cascade,
  provider           text not null default 'kommo',
  entity_type        text not null default 'contact',   -- contact | lead | company
  logical_field      text not null,
  source_external_id text,            -- crm_custom_fields.external_id
  source_code        text,            -- field_code (ex.: EMAIL/PHONE) quando aplicável
  confirmed          boolean not null default false,     -- true após confirmação humana na UI
  source             text not null default 'auto',       -- 'auto' (detectado) | 'manual' (UI)
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (tenant_id, provider, entity_type, logical_field)
);

create index if not exists org_field_mappings_tenant_idx
  on public.org_field_mappings (tenant_id);

comment on table public.org_field_mappings is
  'Qual campo descoberto (crm_custom_fields) corresponde a cada campo lógico (email/phone/...). Fallback do mapper.';

-- ── 4. Auto-detecção de email/phone a partir do catálogo descoberto ──────────
-- Idempotente: insere só o que falta (on conflict do nothing), nunca sobrescreve
-- um mapeamento confirmado pelo humano. Provider Kommo (Ecológica) primeiro.
create or replace function public.seed_org_field_mappings(_tenant_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- email: prioriza o field_code padrão EMAIL do Kommo; cai p/ nome contendo "mail"
  insert into public.org_field_mappings
    (tenant_id, provider, entity_type, logical_field, source_external_id, source_code, source)
  select _tenant_id, 'kommo', 'contact', 'email', cf.external_id, cf.raw->>'code', 'auto'
  from public.crm_custom_fields cf
  where cf.tenant_id = _tenant_id
    and cf.entity_type = 'contact'
    and ( cf.raw->>'code' = 'EMAIL'
          or cf.name ilike '%e-mail%'
          or cf.name ilike '%email%' )
  order by (cf.raw->>'code' = 'EMAIL') desc, cf.synced_at desc
  limit 1
  on conflict (tenant_id, provider, entity_type, logical_field) do nothing;

  -- phone: prioriza o field_code padrão PHONE do Kommo; cai p/ nome PT-BR comum
  insert into public.org_field_mappings
    (tenant_id, provider, entity_type, logical_field, source_external_id, source_code, source)
  select _tenant_id, 'kommo', 'contact', 'phone', cf.external_id, cf.raw->>'code', 'auto'
  from public.crm_custom_fields cf
  where cf.tenant_id = _tenant_id
    and cf.entity_type = 'contact'
    and ( cf.raw->>'code' = 'PHONE'
          or cf.name ilike '%phone%'
          or cf.name ilike '%telefone%'
          or cf.name ilike '%celular%'
          or cf.name ilike '%whats%' )
  order by (cf.raw->>'code' = 'PHONE') desc, cf.synced_at desc
  limit 1
  on conflict (tenant_id, provider, entity_type, logical_field) do nothing;
end;
$$;

grant execute on function public.seed_org_field_mappings(uuid) to authenticated, service_role;

comment on function public.seed_org_field_mappings(uuid) is
  'Detecta email/phone no crm_custom_fields e semeia org_field_mappings (do nothing em conflito).';

-- ── 5. RLS — mesmo padrão de crm_select_policies (user_can_read_tenant) ──────
alter table public.org_crm_stage_mappings enable row level security;
alter table public.org_field_mappings      enable row level security;

-- leitura: platform_admin ou membro da org (== tenant)
drop policy if exists "org_stage_map_select" on public.org_crm_stage_mappings;
create policy "org_stage_map_select" on public.org_crm_stage_mappings
  for select to authenticated
  using (public.user_can_read_tenant(tenant_id));

drop policy if exists "org_field_map_select" on public.org_field_mappings;
create policy "org_field_map_select" on public.org_field_mappings
  for select to authenticated
  using (public.user_can_read_tenant(tenant_id));

-- escrita (via UI de mapeamento): mesma condição de tenant
-- (RBAC fino member/org_admin entra na Fase #43)
drop policy if exists "org_stage_map_write" on public.org_crm_stage_mappings;
create policy "org_stage_map_write" on public.org_crm_stage_mappings
  for all to authenticated
  using (public.user_can_read_tenant(tenant_id))
  with check (public.user_can_read_tenant(tenant_id));

drop policy if exists "org_field_map_write" on public.org_field_mappings;
create policy "org_field_map_write" on public.org_field_mappings
  for all to authenticated
  using (public.user_can_read_tenant(tenant_id))
  with check (public.user_can_read_tenant(tenant_id));

-- ── 6. updated_at automático ─────────────────────────────────────────────────
drop trigger if exists trg_org_stage_map_updated on public.org_crm_stage_mappings;
create trigger trg_org_stage_map_updated
  before update on public.org_crm_stage_mappings
  for each row execute function public.update_updated_at_column();

drop trigger if exists trg_org_field_map_updated on public.org_field_mappings;
create trigger trg_org_field_map_updated
  before update on public.org_field_mappings
  for each row execute function public.update_updated_at_column();

-- ── 7. Backfill: auto-detecta email/phone p/ tenants que já têm catálogo ─────
do $$
declare
  t record;
begin
  for t in
    select distinct tenant_id
    from public.crm_custom_fields
    where entity_type = 'contact'
  loop
    perform public.seed_org_field_mappings(t.tenant_id);
  end loop;
end;
$$;
