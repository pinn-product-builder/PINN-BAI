-- ─────────────────────────────────────────────────────────────────────────────
-- Auto-provisionamento de tenant por organização
--
-- Problema: as tabelas do CRM Auditor (crm_auditor_connections, crm_leads, ...)
-- têm FK tenant_id → tenants(id), mas criar uma organização NÃO criava o tenant
-- correspondente. Resultado: ao conectar Kommo/Omie numa org nova, o insert em
-- crm_auditor_connections falhava por violação de FK. Evidência: a org "Arguto"
-- existe sem tenant.
--
-- Solução: trigger AFTER INSERT em organizations que cria 1:1 o tenant com o
-- MESMO id (tenants.id == organizations.id — invariante já usada pelo backend e
-- pelas views-ponte vw_bai_crm_*). Genérico, sem hardcode, cobre qualquer via de
-- criação (UI, edge create-org-admin, API, insert manual).
--
-- Robustez:
--   • SECURITY DEFINER → roda como owner, contorna a RLS de tenants (sem policy)
--   • guarda de slug → evita violar o unique(slug) de tenants
--   • exception handler → se algo falhar, loga warning mas NUNCA bloqueia a
--     criação da organização
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.ensure_tenant_for_org()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  safe_slug text;
begin
  -- Slug único: usa o da org; se já existir em tenants, sufixa parte do id.
  safe_slug := new.slug;
  if exists (select 1 from public.tenants t where t.slug = safe_slug) then
    safe_slug := new.slug || '-' || left(new.id::text, 8);
  end if;

  insert into public.tenants (id, name, slug, metadata)
  values (new.id, new.name, safe_slug, '{}'::jsonb)
  on conflict (id) do nothing;

  return new;
exception
  when others then
    -- Nunca derruba a criação da org por causa do provisionamento do tenant.
    raise warning 'ensure_tenant_for_org: falha ao provisionar tenant para org % (%): %',
      new.id, new.name, sqlerrm;
    return new;
end;
$$;

drop trigger if exists tg_org_ensure_tenant on public.organizations;
create trigger tg_org_ensure_tenant
  after insert on public.organizations
  for each row execute function public.ensure_tenant_for_org();

-- ── Backfill: orgs existentes sem tenant (ex.: Arguto) ───────────────────────
insert into public.tenants (id, name, slug, metadata)
select
  o.id,
  o.name,
  case
    when exists (select 1 from public.tenants t where t.slug = o.slug)
      then o.slug || '-' || left(o.id::text, 8)
    else o.slug
  end,
  '{}'::jsonb
from public.organizations o
where not exists (select 1 from public.tenants t where t.id = o.id)
on conflict (id) do nothing;

comment on function public.ensure_tenant_for_org() is
  'Cria 1:1 um tenant (id == org.id) ao inserir uma organização. Destrava conexões CRM/ERP (FK tenant_id) e as views-ponte vw_bai_crm_*.';
