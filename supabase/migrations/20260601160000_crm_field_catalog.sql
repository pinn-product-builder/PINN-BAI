-- ─────────────────────────────────────────────────────────────────────────────
-- Catálogo de campos do CRM (descoberta) — alimenta o construtor de dashboard.
--
-- Por org, lista os campos customizados disponíveis no Kommo (Origem, Destino,
-- Reunião Agendada, etc.) com tipo e cardinalidade. O editor de widget oferece
-- esses campos num dropdown; o auto-build decide quais viram gráfico; o onboarding
-- mostra o que o cliente tem pra mapear. Genérico — cada cliente expõe os seus.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace view public.vw_bai_crm_field_catalog
with (security_invoker = on) as
select
  org_id,
  field_name,
  max(field_type)                       as field_type,
  count(distinct value)                 as distinct_values,
  count(distinct lead_external_id)       as leads_with_field
from public.vw_bai_crm_lead_custom_fields
where value is not null
  and btrim(value) <> ''
  and lower(value) <> 'false'
group by org_id, field_name;

grant select on public.vw_bai_crm_field_catalog to service_role, authenticated;

insert into public.dashboard_data_sources (org_id, key, display_name, description, category, columns)
values
  (null, 'vw_bai_crm_field_catalog', 'CRM · Catálogo de campos',
   'Campos customizados disponíveis por org (nome, tipo, nº de valores, leads). Base de descoberta do construtor.',
   'crm',
   '["field_name","field_type","distinct_values","leads_with_field"]'::jsonb)
on conflict do nothing;

comment on view public.vw_bai_crm_field_catalog is
  'Descoberta: campos customizados do CRM por org, pro construtor de dashboard escolher o que mapear.';
