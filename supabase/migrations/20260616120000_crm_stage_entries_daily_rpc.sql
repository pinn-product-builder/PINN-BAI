-- ─────────────────────────────────────────────────────────────────────────────
-- F4 — Série temporal por etapa, CANÔNICA e DB-driven (substitui o hardcode)
--
-- Contexto: o único caminho de apresentação de etapa ainda hardcoded em código
-- é o multi-série temporal (area/line) do DashboardEngine, via as constantes
-- CANONICAL_SERIES_ORDER + SERIES_LABELS, alimentado por tabelas slug-coluna
-- por cliente (ex.: public.kommo_leads, com 'encaminhado'/'venda'/... como
-- COLUNAS). O funil (funnel_distribution) já é DB-driven; só faltava o temporal.
--
-- Esta RPC entrega o equivalente canônico: conta ENTRADAS de lead por etapa,
-- por dia, a partir de crm_lead_stage_history (populado pelo trigger
-- trg_crm_leads_stage_history na sync), e resolve nome/cor/ordem/visível via
-- vw_org_stage_presentation. O engine pivota isso pra wide e usa o nome/cor/
-- ordem do banco — sem nenhuma constante por cliente.
--
-- Shape "long" (1 linha por dia × etapa) de propósito: deixa o engine montar as
-- séries e a ordem a partir de stage_sort_order, sem assumir colunas fixas.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.crm_stage_entries_daily(
  p_org      uuid,
  p_start    timestamptz default null,
  p_end      timestamptz default null,
  p_pipeline text        default null
)
returns table(
  org_id               uuid,
  day                  date,
  pipeline_external_id text,
  stage_external_id    text,
  stage_name           text,
  stage_color          text,
  stage_sort_order     int,
  lead_count           bigint
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  -- 1 evento = lead entrou numa etapa (to_stage). Conta entradas por dia/etapa.
  with entries as (
    select
      h.tenant_id,
      (h.occurred_at)::date            as day,
      h.pipeline_external_id,
      h.to_stage_external_id           as stage_external_id,
      count(*)                         as lead_count
    from public.crm_lead_stage_history h
    where h.tenant_id = p_org
      and h.to_stage_external_id is not null
      and (p_start    is null or h.occurred_at >= p_start)
      and (p_end      is null or h.occurred_at <= p_end)
      and (p_pipeline is null or h.pipeline_external_id = p_pipeline)
    group by h.tenant_id, (h.occurred_at)::date, h.pipeline_external_id, h.to_stage_external_id
  )
  select
    e.tenant_id                                              as org_id,
    e.day,
    e.pipeline_external_id,
    e.stage_external_id,
    coalesce(p.display_name, e.stage_external_id)            as stage_name,
    p.color                                                  as stage_color,
    coalesce(p.sort_order, 0)                                as stage_sort_order,
    e.lead_count
  from entries e
  left join public.vw_org_stage_presentation p
    on  p.tenant_id            = e.tenant_id
    and p.pipeline_external_id = e.pipeline_external_id
    and p.stage_external_id    = e.stage_external_id
  -- etapas explicitamente ocultadas pelo humano somem do gráfico também.
  where coalesce(p.is_visible, true) = true
  order by e.day, coalesce(p.sort_order, 0), stage_name;
$function$;

grant execute on function public.crm_stage_entries_daily(uuid, timestamptz, timestamptz, text)
  to authenticated, service_role;

comment on function public.crm_stage_entries_daily(uuid, timestamptz, timestamptz, text) is
  'Série temporal canônica: entradas de lead por etapa/dia (crm_lead_stage_history) com nome/cor/ordem de vw_org_stage_presentation. Substitui CANONICAL_SERIES_ORDER/SERIES_LABELS no DashboardEngine.';

-- Catálogo de fontes — aparece no editor de widget como fonte selecionável.
insert into public.dashboard_data_sources (org_id, key, display_name, description, category, columns)
values (
  null,
  'rpc:crm_stage_entries_daily',
  'CRM · Entradas por etapa (diário)',
  'Série temporal canônica: leads que entraram em cada etapa por dia, com nome/cor/ordem resolvidos do mapeamento da org (vw_org_stage_presentation). Use em gráfico de área/linha multi-série.',
  'crm',
  '[
    {"key":"day","label":"Dia","type":"date"},
    {"key":"stage_external_id","label":"Etapa (ID)","type":"text"},
    {"key":"stage_name","label":"Etapa","type":"text"},
    {"key":"lead_count","label":"Entradas","type":"number"},
    {"key":"stage_sort_order","label":"Ordem","type":"number"},
    {"key":"pipeline_external_id","label":"Funil","type":"text"}
  ]'::jsonb
)
on conflict (key) where org_id is null do update
  set display_name = excluded.display_name,
      description  = excluded.description,
      category     = excluded.category,
      columns      = excluded.columns;
