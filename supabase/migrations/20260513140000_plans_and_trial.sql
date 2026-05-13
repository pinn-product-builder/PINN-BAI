-- =====================================================================
-- Plans (catálogo editável) + Trial em organizations
-- =====================================================================
--
-- 1) Tabela `plans` substitui o map hardcoded `planNames` em mock-data.ts.
--    Permite editar nome, descrição, ativar/desativar e remover planos
--    direto do Settings → Planos sem deploy.
--
-- 2) `organizations.trial_ends_at` armazena quando o trial expira.
--    Status `trial` + `trial_ends_at < now()` = acesso suspenso
--    (verificado no front em useOrgAccessGate).
-- =====================================================================

-- ---------- 1. plans ---------------------------------------------------

CREATE TABLE IF NOT EXISTS public.plans (
  id           integer PRIMARY KEY,
  name         text NOT NULL,
  full_name    text NOT NULL,
  description  text NOT NULL DEFAULT '',
  is_active    boolean NOT NULL DEFAULT true,
  sort_order   integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.plans IS
  'Catálogo de planos comerciais Pinn. Editável via Admin → Settings → Planos.';

CREATE OR REPLACE FUNCTION public.touch_plans()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_plans ON public.plans;
CREATE TRIGGER trg_touch_plans
  BEFORE UPDATE ON public.plans
  FOR EACH ROW EXECUTE FUNCTION public.touch_plans();

-- Seed inicial (idempotente). Mantém os IDs 1..5 que já circulam no
-- código atual (organizations.plan int) para não invalidar dados existentes.
INSERT INTO public.plans (id, name, full_name, description, sort_order)
VALUES
  (1, 'Agent Sales',     'Pinn Agent Sales',            'Lead tracking & conversion',         1),
  (2, 'Revenue OS',      'Pinn Revenue OS',             'Revenue forecasting & pipeline',     2),
  (3, 'Growth Engine',   'Pinn Growth Engine',          'Attribution & LTV/CAC',              3),
  (4, 'Automation Hub',  'Pinn Process Automation Hub', 'Bot ROI & throughput',               4),
  (5, 'MicroSaaS Studio','Pinn MicroSaaS Studio',       'Universal BI & Semantic Layer',      5)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

-- Leitura pública pra qualquer usuário autenticado (só metadata, sem PII).
DROP POLICY IF EXISTS "plans_select_authenticated" ON public.plans;
CREATE POLICY "plans_select_authenticated"
  ON public.plans FOR SELECT TO authenticated
  USING (true);

-- Escrita só pra platform_admin.
DROP POLICY IF EXISTS "plans_write_platform_admin" ON public.plans;
CREATE POLICY "plans_write_platform_admin"
  ON public.plans FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

-- ---------- 2. trial_ends_at ------------------------------------------

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz;

COMMENT ON COLUMN public.organizations.trial_ends_at IS
  'Quando o período de trial expira. Se status=trial e trial_ends_at < now(), acesso é bloqueado no front.';

-- Helper: detecta se uma org está em trial expirado. Usado por views/RPC
-- e potencialmente por gates de acesso futuros no backend.
CREATE OR REPLACE FUNCTION public.is_trial_expired(_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organizations o
    WHERE o.id = _org_id
      AND o.status = 'trial'
      AND o.trial_ends_at IS NOT NULL
      AND o.trial_ends_at < now()
  );
$$;
