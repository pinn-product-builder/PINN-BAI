
-- Fix Afonsina dashboard widgets to use correct views and field names
-- Dashboard: 9da30d81-04a6-4cd5-b7f4-edeca2b9c6bf

-- 1. Total de Leads → vw_dashboard_kpis_30d_v3.leads_total_30d (pre-aggregated view)
UPDATE dashboard_widgets SET config = jsonb_build_object(
  'dataSource', 'vw_dashboard_kpis_30d_v3',
  'metric', 'leads_total_30d',
  'aggregation', 'sum',
  'format', 'number',
  'showSparkline', true,
  'showTrend', true
), title = 'Total de Leads', description = 'Quantidade total de leads nos últimos 30 dias'
WHERE id = '69e52030-bbc0-4be2-a6ff-2c54a7416b3e';

-- 2. Mensagens → vw_dashboard_kpis_30d_v3.msg_in_30d
UPDATE dashboard_widgets SET config = jsonb_build_object(
  'dataSource', 'vw_dashboard_kpis_30d_v3',
  'metric', 'msg_in_30d',
  'aggregation', 'sum',
  'format', 'number',
  'showSparkline', true,
  'showTrend', true
), title = 'Mensagens (30d)', description = 'Total de mensagens recebidas nos últimos 30 dias'
WHERE id = '1181d8f9-277c-487b-9250-a66f11110200';

-- 3. Reuniões Agendadas → vw_dashboard_kpis_30d_v3.meetings_booked_30d
UPDATE dashboard_widgets SET config = jsonb_build_object(
  'dataSource', 'vw_dashboard_kpis_30d_v3',
  'metric', 'meetings_booked_30d',
  'aggregation', 'sum',
  'format', 'number',
  'showSparkline', true,
  'showTrend', true
), title = 'Reuniões Agendadas (30d)', description = 'Reuniões agendadas nos últimos 30 dias'
WHERE id = '7fdcc836-4a24-4b9d-ab1a-9b955fa1e85c';

-- 4. Reuniões Realizadas → vw_dashboard_kpis_30d_v3.meetings_done_30d
UPDATE dashboard_widgets SET config = jsonb_build_object(
  'dataSource', 'vw_dashboard_kpis_30d_v3',
  'metric', 'meetings_done_30d',
  'aggregation', 'sum',
  'format', 'number',
  'showSparkline', true,
  'showTrend', true
), title = 'Reuniões Realizadas (30d)', description = 'Reuniões que efetivamente aconteceram'
WHERE id = '045a552d-1d2a-483d-92d7-961468dba38f';

-- 5. Reuniões Canceladas (was "Concluídas") → vw_dashboard_kpis_30d_v3.meetings_cancelled_30d
UPDATE dashboard_widgets SET config = jsonb_build_object(
  'dataSource', 'vw_dashboard_kpis_30d_v3',
  'metric', 'meetings_cancelled_30d',
  'aggregation', 'sum',
  'format', 'number',
  'showSparkline', true,
  'showTrend', true
), title = 'Reuniões Canceladas (30d)', description = 'Reuniões canceladas nos últimos 30 dias'
WHERE id = '21e6c9d7-2701-4d28-a439-e9b3a08f3ae2';

-- 6. Investimento → vw_afonsina_custos_funil_dia.custo_total
UPDATE dashboard_widgets SET config = jsonb_build_object(
  'dataSource', 'vw_afonsina_custos_funil_dia',
  'metric', 'custo_total',
  'aggregation', 'sum',
  'format', 'currency',
  'showSparkline', true,
  'showTrend', true
), title = 'Investimento (30d)', description = 'Valor investido em campanhas nos últimos 30 dias'
WHERE id = '9b7a8fa0-83d6-4cf4-b375-204aa730b203';

-- 7. CPL → vw_afonsina_custos_funil_dia.cpl_30d
UPDATE dashboard_widgets SET config = jsonb_build_object(
  'dataSource', 'vw_afonsina_custos_funil_dia',
  'metric', 'cpl_30d',
  'aggregation', 'avg',
  'format', 'currency',
  'showSparkline', true,
  'showTrend', true
), title = 'CPL (30d)', description = 'Custo por Lead médio nos últimos 30 dias'
WHERE id = '93b12096-d5bf-4397-b2fa-91b5214b468f';

-- 8. Custo por Reunião → vw_afonsina_custos_funil_dia.cp_meeting_booked_30d
UPDATE dashboard_widgets SET config = jsonb_build_object(
  'dataSource', 'vw_afonsina_custos_funil_dia',
  'metric', 'cp_meeting_booked_30d',
  'aggregation', 'avg',
  'format', 'currency',
  'showSparkline', true,
  'showTrend', true
), title = 'Custo por Reunião (30d)', description = 'Custo médio por reunião agendada'
WHERE id = '3acc20b6-b8d0-40ab-8a7d-30e7327335d1';

-- 9. Conv. Lead → Reunião → vw_dashboard_kpis_30d_v3.conv_lead_to_meeting_30d
UPDATE dashboard_widgets SET config = jsonb_build_object(
  'dataSource', 'vw_dashboard_kpis_30d_v3',
  'metric', 'conv_lead_to_meeting_30d',
  'aggregation', 'avg',
  'format', 'percentage',
  'showSparkline', true,
  'showTrend', true
), title = 'Conv. Lead → Reunião (30d)', description = 'Taxa de conversão de lead para reunião'
WHERE id = '0d474f93-384b-4bbb-99ea-2ccf82e5f0f1';

-- 10. Evolução Diária → vw_dashboard_daily_60d_v3 with multi-series
UPDATE dashboard_widgets SET config = jsonb_build_object(
  'dataSource', 'vw_dashboard_daily_60d_v3',
  'metric', 'new_leads',
  'aggregation', 'sum',
  'groupBy', 'day',
  'format', 'number',
  'dataKeys', '["new_leads","msg_in","meetings_done","spend"]'::jsonb,
  'seriesLabels', '{"new_leads":"Novos Leads","msg_in":"Mensagens","meetings_done":"Reuniões","spend":"Investimento (R$)"}'::jsonb
), title = 'Evolução Diária (60d)', 
   description = 'Leads, mensagens, reuniões e investimento ao longo do tempo',
   size = 'large'
WHERE id = '83529185-c600-4b4c-bdcb-354611cc90db';

-- 11. Pipeline de Conversão → vw_funnel_current_v3
UPDATE dashboard_widgets SET config = jsonb_build_object(
  'dataSource', 'vw_funnel_current_v3',
  'metric', 'lead_count',
  'aggregation', 'sum',
  'groupBy', 'funnel_stage',
  'format', 'number'
), title = 'Pipeline de Conversão',
   description = 'Funil atual por etapas',
   size = 'medium'
WHERE id = 'd9bf0bf6-7b42-4374-b895-38fae0d6d4f7';

-- 12. Próximas Reuniões → vw_calendar_events_current_v3
UPDATE dashboard_widgets SET config = jsonb_build_object(
  'dataSource', 'vw_calendar_events_current_v3',
  'pageSize', 5
), title = 'Próximas Reuniões',
   description = 'Reuniões agendadas a partir de hoje',
   size = 'medium'
WHERE id = '5172ba8d-8fb6-4219-82b9-8fe4532e80bc';

-- 13. Insights IA stays as-is (mock data)
UPDATE dashboard_widgets SET 
   size = 'medium',
   description = 'Análises baseadas nos dados reais'
WHERE id = '05deff89-7b77-4bb9-9d05-36d332cf51aa';

-- 14. Distribuição por Origem → vw_dashboard_daily_60d_v3 grouped by source
UPDATE dashboard_widgets SET config = jsonb_build_object(
  'dataSource', 'vw_dashboard_daily_60d_v3',
  'metric', 'new_leads',
  'aggregation', 'count',
  'groupBy', 'lead_source',
  'format', 'number'
), title = 'Distribuição por Origem',
   description = 'Leads por canal de aquisição',
   size = 'medium',
   is_visible = false
WHERE id = 'fde0ccc7-7aa3-43fe-8acf-19442dc1f8a0';

-- 15. Lista de Leads → leads_v2
UPDATE dashboard_widgets SET config = jsonb_build_object(
  'dataSource', 'leads_v2',
  'pageSize', 8
), title = 'Lista de Leads',
   description = 'Leads recentes com detalhes',
   size = 'medium'
WHERE id = 'f06f96d9-9905-466d-b1fa-ebb751e73479';

-- Add a "Reuniões do Mês" widget that's missing
INSERT INTO dashboard_widgets (dashboard_id, title, type, position, size, description, config, is_visible)
VALUES (
  '9da30d81-04a6-4cd5-b7f4-edeca2b9c6bf',
  'Reuniões do Mês',
  'table',
  13,
  'medium',
  'Controle de comparecimento',
  '{"dataSource": "vw_calendar_events_current_v3", "pageSize": 5}'::jsonb,
  true
);
