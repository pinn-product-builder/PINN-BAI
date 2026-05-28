-- Singleton: tabela de configurações globais da plataforma Pinn BAI.
-- Constraint id IS TRUE garante que só existe uma linha.

CREATE TABLE IF NOT EXISTS public.platform_settings (
  id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id IS TRUE),
  platform_name TEXT NOT NULL DEFAULT 'Pinn BAI',
  support_email TEXT NOT NULL DEFAULT 'suporte@pinn.com.br',
  default_plan INTEGER NOT NULL DEFAULT 2,
  trial_days INTEGER NOT NULL DEFAULT 14,
  maintenance_mode BOOLEAN NOT NULL DEFAULT false,
  allow_new_registrations BOOLEAN NOT NULL DEFAULT true,
  enable_notifications BOOLEAN NOT NULL DEFAULT true,
  enable_auto_insights BOOLEAN NOT NULL DEFAULT true,
  insights_interval INTEGER NOT NULL DEFAULT 24,
  enable_rls BOOLEAN NOT NULL DEFAULT true,
  max_file_size INTEGER NOT NULL DEFAULT 50,
  log_retention INTEGER NOT NULL DEFAULT 90,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Inserir linha default (única). ON CONFLICT garante idempotência.
INSERT INTO public.platform_settings (id) VALUES (true)
ON CONFLICT (id) DO NOTHING;

-- RLS permissiva: ferramenta interna Pinn. Qualquer usuário autenticado lê e escreve.
-- Se mais tarde precisarmos restringir, basta trocar pelo policy comentado abaixo.
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform_settings_select_authenticated"
  ON public.platform_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "platform_settings_update_authenticated"
  ON public.platform_settings FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Variante restritiva (descomente quando migrar pro modelo produção):
-- CREATE POLICY "platform_settings_update_platform_admin"
--   ON public.platform_settings FOR UPDATE TO authenticated
--   USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'platform_admin'));

COMMENT ON TABLE public.platform_settings IS 'Configurações globais da plataforma Pinn BAI. Uma única linha (id=true).';
