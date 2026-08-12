-- ─────────────────────────────────────────────────────────────────────────────
-- Cascade de deleção: organização → tenant
--
-- Problema: o trigger tg_org_ensure_tenant cria um tenant (id == org.id) ao criar
-- a organização. Mas se a criação da org dá rollback depois (ex.: create-org-admin
-- falha em NewOrganization, que então deleta a org), o TENANT permanece órfão —
-- deletar a org não removia o tenant (tenants não tem FK pra organizations).
-- Resultado observado: 7 tenants "Ecológica Turismo" órfãos de tentativas que
-- falharam, com dados de CRM caindo em ids desacoplados da organização.
--
-- Fix: trigger AFTER DELETE em organizations que remove o tenant de mesmo id.
-- Como crm_auditor_connections / crm_leads / etc. têm FK tenant_id → tenants
-- ON DELETE CASCADE, remover o tenant limpa junto a conexão e os dados sincronizados.
-- Mantém a invariante org_id == tenant_id consistente em todo o ciclo de vida.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.delete_tenant_for_org()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.tenants where id = old.id;
  return old;
exception
  when others then
    raise warning 'delete_tenant_for_org: falha ao remover tenant da org % : %', old.id, sqlerrm;
    return old;
end;
$$;

drop trigger if exists tg_org_delete_tenant on public.organizations;
create trigger tg_org_delete_tenant
  after delete on public.organizations
  for each row execute function public.delete_tenant_for_org();

comment on function public.delete_tenant_for_org() is
  'Remove o tenant 1:1 quando a organização é deletada — evita tenants órfãos de criações revertidas.';
