-- Conectar os 15 widgets do dashboard Afonsina às views/tabelas reais
-- Dashboard: 4968e759-d583-4e8e-b52c-e061f01c8fcb

-- =============================================
-- ROW 1: 5 KPIs Primários
-- =============================================

-- Total de Leads → conta linhas da tabela leads_v2
UPDATE public.dashboard_widgets
SET config = config || '{
  "dataSource": "leads_v2",
  "sourceTable": "leads_v2",
  "metric": "id",
  "aggregation": "count"
}'::jsonb
WHERE dashboard_id = '4968e759-d583-4e8e-b52c-e061f01c8fcb'
  AND title = 'Total de Leads';

-- Mensagens → view KPIs 30d
UPDATE public.dashboard_widgets
SET config = config || '{
  "dataSource": "vw_dashboard_kpis_30d_v3",
  "sourceTable": "vw_dashboard_kpis_30d_v3",
  "metric": "msg_in_30d",
  "aggregation": "sum"
}'::jsonb
WHERE dashboard_id = '4968e759-d583-4e8e-b52c-e061f01c8fcb'
  AND title = 'Mensagens';

-- Reuniões Agendadas → view KPIs 30d
UPDATE public.dashboard_widgets
SET config = config || '{
  "dataSource": "vw_dashboard_kpis_30d_v3",
  "sourceTable": "vw_dashboard_kpis_30d_v3",
  "metric": "meetings_booked_30d",
  "aggregation": "sum"
}'::jsonb
WHERE dashboard_id = '4968e759-d583-4e8e-b52c-e061f01c8fcb'
  AND title = 'Reuniões Agendadas';

-- Reuniões Realizadas → view KPIs 30d
UPDATE public.dashboard_widgets
SET config = config || '{
  "dataSource": "vw_dashboard_kpis_30d_v3",
  "sourceTable": "vw_dashboard_kpis_30d_v3",
  "metric": "meetings_done_30d",
  "aggregation": "sum"
}'::jsonb
WHERE dashboard_id = '4968e759-d583-4e8e-b52c-e061f01c8fcb'
  AND title = 'Reuniões Realizadas';

-- Reuniões Concluídas → view KPIs 30d
UPDATE public.dashboard_widgets
SET config = config || '{
  "dataSource": "vw_dashboard_kpis_30d_v3",
  "sourceTable": "vw_dashboard_kpis_30d_v3",
  "metric": "meetings_cancelled_30d",
  "aggregation": "sum"
}'::jsonb
WHERE dashboard_id = '4968e759-d583-4e8e-b52c-e061f01c8fcb'
  AND title = 'Reuniões Concluídas';

-- =============================================
-- ROW 2: 4 KPIs Secundários
-- =============================================

-- Investimento → view KPIs 30d
UPDATE public.dashboard_widgets
SET config = config || '{
  "dataSource": "vw_dashboard_kpis_30d_v3",
  "sourceTable": "vw_dashboard_kpis_30d_v3",
  "metric": "spend_30d",
  "aggregation": "sum"
}'::jsonb
WHERE dashboard_id = '4968e759-d583-4e8e-b52c-e061f01c8fcb'
  AND title = 'Investimento';

-- CPL → view KPIs 30d
UPDATE public.dashboard_widgets
SET config = config || '{
  "dataSource": "vw_dashboard_kpis_30d_v3",
  "sourceTable": "vw_dashboard_kpis_30d_v3",
  "metric": "cpl_30d",
  "aggregation": "avg"
}'::jsonb
WHERE dashboard_id = '4968e759-d583-4e8e-b52c-e061f01c8fcb'
  AND title = 'CPL';

-- Custo por Reunião → view KPIs 30d
UPDATE public.dashboard_widgets
SET config = config || '{
  "dataSource": "vw_dashboard_kpis_30d_v3",
  "sourceTable": "vw_dashboard_kpis_30d_v3",
  "metric": "cp_meeting_booked_30d",
  "aggregation": "avg"
}'::jsonb
WHERE dashboard_id = '4968e759-d583-4e8e-b52c-e061f01c8fcb'
  AND title = 'Custo por Reunião';

-- Conv. Lead → Reunião → view KPIs 30d
UPDATE public.dashboard_widgets
SET config = config || '{
  "dataSource": "vw_dashboard_kpis_30d_v3",
  "sourceTable": "vw_dashboard_kpis_30d_v3",
  "metric": "conv_lead_to_meeting_30d",
  "aggregation": "avg"
}'::jsonb
WHERE dashboard_id = '4968e759-d583-4e8e-b52c-e061f01c8fcb'
  AND title LIKE 'Conv.%';

-- =============================================
-- ROW 3: Gráficos Principais
-- =============================================

-- Evolução Diária → view daily 60d (série temporal multi-série)
UPDATE public.dashboard_widgets
SET config = config || '{
  "dataSource": "vw_dashboard_daily_60d_v3",
  "sourceTable": "vw_dashboard_daily_60d_v3",
  "metric": "new_leads",
  "groupBy": "day",
  "aggregation": "sum",
  "dataKeys": ["new_leads", "msg_in", "meetings_scheduled", "spend"]
}'::jsonb
WHERE dashboard_id = '4968e759-d583-4e8e-b52c-e061f01c8fcb'
  AND title = 'Evolução Diária';

-- Pipeline de Conversão → view funnel
UPDATE public.dashboard_widgets
SET config = config || '{
  "dataSource": "vw_funnel_current_v3",
  "sourceTable": "vw_funnel_current_v3",
  "metric": "total",
  "groupBy": "stage_group",
  "aggregation": "sum"
}'::jsonb
WHERE dashboard_id = '4968e759-d583-4e8e-b52c-e061f01c8fcb'
  AND title = 'Pipeline de Conversão';

-- =============================================
-- ROW 4: Reuniões + Insights
-- =============================================

-- Próximas Reuniões → sem dados diretos, usa leads como fallback
UPDATE public.dashboard_widgets
SET config = config || '{
  "dataSource": "leads_v2",
  "sourceTable": "leads_v2"
}'::jsonb
WHERE dashboard_id = '4968e759-d583-4e8e-b52c-e061f01c8fcb'
  AND title = 'Próximas Reuniões';

-- Insights IA → sem dataSource necessário (usa mock)

-- =============================================
-- ROW 5: Distribuição + Lista
-- =============================================

-- Distribuição por Origem → leads agrupados por anuncio/source
UPDATE public.dashboard_widgets
SET config = config || '{
  "dataSource": "leads_v2",
  "sourceTable": "leads_v2",
  "metric": "lead_source",
  "groupBy": "lead_source",
  "aggregation": "count"
}'::jsonb
WHERE dashboard_id = '4968e759-d583-4e8e-b52c-e061f01c8fcb'
  AND title = 'Distribuição por Origem';

-- Lista de Leads → tabela leads
UPDATE public.dashboard_widgets
SET config = config || '{
  "dataSource": "leads_v2",
  "sourceTable": "leads_v2"
}'::jsonb
WHERE dashboard_id = '4968e759-d583-4e8e-b52c-e061f01c8fcb'
  AND title = 'Lista de Leads';
