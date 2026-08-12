-- View por-linha (1 row por lead) com created_at + flags + metadados de etapa.
-- Permite TODO o dashboard responder ao filtro de período: contagens viram
-- sum(flag) e taxas viram fórmula (sum(flag)/sum(one_count)), tudo filtrável por
-- created_at na edge. Reproduz as métricas de vw_bai_eco_kpis/vw_bai_crm_kpis.
-- (Flags de custom field são específicas da Ecológica, como já era na vw_bai_eco_kpis.)
create or replace view public.vw_bai_eco_leads_flat as
with cf as (
  select lead_external_id, org_id,
    bool_or(field_name = 'PDF ENVIADO JÁ'  and lower(value) = 'true') as material_enviado,
    bool_or(field_name = 'REUNIÃO MARCADA' and lower(value) = 'true') as reunioes_marcadas,
    bool_or(field_name = 'DESATIVAR IA'    and lower(value) = 'true') as repassados_humano,
    bool_or(field_name = 'COM INTERAÇÃO'   and lower(value) = 'true') as com_interacao,
    bool_or(field_name = 'ENTRADA'         and lower(value) = 'true') as entrada
  from public.vw_bai_crm_lead_custom_fields
  group by lead_external_id, org_id
)
select
  l.tenant_id                              as org_id,
  l.external_id                            as lead_external_id,
  l.created_at,
  l.pipeline_external_id,
  l.stage_external_id,
  coalesce(p.display_name, st.name, l.stage_external_id) as stage_name,
  p.color                                  as stage_color,
  coalesce(p.sort_order, st.sort_order, 0) as stage_sort_order,
  coalesce(p.is_visible, true)             as is_visible,
  l.lead_status,
  l.value,
  1                                        as one_count,
  coalesce(cf.material_enviado::int, 0)    as material_enviado,
  coalesce(cf.reunioes_marcadas::int, 0)   as reunioes_marcadas,
  coalesce(cf.repassados_humano::int, 0)   as repassados_humano,
  coalesce(cf.com_interacao::int, 0)       as com_interacao,
  coalesce(cf.entrada::int, 0)             as entrada
from public.crm_leads l
left join public.crm_stages st
  on st.tenant_id = l.tenant_id and st.pipeline_external_id = l.pipeline_external_id and st.external_id = l.stage_external_id
left join public.vw_org_stage_presentation p
  on p.tenant_id = l.tenant_id and p.pipeline_external_id = l.pipeline_external_id and p.stage_external_id = l.stage_external_id
left join cf
  on cf.lead_external_id = l.external_id and cf.org_id = l.tenant_id;
