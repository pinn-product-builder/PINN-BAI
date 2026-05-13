-- Traduz nomes de dashboard_templates em inglês para PT-BR.
-- "Dashboard Professional" e "Dashboard Enterprise" foram criados em inglês
-- na fase inicial. Plataforma toda deve estar em pt-BR.

UPDATE public.dashboard_templates
SET name = 'Dashboard Profissional',
    updated_at = NOW()
WHERE name = 'Dashboard Professional';

UPDATE public.dashboard_templates
SET name = 'Dashboard Empresarial',
    updated_at = NOW()
WHERE name = 'Dashboard Enterprise';
