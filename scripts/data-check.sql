SET session_replication_role = replica;

--
-- PostgreSQL database dump
--

-- \restrict hngm1YcNCVK2Lv4VG5doFBXBOeQZEI6jejY9fwiiK2J1Cpk13yeWhYm0Uk5PTtS

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: organizations; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."organizations" ("id", "name", "slug", "plan", "status", "logo_url", "primary_color", "admin_name", "admin_email", "settings", "created_at", "updated_at") VALUES
	('20def139-fdfe-4b88-a2a3-706b9df01a49', 'PINN ', 'pinn-69a8318f', 2, 'active', NULL, '#3B82F6', 'Pedro', 'pedro@pedro.com', '{}', '2026-02-06 19:15:08.382766+00', '2026-02-06 19:15:08.382766+00');


--
-- Data for Name: activity_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: dashboard_templates; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."dashboard_templates" ("id", "name", "description", "plan", "category", "widgets", "preview_image_url", "is_active", "usage_count", "created_by", "created_at", "updated_at") VALUES
	('d1acf79d-6f11-451c-846f-b76a1cf23975', 'Dashboard Starter', 'Template básico com métricas essenciais e funil de vendas', 1, 'sales', '[{"size": "small", "type": "metric_card", "title": "Total de Leads", "config": {"format": "number", "metric": "total_leads", "showTrend": true}, "position": 1}, {"size": "small", "type": "metric_card", "title": "Novos Leads", "config": {"format": "number", "metric": "new_leads", "showTrend": true}, "position": 2}, {"size": "small", "type": "metric_card", "title": "Conversões", "config": {"format": "number", "metric": "conversions", "showTrend": true}, "position": 3}, {"size": "small", "type": "metric_card", "title": "Taxa de Conversão", "config": {"format": "percentage", "metric": "conversion_rate", "showTrend": true}, "position": 4}, {"size": "medium", "type": "line_chart", "title": "Evolução de Leads", "config": {"xAxis": "date", "yAxis": "count", "metric": "total_leads", "groupBy": "created_date"}, "position": 5}, {"size": "large", "type": "funnel", "title": "Funil de Vendas", "config": {"metric": "funnel_stage", "stages": ["new", "qualified", "proposal", "converted"]}, "position": 6}]', NULL, false, 0, NULL, '2026-02-04 20:05:06.627465+00', '2026-02-11 22:58:28.283408+00'),
	('2a4ffaa4-6ff4-4f00-a694-7971a6ef0f36', 'Dashboard Business', 'Template completo com múltiplos gráficos, tabelas e insights avançados', 3, 'sales', '[{"size": "small", "type": "metric_card", "title": "Total de Leads", "config": {"format": "number", "metric": "total_leads", "showTrend": true}, "position": 1}, {"size": "small", "type": "metric_card", "title": "Novos Leads", "config": {"format": "number", "metric": "new_leads", "showTrend": true}, "position": 2}, {"size": "small", "type": "metric_card", "title": "Conversões", "config": {"format": "number", "metric": "conversions", "showTrend": true}, "position": 3}, {"size": "small", "type": "metric_card", "title": "Taxa de Conversão", "config": {"format": "percentage", "metric": "conversion_rate", "showTrend": true}, "position": 4}, {"size": "small", "type": "metric_card", "title": "Receita Total", "config": {"format": "currency", "metric": "revenue", "showTrend": true}, "position": 5}, {"size": "small", "type": "metric_card", "title": "MRR", "config": {"format": "currency", "metric": "mrr", "showTrend": true}, "position": 6}, {"size": "medium", "type": "line_chart", "title": "Evolução de Leads", "config": {"xAxis": "date", "yAxis": "count", "metric": "total_leads", "groupBy": "created_date"}, "position": 7}, {"size": "medium", "type": "area_chart", "title": "Evolução de Receita", "config": {"xAxis": "date", "yAxis": "sum", "metric": "revenue", "groupBy": "created_date"}, "position": 8}, {"size": "medium", "type": "pie_chart", "title": "Leads por Origem", "config": {"metric": "total_leads", "groupBy": "lead_source"}, "position": 9}, {"size": "medium", "type": "funnel", "title": "Funil de Vendas", "config": {"metric": "funnel_stage", "stages": ["new", "qualified", "proposal", "converted"]}, "position": 10}, {"size": "large", "type": "table", "title": "Últimos Leads", "config": {"limit": 10, "columns": ["name", "email", "status", "created_date"]}, "position": 11}, {"size": "medium", "type": "insight_card", "title": "Insights IA", "config": {"maxInsights": 5}, "position": 12}]', NULL, false, 0, NULL, '2026-02-04 20:05:06.627465+00', '2026-02-11 22:58:28.283408+00'),
	('4d4b7cfa-43e9-4d6e-8072-6e110cff569d', 'Dashboard Professional', 'Template com métricas avançadas, gráficos de linha e insights básicos', 2, 'sales', '[{"size": "small", "type": "metric_card", "title": "Total de Leads", "config": {"format": "number", "metric": "total_leads", "showTrend": true}, "position": 1}, {"size": "small", "type": "metric_card", "title": "Novos Leads", "config": {"format": "number", "metric": "new_leads", "showTrend": true}, "position": 2}, {"size": "small", "type": "metric_card", "title": "Conversões", "config": {"format": "number", "metric": "conversions", "showTrend": true}, "position": 3}, {"size": "small", "type": "metric_card", "title": "Taxa de Conversão", "config": {"format": "percentage", "metric": "conversion_rate", "showTrend": true}, "position": 4}, {"size": "small", "type": "metric_card", "title": "Receita Total", "config": {"format": "currency", "metric": "revenue", "showTrend": true}, "position": 5}, {"size": "medium", "type": "line_chart", "title": "Evolução de Leads", "config": {"xAxis": "date", "yAxis": "count", "metric": "total_leads", "groupBy": "created_date"}, "position": 6}, {"size": "medium", "type": "bar_chart", "title": "Leads por Origem", "config": {"metric": "total_leads", "groupBy": "lead_source"}, "position": 7}, {"size": "medium", "type": "funnel", "title": "Funil de Vendas", "config": {"metric": "funnel_stage", "stages": ["new", "qualified", "proposal", "converted"]}, "position": 8}, {"size": "medium", "type": "insight_card", "title": "Insights IA", "config": {"maxInsights": 5}, "position": 9}]', NULL, false, 0, NULL, '2026-02-04 20:05:06.627465+00', '2026-02-11 22:58:28.283408+00'),
	('c278ea9d-86c3-484d-9ac8-c00fcab6b293', 'Dashboard Enterprise', 'Template premium com todos os widgets, relatórios customizados e IA avançada', 4, 'sales', '[{"size": "small", "type": "metric_card", "title": "Total de Leads", "config": {"format": "number", "metric": "total_leads", "showTrend": true}, "position": 1}, {"size": "small", "type": "metric_card", "title": "Novos Leads", "config": {"format": "number", "metric": "new_leads", "showTrend": true}, "position": 2}, {"size": "small", "type": "metric_card", "title": "Conversões", "config": {"format": "number", "metric": "conversions", "showTrend": true}, "position": 3}, {"size": "small", "type": "metric_card", "title": "Taxa de Conversão", "config": {"format": "percentage", "metric": "conversion_rate", "showTrend": true}, "position": 4}, {"size": "small", "type": "metric_card", "title": "Receita Total", "config": {"format": "currency", "metric": "revenue", "showTrend": true}, "position": 5}, {"size": "small", "type": "metric_card", "title": "MRR", "config": {"format": "currency", "metric": "mrr", "showTrend": true}, "position": 6}, {"size": "medium", "type": "line_chart", "title": "Evolução de Leads", "config": {"xAxis": "date", "yAxis": "count", "metric": "total_leads", "groupBy": "created_date"}, "position": 7}, {"size": "medium", "type": "area_chart", "title": "Evolução de Receita", "config": {"xAxis": "date", "yAxis": "sum", "metric": "revenue", "groupBy": "created_date"}, "position": 8}, {"size": "medium", "type": "bar_chart", "title": "Leads por Origem", "config": {"metric": "total_leads", "groupBy": "lead_source"}, "position": 9}, {"size": "medium", "type": "pie_chart", "title": "Distribuição de Conversões", "config": {"metric": "conversions", "groupBy": "lead_source"}, "position": 10}, {"size": "medium", "type": "funnel", "title": "Funil de Vendas", "config": {"metric": "funnel_stage", "stages": ["new", "qualified", "proposal", "converted"]}, "position": 11}, {"size": "large", "type": "table", "title": "Últimos Leads", "config": {"limit": 15, "columns": ["name", "email", "company", "status", "value", "created_date"]}, "position": 12}, {"size": "large", "type": "insight_card", "title": "Insights IA Avançados", "config": {"maxInsights": 10, "includeRecommendations": true}, "position": 13}]', NULL, false, 0, NULL, '2026-02-04 20:05:06.627465+00', '2026-02-11 22:58:28.283408+00'),
	('13aea553-51e1-4b1b-ac30-a90a97aac058', 'Visão Executiva Premium', 'Dashboard executivo completo com KPIs primários e secundários, evolução temporal multi-série, pipeline de conversão, insights IA e lista de leads. Nível enterprise para qualquer cliente.', 1, 'executive', '[{"size": "small", "type": "metric_card", "title": "Total de Leads", "config": {"format": "number", "showTrend": true, "aggregation": "count", "targetMetric": "total_leads", "showSparkline": true}, "position": 1, "description": "Quantidade total de leads no período"}, {"size": "small", "type": "metric_card", "title": "Mensagens", "config": {"format": "number", "showTrend": true, "aggregation": "sum", "targetMetric": "total_messages", "showSparkline": true}, "position": 2, "description": "Total de mensagens recebidas no período"}, {"size": "small", "type": "metric_card", "title": "Reuniões Agendadas", "config": {"format": "number", "showTrend": true, "aggregation": "sum", "targetMetric": "meetings_scheduled", "showSparkline": true}, "position": 3, "description": "Reuniões agendadas no período"}, {"size": "small", "type": "metric_card", "title": "Reuniões Realizadas", "config": {"format": "number", "showTrend": true, "aggregation": "sum", "targetMetric": "meetings_done", "showSparkline": true}, "position": 4, "description": "Reuniões que efetivamente aconteceram"}, {"size": "small", "type": "metric_card", "title": "Reuniões Concluídas", "config": {"format": "number", "showTrend": true, "aggregation": "sum", "targetMetric": "meetings_completed", "showSparkline": true}, "position": 5, "description": "Reuniões concluídas com sucesso"}, {"size": "small", "type": "metric_card", "title": "Investimento", "config": {"format": "currency", "showTrend": true, "aggregation": "sum", "targetMetric": "investment", "showSparkline": true}, "position": 6, "description": "Valor investido em campanhas"}, {"size": "small", "type": "metric_card", "title": "CPL", "config": {"format": "currency", "showTrend": true, "aggregation": "avg", "targetMetric": "cost_per_lead", "showSparkline": true}, "position": 7, "description": "Custo por Lead médio"}, {"size": "small", "type": "metric_card", "title": "Custo por Reunião", "config": {"format": "currency", "showTrend": true, "aggregation": "avg", "targetMetric": "cost_per_meeting", "showSparkline": true}, "position": 8, "description": "Custo médio por reunião agendada"}, {"size": "small", "type": "metric_card", "title": "Conv. Lead → Reunião", "config": {"format": "percentage", "showTrend": true, "aggregation": "avg", "targetMetric": "lead_to_meeting_rate", "showSparkline": true}, "position": 9, "description": "Taxa de conversão de lead para reunião"}, {"size": "large", "type": "area_chart", "title": "Evolução Diária", "config": {"groupBy": "created_date", "aggregation": "sum", "targetMetric": "daily_evolution"}, "position": 10, "description": "Leads, mensagens, reuniões e investimento ao longo do tempo"}, {"size": "medium", "type": "funnel", "title": "Pipeline de Conversão", "config": {"groupBy": "funnel_stage", "funnelStages": ["Novo Lead", "Qualificado", "Em Análise", "Proposta", "Convertido"], "targetMetric": "pipeline_funnel"}, "position": 11, "description": "Funil atual por etapas"}, {"size": "medium", "type": "table", "title": "Próximas Reuniões", "config": {"columns": ["date", "lead_name", "type", "status"], "pageSize": 5, "targetMetric": "upcoming_meetings"}, "position": 12, "description": "Reuniões agendadas a partir de hoje"}, {"size": "medium", "type": "insight_card", "title": "Insights IA", "config": {"maxInsights": 5, "includeRecommendations": true}, "position": 13, "description": "Análise baseada nos dados reais"}, {"size": "medium", "type": "pie_chart", "title": "Distribuição por Origem", "config": {"groupBy": "lead_source", "aggregation": "count", "targetMetric": "leads_by_source"}, "position": 14, "description": "Leads por canal de aquisição"}, {"size": "large", "type": "table", "title": "Lista de Leads", "config": {"columns": ["name", "email", "source", "status", "value", "created_at"], "pageSize": 8, "targetMetric": "leads_list"}, "position": 15, "description": "Leads recentes com detalhes"}]', NULL, true, 0, NULL, '2026-02-11 22:58:28.283408+00', '2026-02-11 22:58:28.283408+00');


--
-- Data for Name: dashboards; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."dashboards" ("id", "org_id", "name", "description", "is_default", "layout", "filters", "created_at", "updated_at") VALUES
	('4968e759-d583-4e8e-b52c-e061f01c8fcb', '20def139-fdfe-4b88-a2a3-706b9df01a49', 'Main Executive View', NULL, true, '{}', '{}', '2026-02-06 19:15:08.637656+00', '2026-02-06 19:15:08.637656+00');


--
-- Data for Name: dashboard_widgets; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: integrations; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: data_mappings; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: leads; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: profiles; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."profiles" ("id", "user_id", "org_id", "full_name", "avatar_url", "email", "created_at", "updated_at") VALUES
	('5f7a1319-8950-4a9c-bc9c-461bce3542ac', 'd3accdfe-7759-4c67-a301-b10b90b53f99', NULL, 'admin@pinn.com', NULL, 'admin@pinn.com', '2026-02-04 16:32:27.403786+00', '2026-02-04 16:32:27.403786+00'),
	('2c4cdf09-f026-40e3-a99e-c2cfb4105d92', '3fd7f2b7-c1c8-494a-b78e-903d682652de', '20def139-fdfe-4b88-a2a3-706b9df01a49', 'Pedro', NULL, 'pedro@pedro.com', '2026-02-06 19:15:10.695917+00', '2026-02-06 19:15:10.950063+00'),
	('d3cf62ef-60de-46d6-9885-89dc6d456633', '411b5ba6-0951-4fb1-9820-3050cd655941', NULL, 'Pedro - Afonsina', NULL, 'afonsinaoliveirasdr@gmail.com', '2026-02-04 20:27:54.315493+00', '2026-02-11 22:49:41.901279+00');


--
-- Data for Name: saved_custom_metrics; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: selected_tables; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: user_roles; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."user_roles" ("id", "user_id", "role", "created_at") VALUES
	('0a7022bd-f04d-4288-841a-47f05a086b44', 'd3accdfe-7759-4c67-a301-b10b90b53f99', 'platform_admin', '2026-02-04 16:34:36.822446+00'),
	('a86af2c1-5e40-458c-8bf8-2b32e30cbd75', '411b5ba6-0951-4fb1-9820-3050cd655941', 'client_admin', '2026-02-04 20:27:54.813517+00'),
	('f733fa4d-fd95-4733-8a08-cd4a81651aaa', '3ad6b09c-40c1-4585-9355-ccb193194767', 'client_admin', '2026-02-04 22:49:57.485314+00'),
	('048b55e8-0cdb-4ee0-ac27-ce45162899ae', '3fd7f2b7-c1c8-494a-b78e-903d682652de', 'client_admin', '2026-02-06 19:15:11.392753+00');


--
-- PostgreSQL database dump complete
--

-- \unrestrict hngm1YcNCVK2Lv4VG5doFBXBOeQZEI6jejY9fwiiK2J1Cpk13yeWhYm0Uk5PTtS

RESET ALL;
