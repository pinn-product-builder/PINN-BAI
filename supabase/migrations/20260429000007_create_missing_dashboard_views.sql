-- Views necessárias para o DashboardEngine funcionar sem integração externa
-- Todas incluem org_id para que o fetch-client-data possa filtrar por eq('org_id', orgId)

-- ─────────────────────────────────────────────────────────────────────────────
-- leads_v2 — alias da tabela leads (retrocompatibilidade)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.leads_v2 AS
SELECT * FROM public.leads;

-- ─────────────────────────────────────────────────────────────────────────────
-- vw_dashboard_kpis_30d_v3 — uma linha por org com métricas dos últimos 30 dias
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.vw_dashboard_kpis_30d_v3 AS
WITH lead_kpis AS (
  SELECT
    org_id,
    COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')                                                      AS total_leads_30d,
    COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days' AND source = 'whatsapp')                              AS msg_in_30d,
    COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days'
                       AND status IN ('meeting_booked','meeting_done','meeting_cancelled'))                                  AS meetings_booked_30d,
    COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days' AND status = 'meeting_done')                          AS meetings_done_30d,
    COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days' AND status = 'meeting_cancelled')                     AS meetings_cancelled_30d,
    COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days' AND status = 'converted')                             AS conversions_30d
  FROM public.leads
  GROUP BY org_id
),
traffic_kpis AS (
  SELECT
    org_id,
    SUM(spend)  AS spend_30d,
    SUM(leads)  AS paid_leads_30d
  FROM public.paid_traffic_daily_metrics
  WHERE date >= CURRENT_DATE - INTERVAL '30 days'
  GROUP BY org_id
)
SELECT
  l.org_id,
  l.total_leads_30d,
  l.msg_in_30d,
  l.meetings_booked_30d,
  l.meetings_done_30d,
  l.meetings_cancelled_30d,
  l.conversions_30d,
  COALESCE(t.spend_30d, 0)                                                                                                 AS spend_30d,
  CASE WHEN l.total_leads_30d > 0
       THEN ROUND((COALESCE(t.spend_30d, 0) / l.total_leads_30d)::numeric, 2)
       ELSE 0 END                                                                                                          AS cpl_30d,
  CASE WHEN l.meetings_booked_30d > 0
       THEN ROUND((COALESCE(t.spend_30d, 0) / l.meetings_booked_30d)::numeric, 2)
       ELSE 0 END                                                                                                          AS cp_meeting_booked_30d,
  CASE WHEN l.total_leads_30d > 0
       THEN ROUND((l.meetings_booked_30d::numeric / l.total_leads_30d * 100), 2)
       ELSE 0 END                                                                                                          AS conv_lead_to_meeting_30d
FROM lead_kpis l
LEFT JOIN traffic_kpis t ON t.org_id = l.org_id;

-- ─────────────────────────────────────────────────────────────────────────────
-- vw_dashboard_daily_60d_v3 — séries diárias dos últimos 60 dias por org
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.vw_dashboard_daily_60d_v3 AS
WITH lead_daily AS (
  SELECT
    org_id,
    DATE(created_at AT TIME ZONE 'America/Sao_Paulo') AS day,
    COUNT(*)                                                                      AS new_leads,
    COUNT(*) FILTER (WHERE source = 'whatsapp')                                  AS msg_in,
    COUNT(*) FILTER (WHERE status IN ('meeting_booked','meeting_done'))           AS meetings_scheduled
  FROM public.leads
  WHERE created_at >= NOW() - INTERVAL '60 days'
  GROUP BY org_id, DATE(created_at AT TIME ZONE 'America/Sao_Paulo')
),
traffic_daily AS (
  SELECT
    org_id,
    date AS day,
    SUM(spend) AS spend
  FROM public.paid_traffic_daily_metrics
  WHERE date >= CURRENT_DATE - INTERVAL '60 days'
  GROUP BY org_id, date
)
SELECT
  l.org_id,
  l.day,
  l.new_leads,
  l.msg_in,
  l.meetings_scheduled,
  COALESCE(t.spend, 0) AS spend
FROM lead_daily l
LEFT JOIN traffic_daily t ON t.org_id = l.org_id AND t.day = l.day;

-- ─────────────────────────────────────────────────────────────────────────────
-- vw_funnel_current_v3 — funil de conversão por status
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.vw_funnel_current_v3 AS
SELECT
  org_id,
  CASE status
    WHEN 'new'                THEN 'Novos'
    WHEN 'contacted'          THEN 'Contato'
    WHEN 'qualified'          THEN 'Qualificado'
    WHEN 'proposal'           THEN 'Proposta'
    WHEN 'negotiation'        THEN 'Negociação'
    WHEN 'converted'          THEN 'Convertido'
    WHEN 'lost'               THEN 'Perdido'
    WHEN 'meeting_booked'     THEN 'Reunião Agendada'
    WHEN 'meeting_done'       THEN 'Reunião Realizada'
    WHEN 'meeting_cancelled'  THEN 'Reunião Cancelada'
    ELSE status::text
  END AS stage_group,
  status::text AS raw_status,
  COUNT(*) AS total
FROM public.leads
GROUP BY org_id, status;

-- ─────────────────────────────────────────────────────────────────────────────
-- Permissões: service_role pode SELECT em todas as views
-- ─────────────────────────────────────────────────────────────────────────────
GRANT SELECT ON public.leads_v2                   TO service_role;
GRANT SELECT ON public.vw_dashboard_kpis_30d_v3   TO service_role;
GRANT SELECT ON public.vw_dashboard_daily_60d_v3  TO service_role;
GRANT SELECT ON public.vw_funnel_current_v3        TO service_role;
