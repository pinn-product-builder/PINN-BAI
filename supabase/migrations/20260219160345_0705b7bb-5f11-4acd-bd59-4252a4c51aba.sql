
-- Fix: Total de Leads → kommo_leads_ecologica, count all
UPDATE dashboard_widgets SET 
  config = '{"format":"number","metric":"nome_lead","aggregation":"count","dataSource":"kommo_leads_ecologica","sourceTable":"kommo_leads_ecologica","targetMetric":"total_leads","showTrend":true,"showSparkline":true}'::jsonb,
  description = 'Total de leads no CRM'
WHERE id = '2880d7bd-0ef3-44cc-8e14-565769d4cf7b';

-- Fix: Mensagens → Com Reunião (reuniao = true)
UPDATE dashboard_widgets SET 
  title = 'Com Reunião',
  config = '{"format":"number","metric":"reuniao","aggregation":"count","dataSource":"kommo_leads_ecologica","sourceTable":"kommo_leads_ecologica","targetMetric":"meetings_total","showTrend":true,"showSparkline":true}'::jsonb,
  description = 'Leads que tiveram reunião'
WHERE id = '8b25610c-8cf3-4641-99dd-ec8bdc7a0c10';

-- Fix: Reuniões Agendadas - already correct table, keep
UPDATE dashboard_widgets SET 
  config = '{"format":"number","metric":"reuniao_agendada","aggregation":"count","dataSource":"kommo_leads_ecologica","sourceTable":"kommo_leads_ecologica","targetMetric":"meetings_scheduled","showTrend":true,"showSparkline":true}'::jsonb
WHERE id = '5702552f-cae4-4e7c-a7ce-db2f2961f376';

-- Fix: Reuniões Realizadas → use reuniao_realizada
UPDATE dashboard_widgets SET 
  config = '{"format":"number","metric":"reuniao_realizada","aggregation":"count","dataSource":"kommo_leads_ecologica","sourceTable":"kommo_leads_ecologica","targetMetric":"meetings_done","showTrend":true,"showSparkline":true}'::jsonb
WHERE id = 'f3ecac4c-c5a6-4deb-b9e6-5c9c2842ac85';

-- Change: Reuniões Concluídas → Destinos de Interesse
UPDATE dashboard_widgets SET 
  title = 'Destinos',
  config = '{"format":"number","metric":"destino_de_interesse","aggregation":"count","dataSource":"kommo_leads_ecologica","sourceTable":"kommo_leads_ecologica","targetMetric":"destinations","showTrend":true,"showSparkline":true}'::jsonb,
  description = 'Leads com destino definido'
WHERE id = 'cb6e6117-5a40-44d8-83a1-dad2fd87ea1b';

-- Hide: Investimento, CPL, Custo por Reunião (no financial data available)
UPDATE dashboard_widgets SET is_visible = false WHERE id IN (
  '931051d0-5fc0-4e44-914b-bda19b0d4811',
  '48635a62-98ec-48fa-87ae-ca6d972a448d',
  '65d73065-c9ca-49ae-93e7-31f5c2611c9a'
);

-- Fix: Conv. Lead → Reunião → use kommo_leads_ecologica
UPDATE dashboard_widgets SET 
  config = '{"format":"percentage","metric":"reuniao","aggregation":"count","dataSource":"kommo_leads_ecologica","sourceTable":"kommo_leads_ecologica","targetMetric":"lead_to_meeting_rate","showTrend":true,"showSparkline":true}'::jsonb
WHERE id = '961b9781-aac0-4a0e-a254-4a80446c933e';

-- Fix: Evolução Diária → group by data_criacao
UPDATE dashboard_widgets SET 
  config = '{"format":"number","metric":"nome_lead","aggregation":"count","groupBy":"data_criacao","dataSource":"kommo_leads_ecologica","sourceTable":"kommo_leads_ecologica","targetMetric":"daily_evolution"}'::jsonb
WHERE id = '11e6e784-1d54-4a71-9e66-3fbd7f78f470';

-- Fix: Pipeline → group by destino_de_interesse (more useful than origem_lead which is mostly null)
UPDATE dashboard_widgets SET 
  title = 'Pipeline por Destino',
  config = '{"format":"number","aggregation":"count","groupBy":"destino_de_interesse","dataSource":"kommo_leads_ecologica","sourceTable":"kommo_leads_ecologica","targetMetric":"pipeline_destination"}'::jsonb,
  description = 'Funil por destino de interesse'
WHERE id = 'ee05dee6-0f68-4396-87e4-cbc0a2219ee7';

-- Fix: Próximas Reuniões table
UPDATE dashboard_widgets SET 
  config = '{"format":"number","pageSize":5,"dataSource":"kommo_leads_ecologica","sourceTable":"kommo_leads_ecologica","targetMetric":"upcoming_meetings","columns":["nome_lead","destino_de_interesse","horario_reuniao","link_reuniao","vendedor"]}'::jsonb
WHERE id = '3e1893ec-e675-4f58-9732-4437c270b169';

-- Fix: Distribuição por Origem → keep but also group by destino_de_interesse since origem is mostly null
UPDATE dashboard_widgets SET 
  title = 'Destinos Populares',
  config = '{"format":"number","metric":"destino_de_interesse","aggregation":"count","groupBy":"destino_de_interesse","dataSource":"kommo_leads_ecologica","sourceTable":"kommo_leads_ecologica","targetMetric":"destinations_chart"}'::jsonb,
  description = 'Distribuição por destino'
WHERE id = 'efba15f0-172d-4cea-95a8-42bc926e3ccd';

-- Fix: Lista de Leads → kommo_leads_ecologica
UPDATE dashboard_widgets SET 
  config = '{"format":"number","pageSize":8,"dataSource":"kommo_leads_ecologica","sourceTable":"kommo_leads_ecologica","targetMetric":"leads_list","columns":["nome_lead","data_criacao","destino_de_interesse","quantidade_de_pessoas","vendedor","resumo"]}'::jsonb
WHERE id = 'd16e929f-497d-408d-9293-1b1c6681a51b';

-- Reorder positions (compact after hiding 3 widgets)
UPDATE dashboard_widgets SET position = 0 WHERE id = '2880d7bd-0ef3-44cc-8e14-565769d4cf7b'; -- Total Leads
UPDATE dashboard_widgets SET position = 1 WHERE id = '8b25610c-8cf3-4641-99dd-ec8bdc7a0c10'; -- Com Reunião
UPDATE dashboard_widgets SET position = 2 WHERE id = '5702552f-cae4-4e7c-a7ce-db2f2961f376'; -- Reuniões Agendadas
UPDATE dashboard_widgets SET position = 3 WHERE id = 'f3ecac4c-c5a6-4deb-b9e6-5c9c2842ac85'; -- Reuniões Realizadas
UPDATE dashboard_widgets SET position = 4 WHERE id = 'cb6e6117-5a40-44d8-83a1-dad2fd87ea1b'; -- Destinos
UPDATE dashboard_widgets SET position = 5 WHERE id = '961b9781-aac0-4a0e-a254-4a80446c933e'; -- Conv. Lead→Reunião
UPDATE dashboard_widgets SET position = 6 WHERE id = '11e6e784-1d54-4a71-9e66-3fbd7f78f470'; -- Evolução
UPDATE dashboard_widgets SET position = 7 WHERE id = 'ee05dee6-0f68-4396-87e4-cbc0a2219ee7'; -- Pipeline
UPDATE dashboard_widgets SET position = 8 WHERE id = '3e1893ec-e675-4f58-9732-4437c270b169'; -- Próximas Reuniões
UPDATE dashboard_widgets SET position = 9 WHERE id = 'efba15f0-172d-4cea-95a8-42bc926e3ccd'; -- Destinos Populares (pie)
UPDATE dashboard_widgets SET position = 10 WHERE id = 'ebf992b4-2bd6-45a0-8c1e-e008c4870aab'; -- Insights IA
UPDATE dashboard_widgets SET position = 11 WHERE id = 'd16e929f-497d-408d-9293-1b1c6681a51b'; -- Lista de Leads
