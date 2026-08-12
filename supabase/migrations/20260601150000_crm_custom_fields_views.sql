-- ─────────────────────────────────────────────────────────────────────────────
-- Extração genérica de campos customizados do CRM (Kommo) pro dashboard.
--
-- Os leads do Kommo trazem campos customizados riquíssimos em
-- crm_leads.raw->'custom_fields_values' (ex.: Origem Lead, Destino de Interesse,
-- Reunião Agendada, Com Interação…) que não cabiam em colunas fixas. Estas views
-- achatam esse JSON em linhas consultáveis, de forma GENÉRICA (qualquer cliente
-- Kommo tem seus próprios campos disponíveis — sem hardcode de nome de campo).
--
-- O dashboard escolhe qual campo plotar via filtro no widget (field_name).
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Flatten: 1 linha por (lead, campo, valor). Cobre select/multiselect/checkbox.
create or replace view public.vw_bai_crm_lead_custom_fields
with (security_invoker = on) as
select
  l.tenant_id            as org_id,
  l.external_id          as lead_external_id,
  l.stage_external_id,
  l.lead_status,
  cf->>'field_name'      as field_name,
  cf->>'field_type'      as field_type,
  (v->>'value')          as value
from public.crm_leads l
cross join lateral jsonb_array_elements(coalesce(l.raw->'custom_fields_values', '[]'::jsonb)) cf
cross join lateral jsonb_array_elements(coalesce(cf->'values', '[]'::jsonb)) v;

-- 2. Distribuição: contagem de leads por (campo, valor) — base pros gráficos
--    "Leads por Origem", "Leads por Destino", etc. (widget filtra por field_name).
create or replace view public.vw_bai_crm_custom_field_distribution
with (security_invoker = on) as
select
  org_id,
  field_name,
  value,
  count(distinct lead_external_id) as lead_count
from public.vw_bai_crm_lead_custom_fields
where value is not null
  and btrim(value) <> ''
  and lower(value) <> 'false'   -- checkbox desmarcado não conta
group by org_id, field_name, value;

grant select on public.vw_bai_crm_lead_custom_fields        to service_role, authenticated;
grant select on public.vw_bai_crm_custom_field_distribution to service_role, authenticated;

-- Registra no catálogo de fontes (global)
insert into public.dashboard_data_sources (org_id, key, display_name, description, category, columns)
values
  (null, 'vw_bai_crm_custom_field_distribution', 'CRM · Campos customizados (distribuição)',
   'Contagem de leads por campo customizado do CRM (filtre por field_name). Ex.: Origem, Destino, Reunião Agendada.',
   'crm',
   '["field_name","value","lead_count"]'::jsonb)
on conflict do nothing;

comment on view public.vw_bai_crm_custom_field_distribution is
  'Distribuição de leads por campo customizado (Kommo raw). Genérico por cliente; o widget filtra por field_name.';
