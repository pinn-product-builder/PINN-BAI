
-- Reorganize Afonsina dashboard widgets to match Tráfego Pago reference
-- Dashboard: 9da30d81-04a6-4cd5-b7f4-edeca2b9c6bf
-- All KPIs from vw_afonsina_custos_funil_dia (single source, no duplicates)

-- Row 1: Investimento, Leads, Entradas, Taxa de Entrada
-- 1. Investimento (reuse existing)
UPDATE dashboard_widgets SET config = jsonb_build_object(
  'dataSource', 'vw_afonsina_custos_funil_dia',
  'metric', 'custo_total',
  'aggregation', 'sum',
  'format', 'currency',
  'showSparkline', true,
  'showTrend', true
), title = 'Investimento', description = 'Valor investido em mídia paga', position = 0
WHERE id = '9b7a8fa0-83d6-4cf4-b375-204aa730b203';

-- 2. Leads (reuse Total de Leads)
UPDATE dashboard_widgets SET config = jsonb_build_object(
  'dataSource', 'vw_afonsina_custos_funil_dia',
  'metric', 'leads',
  'aggregation', 'sum',
  'format', 'number',
  'showSparkline', true,
  'showTrend', true
), title = 'Leads', description = 'Total de leads captados', position = 1
WHERE id = '69e52030-bbc0-4be2-a6ff-2c54a7416b3e';

-- 3. Entradas (reuse Mensagens)
UPDATE dashboard_widgets SET config = jsonb_build_object(
  'dataSource', 'vw_afonsina_custos_funil_dia',
  'metric', 'entradas',
  'aggregation', 'sum',
  'format', 'number',
  'showSparkline', true,
  'showTrend', true
), title = 'Entradas', description = 'Leads que entraram no funil', position = 2
WHERE id = '1181d8f9-277c-487b-9250-a66f11110200';

-- 4. Taxa de Entrada (reuse Reuniões Agendadas)
UPDATE dashboard_widgets SET config = jsonb_build_object(
  'dataSource', 'vw_afonsina_custos_funil_dia',
  'metric', 'taxa_entrada',
  'aggregation', 'avg',
  'format', 'percentage',
  'showSparkline', true,
  'showTrend', true
), title = 'Taxa de Entrada', description = 'Percentual de leads que entraram no funil', position = 3
WHERE id = '7fdcc836-4a24-4b9d-ab1a-9b955fa1e85c';

-- Row 2: CPL, Reuniões Agendadas, Reuniões Realizadas, Custo/Reunião
-- 5. CPL
UPDATE dashboard_widgets SET config = jsonb_build_object(
  'dataSource', 'vw_afonsina_custos_funil_dia',
  'metric', 'cpl_30d',
  'aggregation', 'avg',
  'format', 'currency',
  'showSparkline', true,
  'showTrend', true
), title = 'CPL', description = 'Custo por Lead médio', position = 4
WHERE id = '93b12096-d5bf-4397-b2fa-91b5214b468f';

-- 6. Reuniões Agendadas (reuse Reuniões Realizadas)
UPDATE dashboard_widgets SET config = jsonb_build_object(
  'dataSource', 'vw_afonsina_custos_funil_dia',
  'metric', 'meetings_booked',
  'aggregation', 'sum',
  'format', 'number',
  'showSparkline', true,
  'showTrend', true
), title = 'Reuniões Agendadas', description = 'Total de reuniões marcadas', position = 5
WHERE id = '045a552d-1d2a-483d-92d7-961468dba38f';

-- 7. Reuniões Realizadas (reuse Reuniões Canceladas)
UPDATE dashboard_widgets SET config = jsonb_build_object(
  'dataSource', 'vw_afonsina_custos_funil_dia',
  'metric', 'meetings_done',
  'aggregation', 'sum',
  'format', 'number',
  'showSparkline', true,
  'showTrend', true
), title = 'Reuniões Realizadas', description = 'Reuniões que efetivamente aconteceram', position = 6
WHERE id = '21e6c9d7-2701-4d28-a439-e9b3a08f3ae2';

-- 8. Custo/Reunião
UPDATE dashboard_widgets SET config = jsonb_build_object(
  'dataSource', 'vw_afonsina_custos_funil_dia',
  'metric', 'cp_meeting_booked_30d',
  'aggregation', 'avg',
  'format', 'currency',
  'showSparkline', true,
  'showTrend', true
), title = 'Custo/Reunião', description = 'Custo médio por reunião agendada', position = 7
WHERE id = '3acc20b6-b8d0-40ab-8a7d-30e7327335d1';

-- HIDE unused metric cards (Conv. Lead → Reunião)
UPDATE dashboard_widgets SET is_visible = false
WHERE id = '0d474f93-384b-4bbb-99ea-2ccf82e5f0f1';

-- 9. Performance Diária (area chart) → vw_dashboard_daily_60d_v3
UPDATE dashboard_widgets SET config = jsonb_build_object(
  'dataSource', 'vw_dashboard_daily_60d_v3',
  'metric', 'new_leads',
  'aggregation', 'sum',
  'groupBy', 'day',
  'format', 'number',
  'dataKeys', '["new_leads","entradas","meetings_done"]'::jsonb,
  'seriesLabels', '{"new_leads":"Leads","entradas":"Entradas","meetings_done":"Reuniões"}'::jsonb
), title = 'Performance Diária',
   description = 'Leads, entradas e reuniões por dia',
   position = 8,
   size = 'large'
WHERE id = '83529185-c600-4b4c-bdcb-354611cc90db';

-- 10. Pipeline stays at position 9 but renamed
UPDATE dashboard_widgets SET 
  title = 'Pipeline de Conversão',
  description = 'Funil atual por etapas',
  position = 9,
  size = 'medium'
WHERE id = 'd9bf0bf6-7b42-4374-b895-38fae0d6d4f7';

-- 11. Top 10 Anúncios (bar chart) - reuse Distribuição por Origem, make visible
UPDATE dashboard_widgets SET config = jsonb_build_object(
  'dataSource', 'vw_afonsina_custos_funil_dia',
  'metric', 'custo_total',
  'aggregation', 'sum',
  'groupBy', 'anuncio',
  'format', 'currency'
), title = 'Top 10 Anúncios',
   description = 'Anúncios com maior investimento',
   position = 10,
   size = 'medium',
   is_visible = true,
   type = 'bar_chart'
WHERE id = 'fde0ccc7-7aa3-43fe-8acf-19442dc1f8a0';

-- 12. Insights de Tráfego
UPDATE dashboard_widgets SET 
  title = 'Insights de Tráfego',
  description = 'Análise de performance de mídia paga',
  position = 11,
  size = 'medium'
WHERE id = '05deff89-7b77-4bb9-9d05-36d332cf51aa';

-- 13. Métricas Diárias Detalhadas (table) - reuse Próximas Reuniões
UPDATE dashboard_widgets SET config = jsonb_build_object(
  'dataSource', 'vw_afonsina_custos_funil_dia',
  'pageSize', 7
), title = 'Métricas Diárias Detalhadas',
   description = 'Últimos 20 dias com indicadores de tendência',
   position = 12,
   size = 'full'
WHERE id = '5172ba8d-8fb6-4219-82b9-8fe4532e80bc';

-- 14. Lista de Leads stays
UPDATE dashboard_widgets SET position = 13, size = 'medium'
WHERE id = 'f06f96d9-9905-466d-b1fa-ebb751e73479';

-- Hide "Reuniões do Mês" widget that was added previously (not in reference)
UPDATE dashboard_widgets SET is_visible = false
WHERE dashboard_id = '9da30d81-04a6-4cd5-b7f4-edeca2b9c6bf'
  AND title = 'Reuniões do Mês'
  AND id != '5172ba8d-8fb6-4219-82b9-8fe4532e80bc';
