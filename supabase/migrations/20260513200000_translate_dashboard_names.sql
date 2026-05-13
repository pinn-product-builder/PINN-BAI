-- Renomeia dashboards padrão criados em inglês para PT-BR.
-- "Main Executive View" estava hardcoded no fluxo antigo de NewOrganization.
-- Plataforma toda deve estar em pt-BR.

UPDATE public.dashboards
SET name = 'Visão Executiva',
    updated_at = NOW()
WHERE name = 'Main Executive View';

UPDATE public.dashboards
SET name = 'Visão Executiva',
    updated_at = NOW()
WHERE name = 'Executive View';
