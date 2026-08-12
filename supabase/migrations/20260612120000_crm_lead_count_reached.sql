-- Estende crm_lead_count com um predicado GERAL "reached" (funil cumulativo por
-- snapshot): conta leads cuja ETAPA ATUAL está num conjunto de etapas nomeadas
-- (= "chegou nesta etapa ou além"), opcionalmente incluindo won/lost. Reproduz a
-- lógica dos flags da QuitouBR (qb_refresh) de forma canônica, server-side, sem
-- teto, period-aware — e serve qualquer cliente com funil por etapas.
--
-- p_filters.reached = { stage_names: ["A","B",...], also_won?: bool, also_lost?: bool }
-- Mantém compatível: sem `reached`, comporta-se como antes (Ecológica intocada).
create or replace function public.crm_lead_count(
  p_org uuid, p_start timestamptz default null, p_end timestamptz default null, p_filters jsonb default '{}'::jsonb
)
returns table (lead_count bigint)
language sql stable security definer set search_path = public as $$
  with base as (
    select l.id, l.lead_status, l.stage_external_id, l.raw, coalesce(s.name, '') as stage_name
    from public.crm_leads l
    left join public.crm_stages s
      on s.tenant_id = l.tenant_id and s.pipeline_external_id = l.pipeline_external_id and s.external_id = l.stage_external_id
    where l.tenant_id = p_org
      and (p_start is null or l.created_at >= p_start)
      and (p_end   is null or l.created_at <= p_end)
  )
  select count(*)
  from base b
  where (p_filters ->> 'lead_status'       is null or b.lead_status       = p_filters ->> 'lead_status')
    and (p_filters ->> 'stage_name'        is null or b.stage_name        = p_filters ->> 'stage_name')
    and (p_filters ->> 'stage_external_id' is null or b.stage_external_id = p_filters ->> 'stage_external_id')
    and (p_filters -> 'reached' is null or (
          b.stage_name = any (array(select jsonb_array_elements_text(p_filters -> 'reached' -> 'stage_names')))
          or (coalesce(p_filters -> 'reached' ->> 'also_won', '')  = 'true' and b.lead_status = 'won')
          or (coalesce(p_filters -> 'reached' ->> 'also_lost', '') = 'true' and b.lead_status = 'lost')
        ))
    and (p_filters ->> 'field_name' is null or exists (
      select 1
      from jsonb_array_elements(coalesce(b.raw -> 'custom_fields_values', '[]'::jsonb)) cf(value)
      cross join lateral jsonb_array_elements(coalesce(cf.value -> 'values', '[]'::jsonb)) v(value)
      where cf.value ->> 'field_name' = p_filters ->> 'field_name'
        and (p_filters ->> 'field_value' is null
             or lower(v.value ->> 'value') = lower(p_filters ->> 'field_value'))
    ));
$$;

grant execute on function public.crm_lead_count(uuid, timestamptz, timestamptz, jsonb) to authenticated, service_role;
