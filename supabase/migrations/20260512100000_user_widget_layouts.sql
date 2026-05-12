-- Layout customizado de widgets por usuário+org+página (drag/drop universal).
-- Salva a posição/tamanho de cada widget num dashboard. Layout segue o
-- usuário em qualquer dispositivo onde ele logar (vs. localStorage que
-- não sincroniza).

CREATE TABLE IF NOT EXISTS public.user_widget_layouts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id      uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  -- Identifica qual página/grid o layout pertence. Ex: 'arguto:snapshot',
  -- 'unit-economics', 'customer-health', 'global-hq', 'dashboard:<dashId>'.
  page_key    text NOT NULL,
  -- Estrutura completa do `Layouts` do react-grid-layout (todos os breakpoints).
  layouts     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, org_id, page_key)
);

CREATE INDEX IF NOT EXISTS idx_user_widget_layouts_lookup
  ON public.user_widget_layouts (user_id, org_id, page_key);

-- Trigger pra manter updated_at fresco em UPDATE.
CREATE OR REPLACE FUNCTION public.touch_user_widget_layouts()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_user_widget_layouts ON public.user_widget_layouts;
CREATE TRIGGER trg_touch_user_widget_layouts
  BEFORE UPDATE ON public.user_widget_layouts
  FOR EACH ROW EXECUTE FUNCTION public.touch_user_widget_layouts();

-- RLS: usuário só lê/escreve seus próprios layouts, e somente para orgs
-- onde ele tem acesso (igual ao padrão do resto da plataforma).
ALTER TABLE public.user_widget_layouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "uwl_select_own"
  ON public.user_widget_layouts FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    AND (
      org_id = public.get_user_org_id(auth.uid())
      OR public.is_platform_admin(auth.uid())
    )
  );

CREATE POLICY "uwl_insert_own"
  ON public.user_widget_layouts FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      org_id = public.get_user_org_id(auth.uid())
      OR public.is_platform_admin(auth.uid())
    )
  );

CREATE POLICY "uwl_update_own"
  ON public.user_widget_layouts FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    AND (
      org_id = public.get_user_org_id(auth.uid())
      OR public.is_platform_admin(auth.uid())
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    AND (
      org_id = public.get_user_org_id(auth.uid())
      OR public.is_platform_admin(auth.uid())
    )
  );

CREATE POLICY "uwl_delete_own"
  ON public.user_widget_layouts FOR DELETE TO authenticated
  USING (user_id = auth.uid());

COMMENT ON TABLE public.user_widget_layouts IS
  'Posição/tamanho personalizados de widgets por usuário+org+página. Alimenta o drag/drop universal dos dashboards (react-grid-layout).';
