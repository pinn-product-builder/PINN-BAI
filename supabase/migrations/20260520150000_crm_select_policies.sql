-- RLS de leitura nas tabelas crm_* unificadas.
--
-- Antes desta migration, as tabelas tinham RLS habilitado MAS nenhuma policy
-- de SELECT — efeito: a auditoria sempre devolvia 0 leads ainda que o banco
-- tivesse dados. RPC crm_audit_dashboard_range rodava como STABLE (herda RLS
-- do caller), então também voltava vazia.
--
-- Regra das policies:
--   - platform_admin lê qualquer tenant (consultor Pinn dando suporte)
--   - membros da org via profiles.org_id leem só os dados do próprio tenant

create or replace function public.user_can_read_tenant(_tenant_id uuid)
returns boolean
language sql stable security definer
set search_path = public, auth
as $$
  select
    public.is_platform_admin(auth.uid())
    or exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid() and p.org_id = _tenant_id
    );
$$;

grant execute on function public.user_can_read_tenant(uuid) to authenticated;

-- ── crm_leads ────────────────────────────────────────────────────────────────
drop policy if exists "crm_leads_select_member_or_admin" on public.crm_leads;
create policy "crm_leads_select_member_or_admin" on public.crm_leads
  for select to authenticated
  using (public.user_can_read_tenant(tenant_id));

-- ── crm_norm_contacts ────────────────────────────────────────────────────────
drop policy if exists "crm_contacts_select_member_or_admin" on public.crm_norm_contacts;
create policy "crm_contacts_select_member_or_admin" on public.crm_norm_contacts
  for select to authenticated
  using (public.user_can_read_tenant(tenant_id));

-- ── crm_pipelines ────────────────────────────────────────────────────────────
drop policy if exists "crm_pipelines_select_member_or_admin" on public.crm_pipelines;
create policy "crm_pipelines_select_member_or_admin" on public.crm_pipelines
  for select to authenticated
  using (public.user_can_read_tenant(tenant_id));

-- ── crm_stages ───────────────────────────────────────────────────────────────
drop policy if exists "crm_stages_select_member_or_admin" on public.crm_stages;
create policy "crm_stages_select_member_or_admin" on public.crm_stages
  for select to authenticated
  using (public.user_can_read_tenant(tenant_id));

-- ── crm_users ────────────────────────────────────────────────────────────────
drop policy if exists "crm_users_select_member_or_admin" on public.crm_users;
create policy "crm_users_select_member_or_admin" on public.crm_users
  for select to authenticated
  using (public.user_can_read_tenant(tenant_id));

-- ── crm_companies ────────────────────────────────────────────────────────────
drop policy if exists "crm_companies_select_member_or_admin" on public.crm_companies;
create policy "crm_companies_select_member_or_admin" on public.crm_companies
  for select to authenticated
  using (public.user_can_read_tenant(tenant_id));

-- ── crm_tasks ────────────────────────────────────────────────────────────────
drop policy if exists "crm_tasks_select_member_or_admin" on public.crm_tasks;
create policy "crm_tasks_select_member_or_admin" on public.crm_tasks
  for select to authenticated
  using (public.user_can_read_tenant(tenant_id));

-- ── crm_auditor_connections (leitura também — pra UI mostrar provider/status) ──
drop policy if exists "crm_connections_select_member_or_admin" on public.crm_auditor_connections;
create policy "crm_connections_select_member_or_admin" on public.crm_auditor_connections
  for select to authenticated
  using (public.user_can_read_tenant(tenant_id));

drop policy if exists "crm_connections_write_admin" on public.crm_auditor_connections;
create policy "crm_connections_write_admin" on public.crm_auditor_connections
  for all to authenticated
  using (public.user_can_read_tenant(tenant_id))
  with check (public.user_can_read_tenant(tenant_id));

-- ── Views base para a auditoria também precisam de acesso ────────────────────
-- Views não têm RLS própria — herdam das tabelas base. Já cobertas acima.
