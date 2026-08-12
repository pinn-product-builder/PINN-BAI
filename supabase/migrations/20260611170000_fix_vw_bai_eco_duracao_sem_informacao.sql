-- Corrige vw_bai_eco_duracao: leads SEM o custom field "Dias de Viagem"
-- desapareciam do widget (93 de 154 na Ecológica), porque a view partia de
-- vw_bai_crm_lead_custom_fields — que só tem linha para quem TEM o campo.
-- A base agora é crm_leads LEFT JOIN o campo: quem não tem cai no bucket
-- "Sem informação" e o widget volta a fechar com o total de leads.

create or replace view public.vw_bai_eco_duracao
with (security_invoker = on) as
with cf as (
  select org_id, lead_external_id, value
  from public.vw_bai_crm_lead_custom_fields
  where field_name = 'Dias de Viagem'
    and value is not null
    and btrim(value) <> ''
    and lower(value) <> 'false'
)
select
  l.tenant_id as org_id,
  case
    when cf.value is null then 'Sem informação'
    when cf.value ~* '[0-9]+\s*[dD]ia' then substring(cf.value, '([0-9]+)\s*[dD]ia') || ' dias'
    when btrim(cf.value) ~ '^[0-9]+$' then btrim(cf.value) || ' dias'
    else 'Não especificado'
  end as duracao,
  count(distinct l.external_id) as lead_count
from public.crm_leads l
left join cf
  on cf.org_id = l.tenant_id
 and cf.lead_external_id = l.external_id
group by 1, 2;
