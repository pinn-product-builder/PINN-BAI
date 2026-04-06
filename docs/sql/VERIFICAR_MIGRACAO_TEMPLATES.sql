-- Queries para verificar se a migração foi aplicada corretamente
-- Execute estas queries no SQL Editor do Supabase Dashboard

-- 1. Verificar se os templates existem e quantos widgets têm
SELECT 
  name,
  plan,
  jsonb_array_length(widgets) as total_widgets,
  is_active
FROM dashboard_templates
ORDER BY plan;

-- 2. Verificar estrutura dos widgets do Dashboard Starter
SELECT 
  name,
  jsonb_array_elements(widgets)->>'title' as widget_title,
  jsonb_array_elements(widgets)->>'type' as widget_type,
  jsonb_array_elements(widgets)->'config'->>'metric' as metric,
  jsonb_array_elements(widgets)->'config'->>'format' as format
FROM dashboard_templates
WHERE name = 'Dashboard Starter'
ORDER BY (jsonb_array_elements(widgets)->>'position')::int;

-- 3. Verificar se os formatos estão corretos (currency, percentage, number)
SELECT 
  name,
  jsonb_array_elements(widgets)->>'title' as widget_title,
  jsonb_array_elements(widgets)->'config'->>'format' as format,
  jsonb_array_elements(widgets)->'config'->>'metric' as metric
FROM dashboard_templates
WHERE jsonb_array_elements(widgets)->'config'->>'format' IS NOT NULL
ORDER BY name, (jsonb_array_elements(widgets)->>'position')::int;

-- 4. Contar widgets por tipo em cada template
SELECT 
  name,
  jsonb_array_elements(widgets)->>'type' as widget_type,
  COUNT(*) as count
FROM dashboard_templates
GROUP BY name, jsonb_array_elements(widgets)->>'type'
ORDER BY name, widget_type;

-- 5. Verificar se todos os templates têm "Novos Leads" (novo widget adicionado)
SELECT 
  name,
  COUNT(*) as novos_leads_count
FROM dashboard_templates,
  jsonb_array_elements(widgets) as widget
WHERE widget->>'title' = 'Novos Leads'
GROUP BY name;

-- 6. Verificar estrutura completa de um template (Dashboard Professional)
SELECT 
  widgets
FROM dashboard_templates
WHERE name = 'Dashboard Professional';

-- 7. Verificar se os templates têm as métricas corretas
SELECT 
  name,
  jsonb_array_elements(widgets)->>'title' as widget_title,
  jsonb_array_elements(widgets)->'config'->>'metric' as metric_name
FROM dashboard_templates
WHERE jsonb_array_elements(widgets)->'config'->>'metric' IS NOT NULL
ORDER BY name, (jsonb_array_elements(widgets)->>'position')::int;
