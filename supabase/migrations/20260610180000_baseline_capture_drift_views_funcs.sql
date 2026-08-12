-- BASELINE CAPTURE: objetos que existiam no banco mas fora das migrations (drift).
-- Gerado 2026-06-10 pela auditoria de hardcode (#41). Torna repo == banco.
-- NOTA: vw_bai_eco_*/qb_refresh (dívida Ecológica/Quitou) e *_jaqueline/*_renar (hardcode por pessoa)
--       ficam versionados AQUI mas marcados p/ GENERALIZAÇÃO nas fases F3/F4/F5.

-- [func] linkedin_activity_instance
CREATE OR REPLACE FUNCTION public.linkedin_activity_instance(_raw jsonb)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select coalesce(
    _raw->>'instance',
    substring(_raw->>'session_id' from 'uni:([^:]+):')
  );
$function$;

-- [func] list_database_objects
CREATE OR REPLACE FUNCTION public.list_database_objects()
 RETURNS TABLE(object_key text, kind text, column_count integer, columns jsonb, already_in_catalog boolean, catalog_display_name text, catalog_category text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  with all_obj as (
    select table_name as obj_name, 'table' as kind
      from information_schema.tables
     where table_schema = 'public' and table_type = 'BASE TABLE'
       and table_name not like 'pg_%'
       and table_name not like '_timescaledb%'
    union all
    select table_name as obj_name, 'view' as kind
      from information_schema.views
     where table_schema = 'public'
    union all
    select matviewname as obj_name, 'materialized_view' as kind
      from pg_matviews
     where schemaname = 'public'
  ),
  cols as (
    select table_name,
           jsonb_agg(
             jsonb_build_object(
               'name', column_name,
               'data_type', data_type,
               'is_nullable', is_nullable
             ) order by ordinal_position
           ) as columns,
           count(*)::int as n
      from information_schema.columns
     where table_schema = 'public'
     group by table_name
  )
  select
    o.obj_name,
    o.kind,
    coalesce(c.n, 0),
    coalesce(c.columns, '[]'::jsonb),
    ds.id is not null,
    ds.display_name,
    ds.category
  from all_obj o
  left join cols c on c.table_name = o.obj_name
  left join public.dashboard_data_sources ds
    on ds.key = o.obj_name
  order by o.kind, o.obj_name;
$function$;

-- [func] onboarding_touch_updated_at
CREATE OR REPLACE FUNCTION public.onboarding_touch_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin new.updated_at = now(); return new; end; $function$;

-- [func] qb_refresh_kommo_leads
CREATE OR REPLACE FUNCTION public.qb_refresh_kommo_leads()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare ORG uuid := '3b867d03-87f7-482c-94a5-3ab22a635fdc';
begin
  -- 1) inserir leads novos (em crm_leads, ausentes em kommo_leads) — essenciais
  insert into public.kommo_leads (org_id, lead_id, status_id, created_at_iso, synced_at_iso)
  select ORG, l.external_id::bigint, l.stage_external_id::bigint,
    to_char(l.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    to_char(coalesce(l.synced_at, now()) at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"')
  from crm_leads l
  where l.tenant_id=ORG and l.external_id ~ '^[0-9]+$'
    and not exists (select 1 from public.kommo_leads k where k.org_id=ORG and k.lead_id=l.external_id::bigint)
  on conflict (org_id,lead_id) do nothing;

  -- 2) acumular flags (monotônico) pelo estágio atual garantidor (mapa data-driven)
  update public.kommo_leads k set
    encaminhado       = k.encaminhado       or d.enc,
    atendimento_feito = k.atendimento_feito or d.atd,
    reuniao_confirmada= k.reuniao_confirmada or d.cnf,
    reuniao_realizada = k.reuniao_realizada or d.rlz,
    nao_confirmou     = k.nao_confirmou     or d.ncf,
    faltou_reuniao    = k.faltou_reuniao    or d.flt,
    venda             = k.venda             or d.vnd,
    desqualificado    = k.desqualificado    or d.dsq,
    status_id         = d.status_id,
    updated_in_db_at  = now()
  from (
    select l.external_id::bigint lead_id, l.stage_external_id::bigint status_id,
      (st.name in ('ATENDIMENTO HUMANIZADO','Diagnóstico','DISPARO DA REUNIÃO','REUNIÃO CONFIRMADA','PÓS-REUNIÃO','FALTOU REUNIÃO / REMARKETING','NAO CONFIRMOU / REMARKETING') or l.lead_status='won') enc,
      (st.name in ('DISPARO DA REUNIÃO','REUNIÃO CONFIRMADA','PÓS-REUNIÃO','FALTOU REUNIÃO / REMARKETING') or l.lead_status='won') atd,
      (st.name in ('REUNIÃO CONFIRMADA','PÓS-REUNIÃO','FALTOU REUNIÃO / REMARKETING') or l.lead_status='won') cnf,
      (st.name in ('PÓS-REUNIÃO')) rlz,
      (st.name in ('NAO CONFIRMOU / REMARKETING')) ncf,
      (st.name in ('FALTOU REUNIÃO / REMARKETING')) flt,
      (l.lead_status='won') vnd,
      (l.lead_status='lost') dsq
    from crm_leads l join crm_stages st on st.tenant_id=l.tenant_id and st.external_id=l.stage_external_id
    where l.tenant_id=ORG and l.external_id ~ '^[0-9]+$'
  ) d
  where k.org_id=ORG and k.lead_id=d.lead_id;
end $function$;

-- [func] read_uploaded_dataset
CREATE OR REPLACE FUNCTION public.read_uploaded_dataset(_key text)
 RETURNS TABLE(data jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  select jsonb_array_elements(d.rows) as data
    from public.dashboard_uploaded_datasets d
   where d.key = _key
   limit 5000;
$function$;

-- [func] touch_dashboard_uploaded_datasets
CREATE OR REPLACE FUNCTION public.touch_dashboard_uploaded_datasets()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin new.updated_at := now(); return new; end;
$function$;

-- [func] touch_external_data_connections
CREATE OR REPLACE FUNCTION public.touch_external_data_connections()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin new.updated_at := now(); return new; end;
$function$;

-- [func] touch_linkedin_ai_settings
CREATE OR REPLACE FUNCTION public.touch_linkedin_ai_settings()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin new.updated_at := now(); return new; end;
$function$;

-- [view] vw_bai_eco_destino
create or replace view public.vw_bai_eco_destino as  SELECT org_id,
    value AS destino,
    count(DISTINCT lead_external_id) AS lead_count
   FROM vw_bai_crm_lead_custom_fields
  WHERE field_name = 'Destino de Interesse'::text AND value IS NOT NULL AND btrim(value) <> ''::text AND lower(value) <> 'false'::text
  GROUP BY org_id, value;

-- [view] vw_bai_eco_duracao
create or replace view public.vw_bai_eco_duracao as  SELECT org_id,
        CASE
            WHEN value ~* '[0-9]+\s*[dD]ia'::text THEN "substring"(value, '([0-9]+)\s*[dD]ia'::text) || ' dias'::text
            WHEN btrim(value) ~ '^[0-9]+$'::text THEN btrim(value) || ' dias'::text
            ELSE 'Não especificado'::text
        END AS duracao,
    count(DISTINCT lead_external_id) AS lead_count
   FROM vw_bai_crm_lead_custom_fields
  WHERE field_name = 'Dias de Viagem'::text AND value IS NOT NULL AND btrim(value) <> ''::text AND lower(value) <> 'false'::text
  GROUP BY org_id, (
        CASE
            WHEN value ~* '[0-9]+\s*[dD]ia'::text THEN "substring"(value, '([0-9]+)\s*[dD]ia'::text) || ' dias'::text
            WHEN btrim(value) ~ '^[0-9]+$'::text THEN btrim(value) || ' dias'::text
            ELSE 'Não especificado'::text
        END);

-- [view] vw_bai_eco_kpis
create or replace view public.vw_bai_eco_kpis as  WITH base AS (
         SELECT l.tenant_id AS org_id,
            count(*) AS total_leads,
            count(*) FILTER (WHERE st.name = 'FOLLOWUP'::text) AS em_followup,
            count(*) FILTER (WHERE st.name = 'REUNIÃO AGENDADA'::text) AS em_reuniao_agendada,
            count(*) FILTER (WHERE st.name = 'REUNIÃO REALIZADA'::text) AS em_reuniao_realizada
           FROM crm_leads l
             LEFT JOIN crm_stages st ON st.tenant_id = l.tenant_id AND st.external_id = l.stage_external_id
          GROUP BY l.tenant_id
        ), cf AS (
         SELECT vw_bai_crm_lead_custom_fields.org_id,
            count(DISTINCT vw_bai_crm_lead_custom_fields.lead_external_id) FILTER (WHERE vw_bai_crm_lead_custom_fields.field_name = 'PDF ENVIADO JÁ'::text AND lower(vw_bai_crm_lead_custom_fields.value) = 'true'::text) AS material_enviado,
            count(DISTINCT vw_bai_crm_lead_custom_fields.lead_external_id) FILTER (WHERE vw_bai_crm_lead_custom_fields.field_name = 'REUNIÃO MARCADA'::text AND lower(vw_bai_crm_lead_custom_fields.value) = 'true'::text) AS reunioes_marcadas,
            count(DISTINCT vw_bai_crm_lead_custom_fields.lead_external_id) FILTER (WHERE vw_bai_crm_lead_custom_fields.field_name = 'DESATIVAR IA'::text AND lower(vw_bai_crm_lead_custom_fields.value) = 'true'::text) AS repassados_humano,
            count(DISTINCT vw_bai_crm_lead_custom_fields.lead_external_id) FILTER (WHERE vw_bai_crm_lead_custom_fields.field_name = 'COM INTERAÇÃO'::text AND lower(vw_bai_crm_lead_custom_fields.value) = 'true'::text) AS com_interacao
           FROM vw_bai_crm_lead_custom_fields
          GROUP BY vw_bai_crm_lead_custom_fields.org_id
        )
 SELECT b.org_id,
    b.total_leads,
    b.em_followup,
    b.em_reuniao_agendada,
    b.em_reuniao_realizada,
    COALESCE(cf.material_enviado, 0::bigint) AS material_enviado,
    COALESCE(cf.reunioes_marcadas, 0::bigint) AS reunioes_marcadas,
    COALESCE(cf.repassados_humano, 0::bigint) AS repassados_humano,
    COALESCE(cf.com_interacao, 0::bigint) AS com_interacao,
    round(100.0 * COALESCE(cf.material_enviado, 0::bigint)::numeric / NULLIF(b.total_leads, 0)::numeric, 1) AS taxa_engajamento,
    round(100.0 * COALESCE(cf.reunioes_marcadas, 0::bigint)::numeric / NULLIF(b.total_leads, 0)::numeric, 1) AS taxa_conversao_reuniao,
    round(100.0 * COALESCE(cf.repassados_humano, 0::bigint)::numeric / NULLIF(b.total_leads, 0)::numeric, 1) AS taxa_handoff
   FROM base b
     LEFT JOIN cf ON cf.org_id = b.org_id;

-- [view] vw_external_data_connections_safe
create or replace view public.vw_external_data_connections_safe as  SELECT id,
    org_id,
    name,
    type,
    config ->> 'url'::text AS url,
    config ->> 'sheet_id'::text AS sheet_id,
    (config ->> 'has_key'::text)::boolean AS has_credentials,
    is_active,
    created_at,
    updated_at
   FROM external_data_connections;

-- [view] vw_linkedin_sdr_conversations_jaqueline
create or replace view public.vw_linkedin_sdr_conversations_jaqueline as  SELECT raw ->> 'lead_name'::text AS lead_name,
    raw ->> 'company'::text AS company,
    raw ->> 'role'::text AS role,
    raw ->> 'sector'::text AS sector,
    status,
    (raw ->> 'lead_score'::text)::integer AS lead_score,
    raw ->> 'pain'::text AS pain,
    last_message_preview,
    to_char((last_message_at AT TIME ZONE 'America/Sao_Paulo'::text), 'DD/MM HH24:MI'::text) AS ultima_mensagem,
    raw ->> 'confirmed_slot'::text AS reuniao_agendada
   FROM crm_auditor_conversations
  WHERE tenant_id = 'd2a404a8-03bf-4754-abcc-f96309c977f2'::uuid AND (raw ->> 'instance'::text IN ( SELECT linkedin_sdr_aliases.unipile_account_id
           FROM linkedin_sdr_aliases
          WHERE linkedin_sdr_aliases.sdr_slug = 'jaqueline'::text))
  ORDER BY last_message_at DESC NULLS LAST;

-- [view] vw_linkedin_sdr_conversations_renan
create or replace view public.vw_linkedin_sdr_conversations_renan as  SELECT raw ->> 'lead_name'::text AS lead_name,
    raw ->> 'company'::text AS company,
    raw ->> 'role'::text AS role,
    raw ->> 'sector'::text AS sector,
    status,
    (raw ->> 'lead_score'::text)::integer AS lead_score,
    raw ->> 'pain'::text AS pain,
    last_message_preview,
    to_char((last_message_at AT TIME ZONE 'America/Sao_Paulo'::text), 'DD/MM HH24:MI'::text) AS ultima_mensagem,
    raw ->> 'confirmed_slot'::text AS reuniao_agendada
   FROM crm_auditor_conversations
  WHERE tenant_id = 'd2a404a8-03bf-4754-abcc-f96309c977f2'::uuid AND (raw ->> 'instance'::text IN ( SELECT linkedin_sdr_aliases.unipile_account_id
           FROM linkedin_sdr_aliases
          WHERE linkedin_sdr_aliases.sdr_slug = 'renan'::text))
  ORDER BY last_message_at DESC NULLS LAST;

-- [view] vw_linkedin_sdr_daily_jaqueline
create or replace view public.vw_linkedin_sdr_daily_jaqueline as  WITH dates AS (
         SELECT generate_series(now() - '60 days'::interval, now(), '1 day'::interval)::date AS day
        ), ids AS (
         SELECT linkedin_sdr_aliases.unipile_account_id
           FROM linkedin_sdr_aliases
          WHERE linkedin_sdr_aliases.sdr_slug = 'jaqueline'::text
        ), ev AS (
         SELECT crm_auditor_events.occurred_at::date AS day,
            count(*) FILTER (WHERE crm_auditor_events.event_type = 'linkedin_invite_sent'::text) AS invites_sent,
            count(*) FILTER (WHERE crm_auditor_events.event_type = 'linkedin_invite_accepted'::text) AS invites_accepted
           FROM crm_auditor_events
          WHERE crm_auditor_events.tenant_id = 'd2a404a8-03bf-4754-abcc-f96309c977f2'::uuid AND (crm_auditor_events.raw ->> 'account_id'::text IN ( SELECT ids.unipile_account_id
                   FROM ids))
          GROUP BY (crm_auditor_events.occurred_at::date)
        ), ac AS (
         SELECT crm_auditor_activities.happened_at::date AS day,
            count(*) FILTER (WHERE crm_auditor_activities.activity_type = 'linkedin_message_sent'::text) AS msgs_sent,
            count(*) FILTER (WHERE crm_auditor_activities.activity_type = 'linkedin_message_received'::text) AS msgs_received
           FROM crm_auditor_activities
          WHERE crm_auditor_activities.tenant_id = 'd2a404a8-03bf-4754-abcc-f96309c977f2'::uuid AND (linkedin_activity_instance(crm_auditor_activities.raw) IN ( SELECT ids.unipile_account_id
                   FROM ids))
          GROUP BY (crm_auditor_activities.happened_at::date)
        )
 SELECT d.day,
    COALESCE(e.invites_sent, 0::bigint) AS invites_sent,
    COALESCE(e.invites_accepted, 0::bigint) AS invites_accepted,
    COALESCE(a.msgs_sent, 0::bigint) AS msgs_sent,
    COALESCE(a.msgs_received, 0::bigint) AS msgs_received
   FROM dates d
     LEFT JOIN ev e ON e.day = d.day
     LEFT JOIN ac a ON a.day = d.day
  ORDER BY d.day;

-- [view] vw_linkedin_sdr_daily_renan
create or replace view public.vw_linkedin_sdr_daily_renan as  WITH dates AS (
         SELECT generate_series(now() - '60 days'::interval, now(), '1 day'::interval)::date AS day
        ), ids AS (
         SELECT linkedin_sdr_aliases.unipile_account_id
           FROM linkedin_sdr_aliases
          WHERE linkedin_sdr_aliases.sdr_slug = 'renan'::text
        ), ev AS (
         SELECT crm_auditor_events.occurred_at::date AS day,
            count(*) FILTER (WHERE crm_auditor_events.event_type = 'linkedin_invite_sent'::text) AS invites_sent,
            count(*) FILTER (WHERE crm_auditor_events.event_type = 'linkedin_invite_accepted'::text) AS invites_accepted
           FROM crm_auditor_events
          WHERE crm_auditor_events.tenant_id = 'd2a404a8-03bf-4754-abcc-f96309c977f2'::uuid AND (crm_auditor_events.raw ->> 'account_id'::text IN ( SELECT ids.unipile_account_id
                   FROM ids))
          GROUP BY (crm_auditor_events.occurred_at::date)
        ), ac AS (
         SELECT crm_auditor_activities.happened_at::date AS day,
            count(*) FILTER (WHERE crm_auditor_activities.activity_type = 'linkedin_message_sent'::text) AS msgs_sent,
            count(*) FILTER (WHERE crm_auditor_activities.activity_type = 'linkedin_message_received'::text) AS msgs_received
           FROM crm_auditor_activities
          WHERE crm_auditor_activities.tenant_id = 'd2a404a8-03bf-4754-abcc-f96309c977f2'::uuid AND (linkedin_activity_instance(crm_auditor_activities.raw) IN ( SELECT ids.unipile_account_id
                   FROM ids))
          GROUP BY (crm_auditor_activities.happened_at::date)
        )
 SELECT d.day,
    COALESCE(e.invites_sent, 0::bigint) AS invites_sent,
    COALESCE(e.invites_accepted, 0::bigint) AS invites_accepted,
    COALESCE(a.msgs_sent, 0::bigint) AS msgs_sent,
    COALESCE(a.msgs_received, 0::bigint) AS msgs_received
   FROM dates d
     LEFT JOIN ev e ON e.day = d.day
     LEFT JOIN ac a ON a.day = d.day
  ORDER BY d.day;

-- [view] vw_linkedin_sdr_funnel_jaqueline
create or replace view public.vw_linkedin_sdr_funnel_jaqueline as  WITH ids AS (
         SELECT linkedin_sdr_aliases.unipile_account_id
           FROM linkedin_sdr_aliases
          WHERE linkedin_sdr_aliases.sdr_slug = 'jaqueline'::text
        ), invites AS (
         SELECT count(*) FILTER (WHERE crm_auditor_events.event_type = 'linkedin_invite_sent'::text) AS invites_sent,
            count(*) FILTER (WHERE crm_auditor_events.event_type = 'linkedin_invite_accepted'::text) AS invites_accepted
           FROM crm_auditor_events
          WHERE crm_auditor_events.tenant_id = 'd2a404a8-03bf-4754-abcc-f96309c977f2'::uuid AND (crm_auditor_events.raw ->> 'account_id'::text IN ( SELECT ids.unipile_account_id
                   FROM ids))
        ), convs AS (
         SELECT count(*) AS convs_active
           FROM crm_auditor_conversations
          WHERE crm_auditor_conversations.tenant_id = 'd2a404a8-03bf-4754-abcc-f96309c977f2'::uuid AND (crm_auditor_conversations.raw ->> 'instance'::text IN ( SELECT ids.unipile_account_id
                   FROM ids))
        )
 SELECT ( SELECT invites.invites_sent
           FROM invites) AS invites_sent,
    ( SELECT invites.invites_accepted
           FROM invites) AS invites_accepted,
    ( SELECT convs.convs_active
           FROM convs) AS convs_active,
    1 AS sort_order;

-- [view] vw_linkedin_sdr_funnel_renan
create or replace view public.vw_linkedin_sdr_funnel_renan as  WITH ids AS (
         SELECT linkedin_sdr_aliases.unipile_account_id
           FROM linkedin_sdr_aliases
          WHERE linkedin_sdr_aliases.sdr_slug = 'renan'::text
        ), invites AS (
         SELECT count(*) FILTER (WHERE crm_auditor_events.event_type = 'linkedin_invite_sent'::text) AS invites_sent,
            count(*) FILTER (WHERE crm_auditor_events.event_type = 'linkedin_invite_accepted'::text) AS invites_accepted
           FROM crm_auditor_events
          WHERE crm_auditor_events.tenant_id = 'd2a404a8-03bf-4754-abcc-f96309c977f2'::uuid AND (crm_auditor_events.raw ->> 'account_id'::text IN ( SELECT ids.unipile_account_id
                   FROM ids))
        ), convs AS (
         SELECT count(*) AS convs_active
           FROM crm_auditor_conversations
          WHERE crm_auditor_conversations.tenant_id = 'd2a404a8-03bf-4754-abcc-f96309c977f2'::uuid AND (crm_auditor_conversations.raw ->> 'instance'::text IN ( SELECT ids.unipile_account_id
                   FROM ids))
        )
 SELECT ( SELECT invites.invites_sent
           FROM invites) AS invites_sent,
    ( SELECT invites.invites_accepted
           FROM invites) AS invites_accepted,
    ( SELECT convs.convs_active
           FROM convs) AS convs_active,
    1 AS sort_order;

-- [view] vw_linkedin_sdr_kpis_jaqueline
create or replace view public.vw_linkedin_sdr_kpis_jaqueline as  WITH ids AS (
         SELECT linkedin_sdr_aliases.unipile_account_id
           FROM linkedin_sdr_aliases
          WHERE linkedin_sdr_aliases.sdr_slug = 'jaqueline'::text
        ), events AS (
         SELECT count(*) FILTER (WHERE crm_auditor_events.event_type = 'linkedin_invite_sent'::text) AS invites_sent,
            count(*) FILTER (WHERE crm_auditor_events.event_type = 'linkedin_invite_accepted'::text) AS invites_accepted
           FROM crm_auditor_events
          WHERE crm_auditor_events.tenant_id = 'd2a404a8-03bf-4754-abcc-f96309c977f2'::uuid AND (crm_auditor_events.raw ->> 'account_id'::text IN ( SELECT ids.unipile_account_id
                   FROM ids))
        ), msgs AS (
         SELECT count(*) FILTER (WHERE crm_auditor_activities.activity_type = 'linkedin_message_sent'::text) AS msgs_sent,
            count(*) FILTER (WHERE crm_auditor_activities.activity_type = 'linkedin_message_received'::text) AS msgs_received
           FROM crm_auditor_activities
          WHERE crm_auditor_activities.tenant_id = 'd2a404a8-03bf-4754-abcc-f96309c977f2'::uuid AND (linkedin_activity_instance(crm_auditor_activities.raw) IN ( SELECT ids.unipile_account_id
                   FROM ids))
        ), convs AS (
         SELECT count(*) AS convs_active,
            count(*) FILTER (WHERE (crm_auditor_conversations.raw ->> 'confirmed_slot'::text) IS NOT NULL) AS meetings_scheduled
           FROM crm_auditor_conversations
          WHERE crm_auditor_conversations.tenant_id = 'd2a404a8-03bf-4754-abcc-f96309c977f2'::uuid AND (crm_auditor_conversations.raw ->> 'instance'::text IN ( SELECT ids.unipile_account_id
                   FROM ids))
        )
 SELECT e.invites_sent,
    e.invites_accepted,
    round(
        CASE
            WHEN e.invites_sent = 0 THEN 0::numeric
            ELSE 100.0 * e.invites_accepted::numeric / e.invites_sent::numeric
        END, 1) AS acceptance_rate,
    c.convs_active,
    c.meetings_scheduled,
    m.msgs_sent,
    m.msgs_received,
        CASE
            WHEN m.msgs_sent = 0 THEN NULL::numeric
            ELSE round(100.0 * m.msgs_received::numeric / m.msgs_sent::numeric, 1)
        END AS reply_rate,
    round(
        CASE
            WHEN c.convs_active = 0 THEN 0::numeric
            ELSE 100.0 * c.meetings_scheduled::numeric / c.convs_active::numeric
        END, 1) AS conversion_rate
   FROM events e
     CROSS JOIN msgs m
     CROSS JOIN convs c;

-- [view] vw_linkedin_sdr_kpis_renan
create or replace view public.vw_linkedin_sdr_kpis_renan as  WITH ids AS (
         SELECT linkedin_sdr_aliases.unipile_account_id
           FROM linkedin_sdr_aliases
          WHERE linkedin_sdr_aliases.sdr_slug = 'renan'::text
        ), events AS (
         SELECT count(*) FILTER (WHERE crm_auditor_events.event_type = 'linkedin_invite_sent'::text) AS invites_sent,
            count(*) FILTER (WHERE crm_auditor_events.event_type = 'linkedin_invite_accepted'::text) AS invites_accepted
           FROM crm_auditor_events
          WHERE crm_auditor_events.tenant_id = 'd2a404a8-03bf-4754-abcc-f96309c977f2'::uuid AND (crm_auditor_events.raw ->> 'account_id'::text IN ( SELECT ids.unipile_account_id
                   FROM ids))
        ), msgs AS (
         SELECT count(*) FILTER (WHERE crm_auditor_activities.activity_type = 'linkedin_message_sent'::text) AS msgs_sent,
            count(*) FILTER (WHERE crm_auditor_activities.activity_type = 'linkedin_message_received'::text) AS msgs_received
           FROM crm_auditor_activities
          WHERE crm_auditor_activities.tenant_id = 'd2a404a8-03bf-4754-abcc-f96309c977f2'::uuid AND (linkedin_activity_instance(crm_auditor_activities.raw) IN ( SELECT ids.unipile_account_id
                   FROM ids))
        ), convs AS (
         SELECT count(*) AS convs_active,
            count(*) FILTER (WHERE (crm_auditor_conversations.raw ->> 'confirmed_slot'::text) IS NOT NULL) AS meetings_scheduled
           FROM crm_auditor_conversations
          WHERE crm_auditor_conversations.tenant_id = 'd2a404a8-03bf-4754-abcc-f96309c977f2'::uuid AND (crm_auditor_conversations.raw ->> 'instance'::text IN ( SELECT ids.unipile_account_id
                   FROM ids))
        )
 SELECT e.invites_sent,
    e.invites_accepted,
    round(
        CASE
            WHEN e.invites_sent = 0 THEN 0::numeric
            ELSE 100.0 * e.invites_accepted::numeric / e.invites_sent::numeric
        END, 1) AS acceptance_rate,
    c.convs_active,
    c.meetings_scheduled,
    m.msgs_sent,
    m.msgs_received,
        CASE
            WHEN m.msgs_sent = 0 THEN NULL::numeric
            ELSE round(100.0 * m.msgs_received::numeric / m.msgs_sent::numeric, 1)
        END AS reply_rate,
    round(
        CASE
            WHEN c.convs_active = 0 THEN 0::numeric
            ELSE 100.0 * c.meetings_scheduled::numeric / c.convs_active::numeric
        END, 1) AS conversion_rate
   FROM events e
     CROSS JOIN msgs m
     CROSS JOIN convs c;
