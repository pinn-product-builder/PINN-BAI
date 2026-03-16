-- Create dashboard_templates table
CREATE TABLE public.dashboard_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  plan INTEGER NOT NULL DEFAULT 1,
  category TEXT DEFAULT 'sales',
  widgets JSONB NOT NULL DEFAULT '[]'::jsonb,
  preview_image_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  usage_count INTEGER DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.dashboard_templates ENABLE ROW LEVEL SECURITY;

-- Platform admins can manage templates (all operations)
CREATE POLICY "Platform admins can manage templates"
ON public.dashboard_templates FOR ALL
USING (is_platform_admin(auth.uid()));

-- Authenticated users can view active templates
CREATE POLICY "Authenticated users can view active templates"
ON public.dashboard_templates FOR SELECT
USING (is_active = true AND auth.uid() IS NOT NULL);

-- Create trigger for updated_at
CREATE TRIGGER update_dashboard_templates_updated_at
BEFORE UPDATE ON public.dashboard_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Seed: Dashboard Starter (Plan 1)
INSERT INTO public.dashboard_templates (name, description, plan, category, widgets) VALUES (
  'Dashboard Starter',
  'Template básico com métricas essenciais e funil de vendas',
  1,
  'sales',
  '[
    {"type": "metric_card", "title": "Total de Leads", "size": "small", "position": 1, "config": {"metric": "total_leads", "showTrend": true}},
    {"type": "metric_card", "title": "Conversões", "size": "small", "position": 2, "config": {"metric": "conversions", "showTrend": true}},
    {"type": "funnel", "title": "Funil de Vendas", "size": "large", "position": 3, "config": {"stages": ["new", "qualified", "proposal", "converted"]}}
  ]'::jsonb
);

-- Seed: Dashboard Professional (Plan 2)
INSERT INTO public.dashboard_templates (name, description, plan, category, widgets) VALUES (
  'Dashboard Professional',
  'Template com métricas avançadas, gráficos de linha e insights básicos',
  2,
  'sales',
  '[
    {"type": "metric_card", "title": "Total de Leads", "size": "small", "position": 1, "config": {"metric": "total_leads", "showTrend": true}},
    {"type": "metric_card", "title": "Conversões", "size": "small", "position": 2, "config": {"metric": "conversions", "showTrend": true}},
    {"type": "metric_card", "title": "Taxa de Conversão", "size": "small", "position": 3, "config": {"metric": "conversion_rate", "showTrend": true, "format": "percent"}},
    {"type": "line_chart", "title": "Evolução Mensal", "size": "medium", "position": 4, "config": {"xAxis": "date", "yAxis": "count", "groupBy": "month"}},
    {"type": "funnel", "title": "Funil de Vendas", "size": "medium", "position": 5, "config": {"stages": ["new", "qualified", "proposal", "converted"]}},
    {"type": "insight_card", "title": "Insights IA", "size": "medium", "position": 6, "config": {"maxInsights": 3}}
  ]'::jsonb
);

-- Seed: Dashboard Business (Plan 3)
INSERT INTO public.dashboard_templates (name, description, plan, category, widgets) VALUES (
  'Dashboard Business',
  'Template completo com múltiplos gráficos, tabelas e insights avançados',
  3,
  'sales',
  '[
    {"type": "metric_card", "title": "Total de Leads", "size": "small", "position": 1, "config": {"metric": "total_leads", "showTrend": true}},
    {"type": "metric_card", "title": "Conversões", "size": "small", "position": 2, "config": {"metric": "conversions", "showTrend": true}},
    {"type": "metric_card", "title": "Taxa de Conversão", "size": "small", "position": 3, "config": {"metric": "conversion_rate", "showTrend": true, "format": "percent"}},
    {"type": "metric_card", "title": "Receita Total", "size": "small", "position": 4, "config": {"metric": "total_revenue", "showTrend": true, "format": "currency"}},
    {"type": "area_chart", "title": "Evolução Mensal", "size": "medium", "position": 5, "config": {"xAxis": "date", "yAxis": "count", "groupBy": "month"}},
    {"type": "pie_chart", "title": "Leads por Origem", "size": "medium", "position": 6, "config": {"groupBy": "source"}},
    {"type": "funnel", "title": "Funil de Vendas", "size": "medium", "position": 7, "config": {"stages": ["new", "qualified", "proposal", "converted"]}},
    {"type": "table", "title": "Últimos Leads", "size": "large", "position": 8, "config": {"limit": 10, "columns": ["name", "email", "status", "created_at"]}},
    {"type": "insight_card", "title": "Insights IA", "size": "medium", "position": 9, "config": {"maxInsights": 5}}
  ]'::jsonb
);

-- Seed: Dashboard Enterprise (Plan 4)
INSERT INTO public.dashboard_templates (name, description, plan, category, widgets) VALUES (
  'Dashboard Enterprise',
  'Template premium com todos os widgets, relatórios customizados e IA avançada',
  4,
  'sales',
  '[
    {"type": "metric_card", "title": "Total de Leads", "size": "small", "position": 1, "config": {"metric": "total_leads", "showTrend": true}},
    {"type": "metric_card", "title": "Conversões", "size": "small", "position": 2, "config": {"metric": "conversions", "showTrend": true}},
    {"type": "metric_card", "title": "Taxa de Conversão", "size": "small", "position": 3, "config": {"metric": "conversion_rate", "showTrend": true, "format": "percent"}},
    {"type": "metric_card", "title": "Receita Total", "size": "small", "position": 4, "config": {"metric": "total_revenue", "showTrend": true, "format": "currency"}},
    {"type": "metric_card", "title": "Ticket Médio", "size": "small", "position": 5, "config": {"metric": "avg_ticket", "showTrend": true, "format": "currency"}},
    {"type": "metric_card", "title": "CAC", "size": "small", "position": 6, "config": {"metric": "cac", "showTrend": true, "format": "currency"}},
    {"type": "area_chart", "title": "Evolução Mensal", "size": "medium", "position": 7, "config": {"xAxis": "date", "yAxis": "count", "groupBy": "month"}},
    {"type": "bar_chart", "title": "Leads por Origem", "size": "medium", "position": 8, "config": {"groupBy": "source"}},
    {"type": "line_chart", "title": "Comparativo de Períodos", "size": "medium", "position": 9, "config": {"compareMode": true}},
    {"type": "funnel", "title": "Funil de Vendas", "size": "medium", "position": 10, "config": {"stages": ["new", "qualified", "proposal", "converted"]}},
    {"type": "funnel", "title": "Funil de Marketing", "size": "medium", "position": 11, "config": {"stages": ["visitor", "lead", "mql", "sql"]}},
    {"type": "table", "title": "Últimos Leads", "size": "large", "position": 12, "config": {"limit": 15, "columns": ["name", "email", "company", "status", "value", "created_at"]}},
    {"type": "table", "title": "Performance por Vendedor", "size": "large", "position": 13, "config": {"groupBy": "seller", "metrics": ["leads", "conversions", "revenue"]}},
    {"type": "insight_card", "title": "Insights IA Avançados", "size": "large", "position": 14, "config": {"maxInsights": 10, "includeRecommendations": true}}
  ]'::jsonb
);