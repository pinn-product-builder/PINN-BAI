
-- Rename existing dashboard to Tráfego Pago
UPDATE dashboards SET name = 'Tráfego Pago', is_default = false 
WHERE id = '9da30d81-04a6-4cd5-b7f4-edeca2b9c6bf';

-- Create Executivo dashboard (default)
INSERT INTO dashboards (org_id, name, description, is_default) VALUES
('65af7200-7a35-42b4-87ee-c4ea3b0133ef', 'Executivo', 'Visão geral executiva com KPIs, funil e insights', true);

-- Create Conversas dashboard
INSERT INTO dashboards (org_id, name, description, is_default) VALUES
('65af7200-7a35-42b4-87ee-c4ea3b0133ef', 'Conversas', 'Análise de mensagens e conversas', false);

-- Create VAPI dashboard
INSERT INTO dashboards (org_id, name, description, is_default) VALUES
('65af7200-7a35-42b4-87ee-c4ea3b0133ef', 'Ligações VAPI', 'Monitoramento de chamadas VAPI', false);

-- ==========================================
-- EXECUTIVO WIDGETS (uses subquery to get dashboard id)
-- ==========================================

INSERT INTO dashboard_widgets (dashboard_id, title, type, position, size, config)
SELECT d.id, v.title, v.type::widget_type, v.pos, v.sz, v.cfg::jsonb
FROM dashboards d
CROSS JOIN (VALUES
  ('Leads (30d)', 'metric_card', 0, 'small', '{"dataSource":"vw_dashboard_kpis_30d_v3","metric":"leads_total_30d","aggregation":"sum","format":"number","showSparkline":true,"showTrend":true}'),
  ('Novos Leads', 'metric_card', 1, 'small', '{"dataSource":"vw_dashboard_kpis_30d_v3","metric":"leads_30d","aggregation":"sum","format":"number","showSparkline":true,"showTrend":true}'),
  ('Mensagens (30d)', 'metric_card', 2, 'small', '{"dataSource":"vw_dashboard_kpis_30d_v3","metric":"msg_in_30d","aggregation":"sum","format":"number","showSparkline":true,"showTrend":true}'),
  ('Reuniões Agendadas', 'metric_card', 3, 'small', '{"dataSource":"vw_dashboard_kpis_30d_v3","metric":"meetings_booked_30d","aggregation":"sum","format":"number","showSparkline":true,"showTrend":true}'),
  ('Reuniões Realizadas', 'metric_card', 4, 'small', '{"dataSource":"vw_dashboard_kpis_30d_v3","metric":"meetings_done_30d","aggregation":"sum","format":"number","showSparkline":true,"showTrend":true}'),
  ('Investimento', 'metric_card', 5, 'small', '{"dataSource":"vw_afonsina_custos_funil_dia","metric":"custo_total","aggregation":"sum","format":"currency","showSparkline":true,"showTrend":true}'),
  ('CPL', 'metric_card', 6, 'small', '{"dataSource":"vw_afonsina_custos_funil_dia","metric":"cpl_30d","aggregation":"avg","format":"currency","showSparkline":true,"showTrend":true}'),
  ('Taxa de Conversão', 'metric_card', 7, 'small', '{"dataSource":"vw_dashboard_kpis_30d_v3","metric":"conv_lead_to_meeting_30d","aggregation":"avg","format":"percentage","showSparkline":true,"showTrend":true}'),
  ('Evolução Diária (60d)', 'area_chart', 8, 'large', '{"dataSource":"vw_dashboard_daily_60d_v3","groupBy":"day","dataKeys":["new_leads","msg_in","meetings_done","spend_total"],"seriesLabels":{"new_leads":"Novos Leads","msg_in":"Mensagens","meetings_done":"Reuniões","spend_total":"Investimento"}}'),
  ('Pipeline de Conversão', 'funnel', 9, 'medium', '{"dataSource":"vw_funnel_current_v3","groupBy":"funnel_stage","metric":"lead_count","aggregation":"sum"}'),
  ('Lista de Leads', 'table', 10, 'large', '{"dataSource":"leads_v2","pageSize":8}'),
  ('Reuniões do Mês', 'table', 11, 'medium', '{"dataSource":"meeting_attendance","pageSize":8}'),
  ('Insights IA', 'insight_card', 12, 'medium', '{"dataSource":"ai_insights","maxInsights":5,"includeRecommendations":true}')
) AS v(title, type, pos, sz, cfg)
WHERE d.org_id = '65af7200-7a35-42b4-87ee-c4ea3b0133ef' AND d.name = 'Executivo';

-- ==========================================
-- CONVERSAS WIDGETS
-- ==========================================

INSERT INTO dashboard_widgets (dashboard_id, title, type, position, size, config)
SELECT d.id, v.title, v.type::widget_type, v.pos, v.sz, v.cfg::jsonb
FROM dashboards d
CROSS JOIN (VALUES
  ('Mensagens (30d)', 'metric_card', 0, 'small', '{"dataSource":"vw_dashboard_kpis_30d_v3","metric":"msg_in_30d","aggregation":"sum","format":"number","showSparkline":true}'),
  ('Leads (30d)', 'metric_card', 1, 'small', '{"dataSource":"vw_dashboard_kpis_30d_v3","metric":"leads_30d","aggregation":"sum","format":"number","showSparkline":true}'),
  ('Reuniões (30d)', 'metric_card', 2, 'small', '{"dataSource":"vw_dashboard_kpis_30d_v3","metric":"meetings_done_30d","aggregation":"sum","format":"number","showSparkline":true}'),
  ('Conv. Lead→Reunião', 'metric_card', 3, 'small', '{"dataSource":"vw_dashboard_kpis_30d_v3","metric":"conv_lead_to_meeting_30d","aggregation":"avg","format":"percentage","showSparkline":true}'),
  ('Mensagens Diárias (60d)', 'area_chart', 4, 'large', '{"dataSource":"vw_kommo_msg_in_daily_60d_v3","groupBy":"day","dataKeys":["msg_in"],"seriesLabels":{"msg_in":"Mensagens"}}'),
  ('Distribuição por Hora (7d)', 'bar_chart', 5, 'medium', '{"dataSource":"vw_kommo_msg_in_by_hour_7d_v3","groupBy":"hour","metric":"msg_in","aggregation":"sum"}'),
  ('Mapa de Calor (30d)', 'table', 6, 'large', '{"dataSource":"vw_kommo_msg_in_heatmap_30d_v3","pageSize":10}'),
  ('Métricas Diárias', 'table', 7, 'large', '{"dataSource":"vw_kommo_msg_in_daily_60d_v3","pageSize":7}'),
  ('Insights de Conversas', 'insight_card', 8, 'medium', '{"dataSource":"ai_insights","maxInsights":5}')
) AS v(title, type, pos, sz, cfg)
WHERE d.org_id = '65af7200-7a35-42b4-87ee-c4ea3b0133ef' AND d.name = 'Conversas';

-- ==========================================
-- VAPI WIDGETS
-- ==========================================

INSERT INTO dashboard_widgets (dashboard_id, title, type, position, size, config)
SELECT d.id, v.title, v.type::widget_type, v.pos, v.sz, v.cfg::jsonb
FROM dashboards d
CROSS JOIN (VALUES
  ('Ligações Realizadas', 'metric_card', 0, 'small', '{"dataSource":"v3_calls_daily_v3","metric":"calls_total","aggregation":"sum","format":"number","showSparkline":true}'),
  ('Atendidas', 'metric_card', 1, 'small', '{"dataSource":"v3_calls_daily_v3","metric":"calls_answered","aggregation":"sum","format":"number","showSparkline":true}'),
  ('Taxa de Atendimento', 'metric_card', 2, 'small', '{"dataSource":"v3_calls_daily_v3","metric":"answer_rate","aggregation":"avg","format":"percentage","showSparkline":true}'),
  ('Custo Total', 'metric_card', 3, 'small', '{"dataSource":"v3_calls_daily_v3","metric":"cost_total","aggregation":"sum","format":"currency","showSparkline":true}'),
  ('Evolução Diária', 'area_chart', 4, 'large', '{"dataSource":"v3_calls_daily_v3","groupBy":"day","dataKeys":["calls_total","calls_answered"],"seriesLabels":{"calls_total":"Total","calls_answered":"Atendidas"}}'),
  ('Custo Acumulado', 'line_chart', 5, 'medium', '{"dataSource":"v3_calls_daily_v3","groupBy":"day","dataKeys":["cost_total"],"seriesLabels":{"cost_total":"Custo"}}'),
  ('Motivos de Finalização', 'bar_chart', 6, 'medium', '{"dataSource":"v3_calls_ended_reason_daily","groupBy":"ended_reason","metric":"count","aggregation":"sum"}'),
  ('Últimas 50 Ligações', 'table', 7, 'large', '{"dataSource":"vapi_calls","pageSize":10}'),
  ('Tabela Diária', 'table', 8, 'large', '{"dataSource":"v3_calls_daily_v3","pageSize":7}'),
  ('Insights VAPI', 'insight_card', 9, 'medium', '{"dataSource":"ai_insights","maxInsights":5}')
) AS v(title, type, pos, sz, cfg)
WHERE d.org_id = '65af7200-7a35-42b4-87ee-c4ea3b0133ef' AND d.name = 'Ligações VAPI';
