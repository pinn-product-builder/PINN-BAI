-- GERAL (qualquer org, qualquer campo): distribuição de leads por um custom field,
-- incluindo os leads SEM o campo no bucket "Sem informação" (P1.3 — antes 60% dos
-- leads sumiam). Filtrável por período (created_at). Substitui as views eco bespoke.
-- Campo vem em p_filters->>'field_name' (a edge repassa o `filters` do widget).
create or replace function public.custom_field_distribution(
  p_org uuid,
  p_start timestamptz default null,
  p_end timestamptz default null,
  p_filters jsonb default '{}'::jsonb
)
returns table (value text, lead_count bigint)
language sql stable security definer set search_path = public as $$
  with leads_in_period as (
    select l.id, l.raw
    from public.crm_leads l
    where l.tenant_id = p_org
      and (p_start is null or l.created_at >= p_start)
      and (p_end   is null or l.created_at <= p_end)
  ),
  per_lead as (
    select lp.id,
      (
        select v.value ->> 'value'
        from jsonb_array_elements(coalesce(lp.raw -> 'custom_fields_values', '[]'::jsonb)) cf(value)
        cross join lateral jsonb_array_elements(coalesce(cf.value -> 'values', '[]'::jsonb)) v(value)
        where cf.value ->> 'field_name' = (p_filters ->> 'field_name')
        limit 1
      ) as fld_value
    from leads_in_period lp
  )
  select
    coalesce(nullif(btrim(fld_value), ''), 'Sem informação') as value,
    count(*) as lead_count
  from per_lead
  group by 1
  order by 2 desc;
$$;

grant execute on function public.custom_field_distribution(uuid, timestamptz, timestamptz, jsonb) to authenticated, service_role;
