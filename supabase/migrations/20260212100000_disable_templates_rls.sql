-- =============================================
-- Desativar RLS em dashboard_templates
-- Templates são dados públicos, não precisam de restrição de acesso
-- =============================================

ALTER TABLE IF EXISTS public.dashboard_templates DISABLE ROW LEVEL SECURITY;
