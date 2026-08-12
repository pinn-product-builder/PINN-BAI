
-- Insert selected_tables for kommo_leads
INSERT INTO selected_tables (integration_id, table_name, selected_columns, is_primary, row_count, column_types)
VALUES (
  'd5094375-202e-4be4-b32d-233906664fc7',
  'kommo_leads',
  ARRAY['lead_id','pipeline_id','status_id','created_at_iso','updated_at_iso','closed_at_iso','won_at_iso','lost_at_iso','agendamento_iso','encaminhado','atendimento_feito','reuniao_confirmada','reuniao_realizada','nao_confirmou','faltou_reuniao','venda','desqualificado','hermes_entrada','disparo_feito','hermes_encaminhado','hermes_atendimento_finalizado','hermes_nao_confirmou','hermes_reuniao_confirmada','hermes_faltou_reuniao','hermes_reuniao_feita','hermes_venda_ganha','hermes_lead_perdido','synced_at_iso'],
  true,
  4,
  '{"lead_id":"number","pipeline_id":"number","status_id":"number","created_at_iso":"date","updated_at_iso":"date","closed_at_iso":"date","won_at_iso":"date","lost_at_iso":"date","agendamento_iso":"date","encaminhado":"boolean","atendimento_feito":"boolean","reuniao_confirmada":"boolean","reuniao_realizada":"boolean","nao_confirmou":"boolean","faltou_reuniao":"boolean","venda":"boolean","desqualificado":"boolean","hermes_entrada":"boolean","disparo_feito":"boolean","hermes_encaminhado":"boolean","hermes_atendimento_finalizado":"boolean","hermes_nao_confirmou":"boolean","hermes_reuniao_confirmada":"boolean","hermes_faltou_reuniao":"boolean","hermes_reuniao_feita":"boolean","hermes_venda_ganha":"boolean","hermes_lead_perdido":"boolean","synced_at_iso":"date"}'::jsonb
);

-- Now create the dashboard widgets for BF Company dashboard 2153eb97-a66e-4781-a108-68def9a92c3d
-- Widget 1: Total de Leads
INSERT INTO dashboard_widgets (dashboard_id, type, title, description, config, position, size, is_visible)
VALUES ('2153eb97-a66e-4781-a108-68def9a92c3d', 'metric_card', 'Total de Leads', 'Quantidade total de leads', '{"dataSource":"kommo_leads","metricField":"lead_id","aggregation":"count","format":"number","showTrend":true,"showSparkline":true}'::jsonb, 1, 'small', true);

-- Widget 2: Encaminhados
INSERT INTO dashboard_widgets (dashboard_id, type, title, description, config, position, size, is_visible)
VALUES ('2153eb97-a66e-4781-a108-68def9a92c3d', 'metric_card', 'Encaminhados', 'Leads encaminhados', '{"dataSource":"kommo_leads","metricField":"encaminhado","aggregation":"count","format":"number","showTrend":true,"showSparkline":true}'::jsonb, 2, 'small', true);

-- Widget 3: Atendimento Feito
INSERT INTO dashboard_widgets (dashboard_id, type, title, description, config, position, size, is_visible)
VALUES ('2153eb97-a66e-4781-a108-68def9a92c3d', 'metric_card', 'Atendimento Feito', 'Leads com atendimento realizado', '{"dataSource":"kommo_leads","metricField":"atendimento_feito","aggregation":"count","format":"number","showTrend":true,"showSparkline":true}'::jsonb, 3, 'small', true);

-- Widget 4: Reunião Confirmada
INSERT INTO dashboard_widgets (dashboard_id, type, title, description, config, position, size, is_visible)
VALUES ('2153eb97-a66e-4781-a108-68def9a92c3d', 'metric_card', 'Reunião Confirmada', 'Reuniões confirmadas', '{"dataSource":"kommo_leads","metricField":"reuniao_confirmada","aggregation":"count","format":"number","showTrend":true,"showSparkline":true}'::jsonb, 4, 'small', true);

-- Widget 5: Reunião Realizada
INSERT INTO dashboard_widgets (dashboard_id, type, title, description, config, position, size, is_visible)
VALUES ('2153eb97-a66e-4781-a108-68def9a92c3d', 'metric_card', 'Reunião Realizada', 'Reuniões efetivamente realizadas', '{"dataSource":"kommo_leads","metricField":"reuniao_realizada","aggregation":"count","format":"number","showTrend":true,"showSparkline":true}'::jsonb, 5, 'small', true);

-- Widget 6: Vendas
INSERT INTO dashboard_widgets (dashboard_id, type, title, description, config, position, size, is_visible)
VALUES ('2153eb97-a66e-4781-a108-68def9a92c3d', 'metric_card', 'Vendas', 'Leads convertidos em venda', '{"dataSource":"kommo_leads","metricField":"venda","aggregation":"count","format":"number","showTrend":true,"showSparkline":true}'::jsonb, 6, 'small', true);

-- Widget 7: Conv. Lead → Reunião
INSERT INTO dashboard_widgets (dashboard_id, type, title, description, config, position, size, is_visible)
VALUES ('2153eb97-a66e-4781-a108-68def9a92c3d', 'metric_card', 'Conv. Lead → Reunião', 'Taxa de conversão lead para reunião', '{"dataSource":"kommo_leads","metricField":"reuniao_confirmada","aggregation":"count","format":"percentage","showTrend":true,"showSparkline":true}'::jsonb, 7, 'small', true);

-- Widget 8: Desqualificados
INSERT INTO dashboard_widgets (dashboard_id, type, title, description, config, position, size, is_visible)
VALUES ('2153eb97-a66e-4781-a108-68def9a92c3d', 'metric_card', 'Desqualificados', 'Leads desqualificados', '{"dataSource":"kommo_leads","metricField":"desqualificado","aggregation":"count","format":"number","showTrend":true,"showSparkline":true}'::jsonb, 8, 'small', true);

-- Widget 9: Evolução Diária (area chart)
INSERT INTO dashboard_widgets (dashboard_id, type, title, description, config, position, size, is_visible)
VALUES ('2153eb97-a66e-4781-a108-68def9a92c3d', 'area_chart', 'Evolução de Leads', 'Leads criados ao longo do tempo', '{"dataSource":"kommo_leads","metricField":"lead_id","groupBy":"created_at_iso","aggregation":"count"}'::jsonb, 9, 'large', true);

-- Widget 10: Pipeline Funil
INSERT INTO dashboard_widgets (dashboard_id, type, title, description, config, position, size, is_visible)
VALUES ('2153eb97-a66e-4781-a108-68def9a92c3d', 'funnel', 'Pipeline de Conversão', 'Funil do pipeline de vendas', '{"dataSource":"kommo_leads","funnelStages":["Encaminhado","Atendimento Feito","Reunião Confirmada","Reunião Realizada","Venda"],"funnelFields":["encaminhado","atendimento_feito","reuniao_confirmada","reuniao_realizada","venda"]}'::jsonb, 10, 'medium', true);

-- Widget 11: Hermes Pipeline Funil
INSERT INTO dashboard_widgets (dashboard_id, type, title, description, config, position, size, is_visible)
VALUES ('2153eb97-a66e-4781-a108-68def9a92c3d', 'funnel', 'Pipeline Hermes', 'Funil do fluxo Hermes', '{"dataSource":"kommo_leads","funnelStages":["Entrada","Disparo","Encaminhado","Atendimento","Reunião Conf.","Reunião Feita","Venda"],"funnelFields":["hermes_entrada","disparo_feito","hermes_encaminhado","hermes_atendimento_finalizado","hermes_reuniao_confirmada","hermes_reuniao_feita","hermes_venda_ganha"]}'::jsonb, 11, 'medium', true);

-- Widget 12: Insights IA
INSERT INTO dashboard_widgets (dashboard_id, type, title, description, config, position, size, is_visible)
VALUES ('2153eb97-a66e-4781-a108-68def9a92c3d', 'insight_card', 'Insights IA', 'Análise inteligente dos dados', '{"maxInsights":5,"includeRecommendations":true}'::jsonb, 12, 'medium', true);

-- Widget 13: Tabela de Leads
INSERT INTO dashboard_widgets (dashboard_id, type, title, description, config, position, size, is_visible)
VALUES ('2153eb97-a66e-4781-a108-68def9a92c3d', 'table', 'Lista de Leads', 'Todos os leads com status', '{"dataSource":"kommo_leads","columns":["lead_id","created_at_iso","encaminhado","atendimento_feito","reuniao_confirmada","reuniao_realizada","venda","desqualificado"],"pageSize":10}'::jsonb, 13, 'large', true);
