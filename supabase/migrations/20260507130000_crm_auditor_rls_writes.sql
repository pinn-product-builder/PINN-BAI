-- Escrita CRM Auditor via cliente autenticado (JWT), sem service_role na API Node

CREATE POLICY "crm_tenant_insert_sync_runs"
  ON public.crm_sync_runs FOR INSERT TO authenticated
  WITH CHECK (
    (
      tenant_id = public.get_user_org_id(auth.uid())
      OR public.is_platform_admin(auth.uid())
    )
    AND (
      public.is_platform_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.role IN ('client_admin'::public.app_role, 'analyst'::public.app_role)
      )
    )
  );

CREATE POLICY "crm_tenant_update_sync_runs"
  ON public.crm_sync_runs FOR UPDATE TO authenticated
  USING (
    tenant_id = public.get_user_org_id(auth.uid())
    OR public.is_platform_admin(auth.uid())
  )
  WITH CHECK (
    tenant_id = public.get_user_org_id(auth.uid())
    OR public.is_platform_admin(auth.uid())
  );

CREATE POLICY "crm_tenant_insert_snapshots"
  ON public.crm_snapshots FOR INSERT TO authenticated
  WITH CHECK (
    (
      tenant_id = public.get_user_org_id(auth.uid())
      OR public.is_platform_admin(auth.uid())
    )
    AND (
      public.is_platform_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.role IN ('client_admin'::public.app_role, 'analyst'::public.app_role)
      )
    )
  );

CREATE POLICY "crm_tenant_update_connections"
  ON public.crm_connections FOR UPDATE TO authenticated
  USING (
    tenant_id = public.get_user_org_id(auth.uid())
    OR public.is_platform_admin(auth.uid())
  )
  WITH CHECK (
    tenant_id = public.get_user_org_id(auth.uid())
    OR public.is_platform_admin(auth.uid())
  );
