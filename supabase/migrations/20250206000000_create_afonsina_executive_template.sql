-- Template de Dashboard Executivo baseado no projeto Afonsina
-- Replica exatamente a estrutura da ExecutivePage

INSERT INTO dashboard_templates (
  id,
  name,
  description,
  plan,
  category,
  is_active,
  widgets,
  preview_image_url
) VALUES (
  'afonsina-executive-template',
  'Visão Executiva - Afonsina',
  'Dashboard executivo idêntico ao projeto Afonsina com todos os KPIs, gráficos e tabelas',
  2,
  'executive',
  true,
  '[
    {
      "type": "metric_card",
      "title": "Total de Leads",
      "description": "Quantidade total de leads cadastrados no sistema",
      "size": "medium",
      "position": 0,
      "config": {
        "format": "number",
        "metric": "total_leads",
        "aggregation": "count",
        "dataSource": "leads_v2",
        "sourceTable": "leads_v2"
      }
    },
    {
      "type": "metric_card",
      "title": "Mensagens (30d)",
      "description": "Total de mensagens recebidas nos últimos 30 dias",
      "size": "medium",
      "position": 1,
      "config": {
        "format": "number",
        "metric": "msg_in_30d",
        "aggregation": "sum",
        "dataSource": "vw_dashboard_kpis_30d_v3",
        "sourceTable": "vw_dashboard_kpis_30d_v3"
      }
    },
    {
      "type": "metric_card",
      "title": "Reuniões Agendadas (30d)",
      "description": "Número de reuniões agendadas nos últimos 30 dias",
      "size": "medium",
      "position": 2,
      "config": {
        "format": "number",
        "metric": "meetings_scheduled_30d",
        "aggregation": "sum",
        "dataSource": "vw_afonsina_custos_funil_dia",
        "sourceTable": "vw_afonsina_custos_funil_dia"
      }
    },
    {
      "type": "metric_card",
      "title": "Reuniões Realizadas (30d)",
      "description": "Total de reuniões que efetivamente aconteceram",
      "size": "medium",
      "position": 3,
      "config": {
        "format": "number",
        "metric": "meetings_done",
        "aggregation": "sum",
        "dataSource": "vw_afonsina_custos_funil_dia",
        "sourceTable": "vw_afonsina_custos_funil_dia"
      }
    },
    {
      "type": "metric_card",
      "title": "Reuniões Canceladas (30d)",
      "description": "Número de reuniões canceladas nos últimos 30 dias",
      "size": "medium",
      "position": 4,
      "config": {
        "format": "number",
        "metric": "meetings_cancelled_30d",
        "aggregation": "sum",
        "dataSource": "vw_dashboard_kpis_30d_v3",
        "sourceTable": "vw_dashboard_kpis_30d_v3"
      }
    },
    {
      "type": "metric_card",
      "title": "Investimento (30d)",
      "description": "Valor total investido em anúncios nos últimos 30 dias",
      "size": "medium",
      "position": 5,
      "config": {
        "format": "currency",
        "metric": "spend_30d",
        "aggregation": "sum",
        "dataSource": "vw_afonsina_custos_funil_dia",
        "sourceTable": "vw_afonsina_custos_funil_dia"
      }
    },
    {
      "type": "metric_card",
      "title": "CPL (30d)",
      "description": "Custo por Lead médio nos últimos 30 dias",
      "size": "medium",
      "position": 6,
      "config": {
        "format": "currency",
        "metric": "cpl_30d",
        "aggregation": "avg",
        "dataSource": "vw_afonsina_custos_funil_dia",
        "sourceTable": "vw_afonsina_custos_funil_dia"
      }
    },
    {
      "type": "metric_card",
      "title": "Custo por Reunião (30d)",
      "description": "Custo médio para agendar uma reunião",
      "size": "medium",
      "position": 7,
      "config": {
        "format": "currency",
        "metric": "cpm_meeting_30d",
        "aggregation": "avg",
        "dataSource": "vw_afonsina_custos_funil_dia",
        "sourceTable": "vw_afonsina_custos_funil_dia"
      }
    },
    {
      "type": "metric_card",
      "title": "Conv. Lead → Reunião (30d)",
      "description": "Percentual de leads que agendaram reunião",
      "size": "medium",
      "position": 8,
      "config": {
        "format": "percentage",
        "metric": "conv_lead_to_meeting_30d",
        "aggregation": "avg",
        "dataSource": "vw_dashboard_kpis_30d_v3",
        "sourceTable": "vw_dashboard_kpis_30d_v3"
      }
    },
    {
      "type": "line_chart",
      "title": "Evolução Diária (60d)",
      "description": "Leads, mensagens, reuniões e investimento",
      "size": "large",
      "position": 9,
      "config": {
        "dataSource": "vw_dashboard_daily_60d_v3",
        "sourceTable": "vw_dashboard_daily_60d_v3",
        "groupBy": "day",
        "lines": [
          {
            "key": "new_leads",
            "name": "Novos Leads",
            "color": "primary"
          },
          {
            "key": "msg_in",
            "name": "Mensagens",
            "color": "success"
          },
          {
            "key": "meetings_scheduled",
            "name": "Reuniões",
            "color": "warning"
          },
          {
            "key": "spend",
            "name": "Investimento (R$)",
            "color": "destructive"
          }
        ]
      }
    },
    {
      "type": "funnel",
      "title": "Pipeline de Conversão",
      "description": "Funil atual por etapa",
      "size": "large",
      "position": 10,
      "config": {
        "dataSource": "vw_funnel_current_v3",
        "sourceTable": "vw_funnel_current_v3",
        "metric": "funnel_stage",
        "groupBy": "funnel_stage",
        "funnelStages": ["Leads", "Qualificados", "Em Análise", "Proposta"]
      }
    },
    {
      "type": "table",
      "title": "Próximas Reuniões",
      "description": "Reuniões agendadas a partir de hoje",
      "size": "large",
      "position": 11,
      "config": {
        "dataSource": "vw_calendar_events_current_v3",
        "sourceTable": "vw_calendar_events_current_v3",
        "columns": ["date", "lead_name", "status", "link"]
      }
    },
    {
      "type": "insight_card",
      "title": "Insights IA",
      "description": "Análises baseadas nos dados reais",
      "size": "large",
      "position": 12,
      "config": {
        "scope": "executive"
      }
    },
    {
      "type": "table",
      "title": "Reuniões do Mês",
      "description": "Controle de comparecimento",
      "size": "large",
      "position": 13,
      "config": {
        "dataSource": "vw_calendar_events_current_v3",
        "sourceTable": "vw_calendar_events_current_v3",
        "columns": ["date", "lead_name", "status", "attended"]
      }
    },
    {
      "type": "table",
      "title": "Lista de Leads",
      "description": "Leads recentes",
      "size": "large",
      "position": 14,
      "config": {
        "dataSource": "leads_v2",
        "sourceTable": "leads_v2",
        "columns": ["name", "email", "source", "status", "created_at"]
      }
    }
  ]'::jsonb,
  null
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  widgets = EXCLUDED.widgets,
  updated_at = now();
