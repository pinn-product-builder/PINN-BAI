-- crm_custom_fields ficou de fora do crm_select_policies (20260520150000): tinha RLS
-- habilitado mas SEM policy de SELECT → o frontend (authenticated) não conseguia ler
-- o CATÁLOGO de campos descoberto do Kommo. Isso é necessário pro editor de widget
-- mapear a fonte a partir dos campos REAIS do Kommo (não de views do Supabase).
--
-- Mesma regra das demais: platform_admin ou membro da org (tenants.id == org.id).

drop policy if exists "crm_custom_fields_select_member_or_admin" on public.crm_custom_fields;
create policy "crm_custom_fields_select_member_or_admin" on public.crm_custom_fields
  for select to authenticated
  using (public.user_can_read_tenant(tenant_id));
