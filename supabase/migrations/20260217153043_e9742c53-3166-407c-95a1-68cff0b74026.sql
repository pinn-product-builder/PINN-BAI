-- Fix "Reuniões (30d)" in Conversas dashboard: point to correct data source and field
UPDATE dashboard_widgets 
SET config = '{"aggregation":"sum","dataSource":"vw_afonsina_custos_funil_dia","format":"number","metric":"reuniao_agendada_total","showSparkline":true}'::jsonb
WHERE id = '599b8c60-a094-4046-aba6-e0368d528cec';

-- Fix "Conv. Lead→Reunião" in Conversas dashboard: use taxa_reuniao_agendada
UPDATE dashboard_widgets 
SET config = '{"aggregation":"avg","dataSource":"vw_afonsina_custos_funil_dia","format":"percentage","metric":"taxa_reuniao_agendada","showSparkline":true}'::jsonb
WHERE id = '0a99244b-ff8f-4989-8549-a57124800932';

-- Fix "Reuniões Realizadas" in Executivo dashboard: ensure it shows 0 (reuniao_realizada_total)
-- Already configured correctly with meetings_done → reuniao_realizada_total, which sums to 0