-- Template Visão Executiva Premium — genérico para qualquer cliente
-- Usa targetMetric como chave semântica; metric/dataSource são preenchidos no onboarding
-- Estrutura espelha o padrão Afonsina: 5 KPIs primários, 4 secundários, gráficos, funil, tabelas, insights

-- Desativar templates antigos (manter dados, só esconder)
UPDATE public.dashboard_templates SET is_active = false WHERE name IN (
  'Dashboard Starter',
  'Dashboard Professional',
  'Dashboard Business',
  'Dashboard Enterprise'
);

-- Inserir template premium
INSERT INTO public.dashboard_templates (
  name,
  description,
  plan,
  category,
  is_active,
  widgets,
  preview_image_url
) VALUES (
  'Visão Executiva Premium',
  'Dashboard executivo completo com KPIs primários e secundários, evolução temporal multi-série, pipeline de conversão, insights IA e lista de leads. Nível enterprise para qualquer cliente.',
  1,
  'executive',
  true,
  '[
    {
      "type": "metric_card",
      "title": "Total de Leads",
      "description": "Quantidade total de leads no período",
      "size": "small",
      "position": 1,
      "config": {
        "targetMetric": "total_leads",
        "format": "number",
        "aggregation": "count",
        "showTrend": true,
        "showSparkline": true
      }
    },
    {
      "type": "metric_card",
      "title": "Mensagens",
      "description": "Total de mensagens recebidas no período",
      "size": "small",
      "position": 2,
      "config": {
        "targetMetric": "total_messages",
        "format": "number",
        "aggregation": "sum",
        "showTrend": true,
        "showSparkline": true
      }
    },
    {
      "type": "metric_card",
      "title": "Reuniões Agendadas",
      "description": "Reuniões agendadas no período",
      "size": "small",
      "position": 3,
      "config": {
        "targetMetric": "meetings_scheduled",
        "format": "number",
        "aggregation": "sum",
        "showTrend": true,
        "showSparkline": true
      }
    },
    {
      "type": "metric_card",
      "title": "Reuniões Realizadas",
      "description": "Reuniões que efetivamente aconteceram",
      "size": "small",
      "position": 4,
      "config": {
        "targetMetric": "meetings_done",
        "format": "number",
        "aggregation": "sum",
        "showTrend": true,
        "showSparkline": true
      }
    },
    {
      "type": "metric_card",
      "title": "Reuniões Concluídas",
      "description": "Reuniões concluídas com sucesso",
      "size": "small",
      "position": 5,
      "config": {
        "targetMetric": "meetings_completed",
        "format": "number",
        "aggregation": "sum",
        "showTrend": true,
        "showSparkline": true
      }
    },
    {
      "type": "metric_card",
      "title": "Investimento",
      "description": "Valor investido em campanhas",
      "size": "small",
      "position": 6,
      "config": {
        "targetMetric": "investment",
        "format": "currency",
        "aggregation": "sum",
        "showTrend": true,
        "showSparkline": true
      }
    },
    {
      "type": "metric_card",
      "title": "CPL",
      "description": "Custo por Lead médio",
      "size": "small",
      "position": 7,
      "config": {
        "targetMetric": "cost_per_lead",
        "format": "currency",
        "aggregation": "avg",
        "showTrend": true,
        "showSparkline": true
      }
    },
    {
      "type": "metric_card",
      "title": "Custo por Reunião",
      "description": "Custo médio por reunião agendada",
      "size": "small",
      "position": 8,
      "config": {
        "targetMetric": "cost_per_meeting",
        "format": "currency",
        "aggregation": "avg",
        "showTrend": true,
        "showSparkline": true
      }
    },
    {
      "type": "metric_card",
      "title": "Conv. Lead → Reunião",
      "description": "Taxa de conversão de lead para reunião",
      "size": "small",
      "position": 9,
      "config": {
        "targetMetric": "lead_to_meeting_rate",
        "format": "percentage",
        "aggregation": "avg",
        "showTrend": true,
        "showSparkline": true
      }
    },
    {
      "type": "area_chart",
      "title": "Evolução Diária",
      "description": "Leads, mensagens, reuniões e investimento ao longo do tempo",
      "size": "large",
      "position": 10,
      "config": {
        "targetMetric": "daily_evolution",
        "groupBy": "created_date",
        "aggregation": "sum"
      }
    },
    {
      "type": "funnel",
      "title": "Pipeline de Conversão",
      "description": "Funil atual por etapas",
      "size": "medium",
      "position": 11,
      "config": {
        "targetMetric": "pipeline_funnel",
        "groupBy": "funnel_stage",
        "funnelStages": ["Novo Lead", "Qualificado", "Em Análise", "Proposta", "Convertido"]
      }
    },
    {
      "type": "table",
      "title": "Próximas Reuniões",
      "description": "Reuniões agendadas a partir de hoje",
      "size": "medium",
      "position": 12,
      "config": {
        "targetMetric": "upcoming_meetings",
        "columns": ["date", "lead_name", "type", "status"],
        "pageSize": 5
      }
    },
    {
      "type": "insight_card",
      "title": "Insights IA",
      "description": "Análise baseada nos dados reais",
      "size": "medium",
      "position": 13,
      "config": {
        "maxInsights": 5,
        "includeRecommendations": true
      }
    },
    {
      "type": "pie_chart",
      "title": "Distribuição por Origem",
      "description": "Leads por canal de aquisição",
      "size": "medium",
      "position": 14,
      "config": {
        "targetMetric": "leads_by_source",
        "groupBy": "lead_source",
        "aggregation": "count"
      }
    },
    {
      "type": "table",
      "title": "Lista de Leads",
      "description": "Leads recentes com detalhes",
      "size": "large",
      "position": 15,
      "config": {
        "targetMetric": "leads_list",
        "columns": ["name", "email", "source", "status", "value", "created_at"],
        "pageSize": 8
      }
    }
  ]'::jsonb,
  null
);
