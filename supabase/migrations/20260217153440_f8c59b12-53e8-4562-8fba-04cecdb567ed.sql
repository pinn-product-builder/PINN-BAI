-- 1. Executivo: Delete "Reuniões do Mês" table widget
DELETE FROM dashboard_widgets WHERE id = '2b5313be-91f5-44d6-9f91-a0ed5cb9ca9e';

-- 2. Ligações VAPI: Move "Motivos de Finalização" (pos 6, medium) next to "Tabela Diária" (pos 8, large)
-- Put them side by side: Tabela Diária medium at pos 7, Motivos medium at pos 7 (same row)
UPDATE dashboard_widgets SET position = 7, size = 'medium' WHERE id = '7ca910d1-8cd7-41de-8abc-f02ee10fa91f'; -- Tabela Diária → pos 7, medium
UPDATE dashboard_widgets SET position = 7, size = 'medium' WHERE id = '6bbec8bc-ae18-429c-878d-eb830512e083'; -- Motivos de Finalização → pos 7, medium
-- Últimas 50 Ligações stays at pos 6
UPDATE dashboard_widgets SET position = 6 WHERE id = '4ef713a3-3ad8-4322-849e-84858f026588'; -- Últimas 50 Ligações → pos 6

-- 3. Tráfego Pago: Put "Top 10 Anúncios" next to "Lista de Leads"
-- Both at same position (side by side), both medium
UPDATE dashboard_widgets SET position = 11, size = 'medium' WHERE id = 'fde0ccc7-7aa3-43fe-8acf-19442dc1f8a0'; -- Top 10 Anúncios → pos 11
UPDATE dashboard_widgets SET position = 11, size = 'medium' WHERE id = 'f06f96d9-9905-466d-b1fa-ebb751e73479'; -- Lista de Leads → pos 11