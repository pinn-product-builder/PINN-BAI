-- Funil de vendas: mostra quantos leads CHEGARAM até cada etapa (acumulado,
-- decrescente) em vez do snapshot da etapa atual — que, quando os leads se
-- acumulam numa etapa só, mostrava apenas 1-2 barras.
--
-- "Chegou até a etapa X" ≈ lead não-perdido cuja etapa atual está em X ou além
-- (assume progressão pra frente; é o que dá pra inferir sem histórico de etapa).
-- Exclui etapas terminais (ganho/perdido, sort >= 10000) e a intake "Incoming".
create or replace view public.vw_bai_crm_stage_distribution as
with lead_pos as (
  select l.tenant_id, l.pipeline_external_id, l.id,
         coalesce(s.sort_order, 0) as cur_sort
  from public.crm_leads l
  left join public.crm_stages s
    on s.tenant_id = l.tenant_id
   and s.pipeline_external_id = l.pipeline_external_id
   and s.external_id = l.stage_external_id
  where l.lead_status <> 'lost'
),
funnel as (
  select st.tenant_id, st.pipeline_external_id, st.external_id, st.name, st.sort_order,
         count(lp.id) as lead_count
  from public.crm_stages st
  left join lead_pos lp
    on lp.tenant_id = st.tenant_id
   and lp.pipeline_external_id = st.pipeline_external_id
   and lp.cur_sort >= st.sort_order
  where st.sort_order < 10000                                    -- exclui ganho/perdido terminais
    and coalesce(st.stage_type, 'progress') not in ('won', 'lost')
  group by st.tenant_id, st.pipeline_external_id, st.external_id, st.name, st.sort_order
)
select
  f.tenant_id                              as org_id,
  coalesce(p.display_name, f.name)         as stage_name,
  f.lead_count,
  case
    when max(f.lead_count) over (partition by f.tenant_id, f.pipeline_external_id) = 0 then 0
    else round(100.0 * f.lead_count
               / nullif(max(f.lead_count) over (partition by f.tenant_id, f.pipeline_external_id), 0), 2)
  end                                      as pct_of_open_pipeline,  -- % vs topo do funil
  f.pipeline_external_id,
  f.external_id                            as stage_external_id,
  p.color                                  as stage_color,
  coalesce(p.sort_order, f.sort_order, 0)  as stage_sort_order,
  coalesce(p.is_visible, true)             as is_visible
from funnel f
left join public.vw_org_stage_presentation p
  on  p.tenant_id            = f.tenant_id
  and p.pipeline_external_id = f.pipeline_external_id
  and p.stage_external_id    = f.external_id
where coalesce(p.is_visible, true) = true;
