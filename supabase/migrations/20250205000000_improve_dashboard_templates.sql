-- Improve dashboard templates with better structure and automatic mapping
-- This migration updates existing templates to work better with automatic metric mapping

-- Update Dashboard Starter template
UPDATE public.dashboard_templates 
SET widgets = '[
  {"type": "metric_card", "title": "Total de Leads", "size": "small", "position": 1, "config": {"metric": "total_leads", "showTrend": true, "format": "number"}},
  {"type": "metric_card", "title": "Novos Leads", "size": "small", "position": 2, "config": {"metric": "new_leads", "showTrend": true, "format": "number"}},
  {"type": "metric_card", "title": "Conversões", "size": "small", "position": 3, "config": {"metric": "conversions", "showTrend": true, "format": "number"}},
  {"type": "metric_card", "title": "Taxa de Conversão", "size": "small", "position": 4, "config": {"metric": "conversion_rate", "showTrend": true, "format": "percentage"}},
  {"type": "line_chart", "title": "Evolução de Leads", "size": "medium", "position": 5, "config": {"metric": "total_leads", "groupBy": "created_date", "xAxis": "date", "yAxis": "count"}},
  {"type": "funnel", "title": "Funil de Vendas", "size": "large", "position": 6, "config": {"metric": "funnel_stage", "stages": ["new", "qualified", "proposal", "converted"]}}
]'::jsonb
WHERE name = 'Dashboard Starter';

-- Update Dashboard Professional template
UPDATE public.dashboard_templates 
SET widgets = '[
  {"type": "metric_card", "title": "Total de Leads", "size": "small", "position": 1, "config": {"metric": "total_leads", "showTrend": true, "format": "number"}},
  {"type": "metric_card", "title": "Novos Leads", "size": "small", "position": 2, "config": {"metric": "new_leads", "showTrend": true, "format": "number"}},
  {"type": "metric_card", "title": "Conversões", "size": "small", "position": 3, "config": {"metric": "conversions", "showTrend": true, "format": "number"}},
  {"type": "metric_card", "title": "Taxa de Conversão", "size": "small", "position": 4, "config": {"metric": "conversion_rate", "showTrend": true, "format": "percentage"}},
  {"type": "metric_card", "title": "Receita Total", "size": "small", "position": 5, "config": {"metric": "revenue", "showTrend": true, "format": "currency"}},
  {"type": "line_chart", "title": "Evolução de Leads", "size": "medium", "position": 6, "config": {"metric": "total_leads", "groupBy": "created_date", "xAxis": "date", "yAxis": "count"}},
  {"type": "bar_chart", "title": "Leads por Origem", "size": "medium", "position": 7, "config": {"metric": "total_leads", "groupBy": "lead_source"}},
  {"type": "funnel", "title": "Funil de Vendas", "size": "medium", "position": 8, "config": {"metric": "funnel_stage", "stages": ["new", "qualified", "proposal", "converted"]}},
  {"type": "insight_card", "title": "Insights IA", "size": "medium", "position": 9, "config": {"maxInsights": 5}}
]'::jsonb
WHERE name = 'Dashboard Professional';

-- Update Dashboard Business template
UPDATE public.dashboard_templates 
SET widgets = '[
  {"type": "metric_card", "title": "Total de Leads", "size": "small", "position": 1, "config": {"metric": "total_leads", "showTrend": true, "format": "number"}},
  {"type": "metric_card", "title": "Novos Leads", "size": "small", "position": 2, "config": {"metric": "new_leads", "showTrend": true, "format": "number"}},
  {"type": "metric_card", "title": "Conversões", "size": "small", "position": 3, "config": {"metric": "conversions", "showTrend": true, "format": "number"}},
  {"type": "metric_card", "title": "Taxa de Conversão", "size": "small", "position": 4, "config": {"metric": "conversion_rate", "showTrend": true, "format": "percentage"}},
  {"type": "metric_card", "title": "Receita Total", "size": "small", "position": 5, "config": {"metric": "revenue", "showTrend": true, "format": "currency"}},
  {"type": "metric_card", "title": "MRR", "size": "small", "position": 6, "config": {"metric": "mrr", "showTrend": true, "format": "currency"}},
  {"type": "line_chart", "title": "Evolução de Leads", "size": "medium", "position": 7, "config": {"metric": "total_leads", "groupBy": "created_date", "xAxis": "date", "yAxis": "count"}},
  {"type": "area_chart", "title": "Evolução de Receita", "size": "medium", "position": 8, "config": {"metric": "revenue", "groupBy": "created_date", "xAxis": "date", "yAxis": "sum"}},
  {"type": "pie_chart", "title": "Leads por Origem", "size": "medium", "position": 9, "config": {"metric": "total_leads", "groupBy": "lead_source"}},
  {"type": "funnel", "title": "Funil de Vendas", "size": "medium", "position": 10, "config": {"metric": "funnel_stage", "stages": ["new", "qualified", "proposal", "converted"]}},
  {"type": "table", "title": "Últimos Leads", "size": "large", "position": 11, "config": {"limit": 10, "columns": ["name", "email", "status", "created_date"]}},
  {"type": "insight_card", "title": "Insights IA", "size": "medium", "position": 12, "config": {"maxInsights": 5}}
]'::jsonb
WHERE name = 'Dashboard Business';

-- Update Dashboard Enterprise template
UPDATE public.dashboard_templates 
SET widgets = '[
  {"type": "metric_card", "title": "Total de Leads", "size": "small", "position": 1, "config": {"metric": "total_leads", "showTrend": true, "format": "number"}},
  {"type": "metric_card", "title": "Novos Leads", "size": "small", "position": 2, "config": {"metric": "new_leads", "showTrend": true, "format": "number"}},
  {"type": "metric_card", "title": "Conversões", "size": "small", "position": 3, "config": {"metric": "conversions", "showTrend": true, "format": "number"}},
  {"type": "metric_card", "title": "Taxa de Conversão", "size": "small", "position": 4, "config": {"metric": "conversion_rate", "showTrend": true, "format": "percentage"}},
  {"type": "metric_card", "title": "Receita Total", "size": "small", "position": 5, "config": {"metric": "revenue", "showTrend": true, "format": "currency"}},
  {"type": "metric_card", "title": "MRR", "size": "small", "position": 6, "config": {"metric": "mrr", "showTrend": true, "format": "currency"}},
  {"type": "line_chart", "title": "Evolução de Leads", "size": "medium", "position": 7, "config": {"metric": "total_leads", "groupBy": "created_date", "xAxis": "date", "yAxis": "count"}},
  {"type": "area_chart", "title": "Evolução de Receita", "size": "medium", "position": 8, "config": {"metric": "revenue", "groupBy": "created_date", "xAxis": "date", "yAxis": "sum"}},
  {"type": "bar_chart", "title": "Leads por Origem", "size": "medium", "position": 9, "config": {"metric": "total_leads", "groupBy": "lead_source"}},
  {"type": "pie_chart", "title": "Distribuição de Conversões", "size": "medium", "position": 10, "config": {"metric": "conversions", "groupBy": "lead_source"}},
  {"type": "funnel", "title": "Funil de Vendas", "size": "medium", "position": 11, "config": {"metric": "funnel_stage", "stages": ["new", "qualified", "proposal", "converted"]}},
  {"type": "table", "title": "Últimos Leads", "size": "large", "position": 12, "config": {"limit": 15, "columns": ["name", "email", "company", "status", "value", "created_date"]}},
  {"type": "insight_card", "title": "Insights IA Avançados", "size": "large", "position": 13, "config": {"maxInsights": 10, "includeRecommendations": true}}
]'::jsonb
WHERE name = 'Dashboard Enterprise';
