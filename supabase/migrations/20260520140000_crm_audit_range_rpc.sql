-- F37 — RPC que recalcula a auditoria CRM dentro de uma janela temporal.
--
-- Hoje fetchCrmAuditDashboard puxa de views agregadas (vw_pipeline_health,
-- vw_owner_performance, etc.) que não conhecem coluna de data. Com isso, filtro
-- de período do usuário não impactava /crm-audit — gerava inconsistência: o
-- card mostrava 1,1% no recorte, a auditoria mostrava outro número (histórico).
--
-- Esta RPC recalcula as métricas filtrando crm_leads por created_at na janela
-- recebida. Quando _start/_end são NULL, equivale ao histórico completo.

create or replace function public.crm_audit_dashboard_range(
  _tenant_id uuid,
  _start timestamptz default null,
  _end timestamptz default null
) returns jsonb
language plpgsql stable as $$
declare
  out_overview            jsonb;
  out_pipeline_health     jsonb;
  out_owner_performance   jsonb;
  out_lost_reasons        jsonb;
  out_stage_distribution  jsonb;
  out_forecast_revenue    jsonb;
  out_person_type         jsonb;
begin
  with leads_window as (
    select l.*
    from public.crm_leads l
    where l.tenant_id = _tenant_id
      and ( _start is null or l.created_at >= _start )
      and ( _end   is null or l.created_at <= _end   )
  )
  select jsonb_build_object(
    'total_leads_all_status',     count(*),
    'total_active_leads',         count(*) filter (where lead_status = 'open'),
    'total_won_leads',            count(*) filter (where lead_status = 'won'),
    'total_lost_leads',           count(*) filter (where lead_status = 'lost'),
    'total_open_pipeline_value',  coalesce(sum(coalesce(opportunity_value, 0)) filter (where lead_status = 'open'), 0),
    'open_leads_without_value',   count(*) filter (where lead_status = 'open' and (opportunity_value is null or opportunity_value = 0)),
    'open_leads_without_owner',   count(*) filter (where lead_status = 'open' and owner_external_id is null),
    'open_leads_without_source',  count(*) filter (where lead_status = 'open' and (source is null or trim(source) = ''))
  )
  into out_overview
  from leads_window;

  -- Pipeline health (por estágio dentro de cada pipeline)
  with leads_window as (
    select l.* from public.crm_leads l
    where l.tenant_id = _tenant_id
      and ( _start is null or l.created_at >= _start )
      and ( _end   is null or l.created_at <= _end   )
  )
  select coalesce(jsonb_agg(t), '[]'::jsonb)
  into out_pipeline_health
  from (
    select
      l.pipeline_external_id,
      coalesce(p.name, l.pipeline_external_id)  as pipeline_name,
      l.stage_external_id,
      coalesce(s.name, l.stage_external_id)     as stage_name,
      count(*) filter (where l.lead_status = 'open')   as open_leads,
      count(*) filter (where l.lead_status = 'won')    as won_leads,
      count(*) filter (where l.lead_status = 'lost')   as lost_leads,
      coalesce(sum(coalesce(l.opportunity_value, 0)) filter (where l.lead_status = 'open'), 0) as open_pipeline_value
    from leads_window l
    left join public.crm_pipelines p
      on p.tenant_id = l.tenant_id and p.external_id = l.pipeline_external_id
    left join public.crm_stages s
      on s.tenant_id = l.tenant_id
      and s.pipeline_external_id = l.pipeline_external_id
      and s.external_id = l.stage_external_id
    group by l.pipeline_external_id, p.name, l.stage_external_id, s.name
  ) t;

  with leads_window as (
    select l.* from public.crm_leads l
    where l.tenant_id = _tenant_id
      and ( _start is null or l.created_at >= _start )
      and ( _end   is null or l.created_at <= _end   )
  )
  select coalesce(jsonb_agg(t), '[]'::jsonb)
  into out_owner_performance
  from (
    select
      l.owner_external_id,
      coalesce(u.name, l.owner_external_id) as owner_name,
      count(*) filter (where l.lead_status = 'open') as open_leads,
      count(*) filter (where l.lead_status = 'won')  as won_leads,
      count(*) filter (where l.lead_status = 'lost') as lost_leads,
      coalesce(sum(coalesce(l.opportunity_value, 0)) filter (where l.lead_status = 'open'), 0) as open_value
    from leads_window l
    left join public.crm_users u
      on u.tenant_id = l.tenant_id and u.external_id = l.owner_external_id
    group by l.owner_external_id, u.name
  ) t;

  -- Lost reasons no período
  with leads_window as (
    select l.* from public.crm_leads l
    where l.tenant_id = _tenant_id
      and ( _start is null or l.created_at >= _start )
      and ( _end   is null or l.created_at <= _end   )
  )
  select coalesce(jsonb_agg(t), '[]'::jsonb)
  into out_lost_reasons
  from (
    select
      coalesce(nullif(trim(lost_reason), ''), '(não informado)') as lost_reason,
      count(*) as cnt
    from leads_window
    where lead_status = 'lost'
    group by coalesce(nullif(trim(lost_reason), ''), '(não informado)')
    order by cnt desc
    limit 20
  ) t;

  -- Stage distribution (open leads por estágio com % do pipeline)
  with leads_window as (
    select l.* from public.crm_leads l
    where l.tenant_id = _tenant_id
      and ( _start is null or l.created_at >= _start )
      and ( _end   is null or l.created_at <= _end   )
  ),
  per_stage as (
    select
      l.pipeline_external_id,
      l.stage_external_id,
      coalesce(s.name, l.stage_external_id) as stage_name,
      count(*) as lead_count
    from leads_window l
    left join public.crm_stages s
      on s.tenant_id = l.tenant_id
      and s.pipeline_external_id = l.pipeline_external_id
      and s.external_id = l.stage_external_id
    where l.lead_status = 'open'
    group by l.pipeline_external_id, l.stage_external_id, s.name
  )
  select coalesce(jsonb_agg(t), '[]'::jsonb)
  into out_stage_distribution
  from (
    select
      stage_external_id,
      stage_name,
      lead_count,
      case
        when sum(lead_count) over (partition by pipeline_external_id) = 0 then 0
        else round(100.0 * lead_count::numeric / nullif(sum(lead_count) over (partition by pipeline_external_id), 0), 2)
      end as pct_of_open_pipeline
    from per_stage
  ) t;

  -- Forecast revenue (mesmo cálculo do vw_forecast_revenue mas com janela)
  with leads_window as (
    select l.* from public.crm_leads l
    where l.tenant_id = _tenant_id
      and ( _start is null or l.created_at >= _start )
      and ( _end   is null or l.created_at <= _end   )
  ),
  progress_stages as (
    select s.pipeline_external_id, s.external_id as stage_external_id, s.sort_order,
      case
        when count(*) over (partition by s.pipeline_external_id) <= 1 then 0.5
        else (rank() over (partition by s.pipeline_external_id order by s.sort_order, s.external_id) - 1)::numeric
             / nullif(count(*) over (partition by s.pipeline_external_id) - 1, 0)
      end as stage_win_probability
    from public.crm_stages s
    where s.tenant_id = _tenant_id and coalesce(s.stage_type, 'progress') = 'progress'
  )
  select jsonb_build_object(
    'value',                   coalesce(round(sum(coalesce(l.opportunity_value, 0) * coalesce(ps.stage_win_probability, 0))::numeric, 2), 0),
    'contributing_leads',      count(*) filter (where coalesce(l.opportunity_value, 0) > 0 and ps.stage_win_probability is not null),
    'total_open_leads',        count(*) filter (where l.lead_status = 'open'),
    'methodology',             'pipeline_weighted_by_stage_position'
  )
  into out_forecast_revenue
  from leads_window l
  left join progress_stages ps
    on ps.pipeline_external_id = l.pipeline_external_id
    and ps.stage_external_id = l.stage_external_id
  where l.lead_status = 'open';

  -- Person type distribution (contatos vinculados aos leads do período)
  select jsonb_build_object(
    'pj_count',        count(*) filter (where person_type = 'PJ'),
    'pf_count',        count(*) filter (where person_type = 'PF'),
    'unknown_count',   count(*) filter (where person_type is null),
    'total_contacts',  count(*),
    'pj_pct',          case when count(*) = 0 then 0 else round(100.0 * count(*) filter (where person_type = 'PJ')::numeric / count(*), 2) end
  )
  into out_person_type
  from public.crm_norm_contacts
  where tenant_id = _tenant_id
    and external_id in (
      select distinct l.contact_external_id from public.crm_leads l
      where l.tenant_id = _tenant_id
        and l.contact_external_id is not null
        and ( _start is null or l.created_at >= _start )
        and ( _end   is null or l.created_at <= _end   )
    );

  return jsonb_build_object(
    'overview',                  out_overview,
    'pipeline_health',           out_pipeline_health,
    'owner_performance',         out_owner_performance,
    'lost_reasons',              out_lost_reasons,
    'stage_distribution',        out_stage_distribution,
    'forecast_revenue',          out_forecast_revenue,
    'person_type_distribution',  out_person_type,
    'window_start',              _start,
    'window_end',                _end,
    'generated_at',              now()
  );
end;
$$;

grant execute on function public.crm_audit_dashboard_range(uuid, timestamptz, timestamptz) to authenticated;

comment on function public.crm_audit_dashboard_range(uuid, timestamptz, timestamptz) is
  'Recalcula a auditoria CRM dentro de uma janela temporal. Quando start/end são NULL, usa todo o histórico. Substitui o cálculo via views agregadas pra respeitar filtros temporais sem inconsistência entre dashboards.';
