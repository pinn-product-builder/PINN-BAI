UPDATE public.dashboard_widgets 
SET config = '{
  "aggregation": "count",
  "dataSource": "kommo_leads",
  "groupBy": "created_at_iso",
  "metricField": "lead_id",
  "dataKeys": ["encaminhado", "atendimento_feito", "reuniao_confirmada", "reuniao_realizada", "venda", "desqualificado", "hermes_entrada"],
  "seriesLabels": {
    "encaminhado": "Encaminhado",
    "atendimento_feito": "Atendimento Feito",
    "reuniao_confirmada": "Reunião Confirmada",
    "reuniao_realizada": "Reunião Realizada",
    "venda": "Venda",
    "desqualificado": "Desqualificado",
    "hermes_entrada": "Entrada"
  }
}'::jsonb
WHERE id = 'faad445c-3513-4f7d-9fbe-3ba807a0b6e1';