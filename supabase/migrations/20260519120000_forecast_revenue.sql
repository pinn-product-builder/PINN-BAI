-- Bug 4 — Forecast de receita real (pipeline-weighted).
--
-- Substitui o score "forecast_0_100" (qualidade do forecast) por uma previsão
-- monetária real: Σ(oportunidade × probabilidade do estágio).
--
-- Metodologia: pipeline-weighted forecast.
--   - Probabilidade do estágio = posição relativa no funil (sort_order normalizado
--     entre os estágios "progress" do pipeline). Estágio inicial ≈ 0%, estágio
--     final ≈ 100%.
--   - Pondera apenas leads em aberto com opportunity_value preenchido (sem
--     value_config configurado, forecast = 0, evitando inflar com dívida cru).
--
-- Limitação conhecida: sem histórico de transições, a probabilidade é heurística
-- por posição. Quando crm_stage_probabilities (admin override) for implementado,
-- substituir o cálculo de pos_pct pela probabilidade configurada.

create or replace view public.vw_forecast_revenue as
with progress_stages as (
  select
    s.tenant_id,
    s.pipeline_external_id,
    s.external_id as stage_external_id,
    s.sort_order,
    -- Posição relativa do estágio entre os "progress" (0 = primeiro, 1 = último).
    -- Estágios won/lost são excluídos para não distorcer a normalização.
    case
      when count(*) over (partition by s.tenant_id, s.pipeline_external_id) <= 1 then 0.5
      else (rank() over (partition by s.tenant_id, s.pipeline_external_id order by s.sort_order, s.external_id) - 1)::numeric
           / nullif(count(*) over (partition by s.tenant_id, s.pipeline_external_id) - 1, 0)
    end as stage_win_probability
  from public.crm_stages s
  where coalesce(s.stage_type, 'progress') = 'progress'
)
select
  l.tenant_id,
  coalesce(round(sum(coalesce(l.opportunity_value, 0) * coalesce(ps.stage_win_probability, 0))::numeric, 2), 0) as forecast_revenue,
  count(*) filter (where coalesce(l.opportunity_value, 0) > 0 and ps.stage_win_probability is not null) as contributing_leads,
  count(*) filter (where l.lead_status = 'open') as total_open_leads,
  'pipeline_weighted_by_stage_position'::text as methodology
from public.crm_leads l
left join progress_stages ps
  on ps.tenant_id = l.tenant_id
  and ps.pipeline_external_id = l.pipeline_external_id
  and ps.stage_external_id = l.stage_external_id
where l.lead_status = 'open'
group by l.tenant_id;

comment on view public.vw_forecast_revenue is
  'Previsão de receita pelo método pipeline-weighted. forecast_revenue = Σ(opportunity_value × stage_win_probability). Sem opportunity_value preenchido (value_config ausente), forecast = 0.';
