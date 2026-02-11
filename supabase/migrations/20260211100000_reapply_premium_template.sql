-- Re-aplicar o template "Visão Executiva Premium" no dashboard existente
-- Dashboard: Main Executive View (4968e759-d583-4e8e-b52c-e061f01c8fcb)
-- Template: Visão Executiva Premium (13aea553-51e1-4b1b-ac30-a90a97aac058)

-- 1. Remover widgets antigos
DELETE FROM public.dashboard_widgets
WHERE dashboard_id = '4968e759-d583-4e8e-b52c-e061f01c8fcb';

-- 2. Inserir widgets do template premium
-- Os 15 widgets do template com targetMetric semântico
INSERT INTO public.dashboard_widgets (dashboard_id, title, description, type, position, size, config, is_visible)
VALUES
  -- === ROW 1: 5 KPIs Primários ===
  ('4968e759-d583-4e8e-b52c-e061f01c8fcb', 'Total de Leads', 'Quantidade total de leads no período', 'metric_card', 1, 'small',
   '{"targetMetric": "total_leads", "format": "number", "aggregation": "count", "showTrend": true, "showSparkline": true}'::jsonb, true),

  ('4968e759-d583-4e8e-b52c-e061f01c8fcb', 'Mensagens', 'Total de mensagens recebidas no período', 'metric_card', 2, 'small',
   '{"targetMetric": "total_messages", "format": "number", "aggregation": "sum", "showTrend": true, "showSparkline": true}'::jsonb, true),

  ('4968e759-d583-4e8e-b52c-e061f01c8fcb', 'Reuniões Agendadas', 'Reuniões agendadas no período', 'metric_card', 3, 'small',
   '{"targetMetric": "meetings_scheduled", "format": "number", "aggregation": "sum", "showTrend": true, "showSparkline": true}'::jsonb, true),

  ('4968e759-d583-4e8e-b52c-e061f01c8fcb', 'Reuniões Realizadas', 'Reuniões que efetivamente aconteceram', 'metric_card', 4, 'small',
   '{"targetMetric": "meetings_done", "format": "number", "aggregation": "sum", "showTrend": true, "showSparkline": true}'::jsonb, true),

  ('4968e759-d583-4e8e-b52c-e061f01c8fcb', 'Reuniões Concluídas', 'Reuniões concluídas com sucesso', 'metric_card', 5, 'small',
   '{"targetMetric": "meetings_completed", "format": "number", "aggregation": "sum", "showTrend": true, "showSparkline": true}'::jsonb, true),

  -- === ROW 2: 4 KPIs Secundários ===
  ('4968e759-d583-4e8e-b52c-e061f01c8fcb', 'Investimento', 'Valor investido em campanhas', 'metric_card', 6, 'small',
   '{"targetMetric": "investment", "format": "currency", "aggregation": "sum", "showTrend": true, "showSparkline": true}'::jsonb, true),

  ('4968e759-d583-4e8e-b52c-e061f01c8fcb', 'CPL', 'Custo por Lead médio', 'metric_card', 7, 'small',
   '{"targetMetric": "cost_per_lead", "format": "currency", "aggregation": "avg", "showTrend": true, "showSparkline": true}'::jsonb, true),

  ('4968e759-d583-4e8e-b52c-e061f01c8fcb', 'Custo por Reunião', 'Custo médio por reunião agendada', 'metric_card', 8, 'small',
   '{"targetMetric": "cost_per_meeting", "format": "currency", "aggregation": "avg", "showTrend": true, "showSparkline": true}'::jsonb, true),

  ('4968e759-d583-4e8e-b52c-e061f01c8fcb', 'Conv. Lead → Reunião', 'Taxa de conversão de lead para reunião', 'metric_card', 9, 'small',
   '{"targetMetric": "lead_to_meeting_rate", "format": "percentage", "aggregation": "avg", "showTrend": true, "showSparkline": true}'::jsonb, true),

  -- === ROW 3: Gráficos Principais ===
  ('4968e759-d583-4e8e-b52c-e061f01c8fcb', 'Evolução Diária', 'Leads, mensagens, reuniões e investimento ao longo do tempo', 'area_chart', 10, 'large',
   '{"targetMetric": "daily_evolution", "groupBy": "created_date", "aggregation": "sum"}'::jsonb, true),

  ('4968e759-d583-4e8e-b52c-e061f01c8fcb', 'Pipeline de Conversão', 'Funil atual por etapas', 'funnel', 11, 'medium',
   '{"targetMetric": "pipeline_funnel", "groupBy": "funnel_stage", "funnelStages": ["Novo Lead", "Qualificado", "Em Análise", "Proposta", "Convertido"]}'::jsonb, true),

  -- === ROW 4: Reuniões + Insights ===
  ('4968e759-d583-4e8e-b52c-e061f01c8fcb', 'Próximas Reuniões', 'Reuniões agendadas a partir de hoje', 'table', 12, 'medium',
   '{"targetMetric": "upcoming_meetings", "columns": ["date", "lead_name", "type", "status"], "pageSize": 5}'::jsonb, true),

  ('4968e759-d583-4e8e-b52c-e061f01c8fcb', 'Insights IA', 'Análise baseada nos dados reais', 'insight_card', 13, 'medium',
   '{"maxInsights": 5, "includeRecommendations": true}'::jsonb, true),

  -- === ROW 5: Distribuição + Lista ===
  ('4968e759-d583-4e8e-b52c-e061f01c8fcb', 'Distribuição por Origem', 'Leads por canal de aquisição', 'pie_chart', 14, 'medium',
   '{"targetMetric": "leads_by_source", "groupBy": "lead_source", "aggregation": "count"}'::jsonb, true),

  ('4968e759-d583-4e8e-b52c-e061f01c8fcb', 'Lista de Leads', 'Leads recentes com detalhes', 'table', 15, 'large',
   '{"targetMetric": "leads_list", "columns": ["name", "email", "source", "status", "value", "created_at"], "pageSize": 8}'::jsonb, true);
