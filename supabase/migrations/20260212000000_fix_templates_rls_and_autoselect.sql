-- =============================================
-- Fix RLS: permitir leitura de dashboard_templates para TODOS os usuários autenticados
-- Problema: templates não aparecem no onboarding por falta de policy
-- =============================================

-- Garantir que RLS está ativo
ALTER TABLE IF EXISTS public.dashboard_templates ENABLE ROW LEVEL SECURITY;

-- Remover policies antigas que possam conflitar
DROP POLICY IF EXISTS "Anyone can read active templates" ON public.dashboard_templates;
DROP POLICY IF EXISTS "templates_select_policy" ON public.dashboard_templates;
DROP POLICY IF EXISTS "templates_read_all" ON public.dashboard_templates;
DROP POLICY IF EXISTS "allow_read_templates" ON public.dashboard_templates;

-- Policy: qualquer usuário autenticado pode ler templates ativos
CREATE POLICY "allow_authenticated_read_templates"
ON public.dashboard_templates
FOR SELECT
TO authenticated
USING (is_active = true);

-- Policy: também permitir leitura via anon key (para testes e onboarding)
CREATE POLICY "allow_anon_read_templates"
ON public.dashboard_templates
FOR SELECT
TO anon
USING (is_active = true);

-- Garantir que o template premium existe e está ativo
UPDATE public.dashboard_templates 
SET is_active = true 
WHERE category = 'executive' AND name LIKE '%Premium%';
