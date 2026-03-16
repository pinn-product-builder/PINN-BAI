
-- Fix widgets showing 0 by pointing to vw_afonsina_custos_funil_dia with correct field names

-- Novos Leads: leads_new from vw_afonsina_custos_funil_dia
UPDATE dashboard_widgets
SET config = jsonb_build_object(
  'dataSource', 'vw_afonsina_custos_funil_dia',
  'metric', 'leads_new',
  'aggregation', 'sum',
  'format', 'number',
  'showSparkline', true,
  'showTrend', true
)
WHERE id = '39a4fada-9dd1-4239-82bf-4552071da75c';

-- Reuniões Agendadas: meetings_booked from vw_afonsina_custos_funil_dia
UPDATE dashboard_widgets
SET config = jsonb_build_object(
  'dataSource', 'vw_afonsina_custos_funil_dia',
  'metric', 'meetings_booked',
  'aggregation', 'sum',
  'format', 'number',
  'showSparkline', true,
  'showTrend', true
)
WHERE id = '370a372d-f69f-4e22-ad1a-97312c413389';

-- Reuniões Realizadas: meetings_done from vw_afonsina_custos_funil_dia
UPDATE dashboard_widgets
SET config = jsonb_build_object(
  'dataSource', 'vw_afonsina_custos_funil_dia',
  'metric', 'meetings_done',
  'aggregation', 'sum',
  'format', 'number',
  'showSparkline', true,
  'showTrend', true
)
WHERE id = '31c49e62-23fc-4dca-9c70-a4ac4cd347cc';

-- CPL: cpl from vw_afonsina_custos_funil_dia (field may be 'cpl' not 'cpl_30d')
UPDATE dashboard_widgets
SET config = jsonb_build_object(
  'dataSource', 'vw_afonsina_custos_funil_dia',
  'metric', 'cpl',
  'aggregation', 'avg',
  'format', 'currency',
  'showSparkline', true,
  'showTrend', true
)
WHERE id = '63301a48-a7a0-4893-88f3-9eefc289ccdb';

-- Taxa de Conversão: taxa_entrada from vw_afonsina_custos_funil_dia
UPDATE dashboard_widgets
SET config = jsonb_build_object(
  'dataSource', 'vw_afonsina_custos_funil_dia',
  'metric', 'taxa_entrada',
  'aggregation', 'avg',
  'format', 'percentage',
  'showSparkline', true,
  'showTrend', true
)
WHERE id = 'c5514de0-b022-4a71-be99-1649a6a36d31';
