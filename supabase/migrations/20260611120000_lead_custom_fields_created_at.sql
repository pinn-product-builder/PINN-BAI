-- Adiciona created_at à view por-linha de custom fields, pro filtro de período
-- (edge fetch-client-data aplica gte/lte em created_at). Append-only (mantém colunas).
create or replace view public.vw_bai_crm_lead_custom_fields as
select
  l.tenant_id                              as org_id,
  l.external_id                            as lead_external_id,
  l.stage_external_id,
  l.lead_status,
  cf.value ->> 'field_name'                as field_name,
  cf.value ->> 'field_type'                as field_type,
  v.value  ->> 'value'                     as value,
  l.created_at                             as created_at
from public.crm_leads l
cross join lateral jsonb_array_elements(coalesce(l.raw -> 'custom_fields_values', '[]'::jsonb)) cf(value)
cross join lateral jsonb_array_elements(coalesce(cf.value -> 'values', '[]'::jsonb)) v(value);
