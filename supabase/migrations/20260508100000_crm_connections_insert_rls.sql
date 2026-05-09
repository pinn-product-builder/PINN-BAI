-- Permite criar registro de conexão CRM ao iniciar OAuth via API (tenant autenticado)

CREATE POLICY "crm_tenant_insert_connections"
  ON public.crm_connections FOR INSERT TO authenticated
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
