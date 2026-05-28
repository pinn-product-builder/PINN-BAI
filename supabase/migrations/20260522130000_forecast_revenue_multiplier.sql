-- Bug C2 do roadmap PINN BAY: forecast estava somando o `opportunity_value`
-- literal das oportunidades. No caso Kitou, esse campo guarda a DÍVIDA
-- tributária do lead (foco do produto deles), não a receita potencial pra
-- Kitou — que cobra um % sobre a recuperação.
--
-- Fix: multiplicador per-tenant em tenants.metadata.revenue_multiplier
-- (default 1.0 mantém compatibilidade). Para Kitou, setar ex.: 0.10 (10%).
-- View vw_forecast_revenue agora aplica.

-- Drop primeiro porque a view antiga tinha colunas em ordem diferente.
drop view if exists public.vw_forecast_revenue;
create view public.vw_forecast_revenue as
with progress_stages as (
  select s.tenant_id,
         s.pipeline_external_id,
         s.external_id as stage_external_id,
         s.sort_order,
         case
           when count(*) over (partition by s.tenant_id, s.pipeline_external_id) <= 1 then 0.5
           else (rank() over (partition by s.tenant_id, s.pipeline_external_id order by s.sort_order, s.external_id) - 1)::numeric
                / nullif(count(*) over (partition by s.tenant_id, s.pipeline_external_id) - 1, 0)::numeric
         end as stage_win_probability
    from crm_stages s
   where coalesce(s.stage_type, 'progress'::text) = 'progress'::text
),
revenue_config as (
  select t.id as tenant_id,
         coalesce(nullif(t.metadata->>'revenue_multiplier','')::numeric, 1.0) as multiplier,
         coalesce(nullif(t.metadata->>'revenue_label',''),
                  case when coalesce(nullif(t.metadata->>'revenue_multiplier','')::numeric, 1.0) < 1
                       then 'Receita ajustada por multiplicador per-tenant'
                       else 'Receita = soma de oportunidades'
                  end) as label
    from public.tenants t
)
select
  l.tenant_id,
  coalesce(round(sum(coalesce(l.opportunity_value, 0::numeric) * coalesce(ps.stage_win_probability, 0::numeric)) * rc.multiplier, 2), 0::numeric) as forecast_revenue,
  count(*) filter (where coalesce(l.opportunity_value, 0::numeric) > 0::numeric and ps.stage_win_probability is not null) as contributing_leads,
  count(*) filter (where l.lead_status = 'open'::text) as total_open_leads,
  rc.multiplier as revenue_multiplier,
  rc.label as methodology
from crm_leads l
left join progress_stages ps
  on ps.tenant_id = l.tenant_id
 and ps.pipeline_external_id = l.pipeline_external_id
 and ps.stage_external_id = l.stage_external_id
left join revenue_config rc on rc.tenant_id = l.tenant_id
where l.lead_status = 'open'::text
group by l.tenant_id, rc.multiplier, rc.label;

comment on view public.vw_forecast_revenue is
  'Forecast ponderado por posição de estágio × tenants.metadata.revenue_multiplier (default 1.0). Bug C2: separa "valor do lead" da "receita potencial da PIN".';
