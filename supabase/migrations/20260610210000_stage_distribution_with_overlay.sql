-- Conecta o overlay de etapas (org_crm_stage_mappings, via vw_org_stage_presentation)
-- ao funil do dashboard: a vw_bai_crm_stage_distribution passa a expor o nome de
-- exibição, a cor, a ordem e a visibilidade configurados pelo cliente — sem hardcode.
--
-- create or replace exige manter as 4 colunas originais (org_id, stage_name, lead_count,
-- pct_of_open_pipeline) na MESMA ordem; as novas entram só no fim.
create or replace view public.vw_bai_crm_stage_distribution as
select
  c.tenant_id                              as org_id,
  coalesce(p.display_name, c.stage_name)   as stage_name,        -- exibição (overlay > descoberto)
  c.lead_count,
  c.pct_of_open_pipeline,
  -- novas colunas (append):
  c.pipeline_external_id,
  c.stage_external_id,
  p.color                                  as stage_color,        -- null → frontend usa paleta
  coalesce(p.sort_order, 0)                as stage_sort_order,   -- ordem do funil (pipeline)
  coalesce(p.is_visible, true)             as is_visible
from public.vw_stage_conversion c
left join public.vw_org_stage_presentation p
  on  p.tenant_id            = c.tenant_id
  and p.pipeline_external_id = c.pipeline_external_id
  and p.stage_external_id    = c.stage_external_id
where coalesce(p.is_visible, true) = true;  -- etapas marcadas invisíveis somem do funil
