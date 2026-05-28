-- E7.S3 — Webhooks reais nos data triggers.
--
-- kpi_alert_rules ganha campos de webhook target. threshold_service do backend
-- dispara POST quando uma regra é triggered. O trigger guarda status + corpo
-- da resposta pra auditoria.

alter table public.kpi_alert_rules
  add column if not exists webhook_url      text,
  add column if not exists webhook_method   text default 'POST',
  add column if not exists webhook_headers  jsonb default '{}'::jsonb,
  add column if not exists webhook_secret   text,
  add column if not exists last_triggered_at timestamptz,
  add column if not exists last_dispatch_status text,
  add column if not exists last_dispatch_at  timestamptz;

comment on column public.kpi_alert_rules.webhook_url is
  'URL para POST quando a regra disparar. NULL = sem webhook (regra grava só log).';
comment on column public.kpi_alert_rules.webhook_secret is
  'Secret enviado no header X-Webhook-Secret para autenticação do endpoint receptor.';
comment on column public.kpi_alert_rules.last_dispatch_status is
  'Status HTTP da última tentativa de dispatch (ex: "200", "404", "timeout", "error").';

alter table public.kpi_alert_triggers
  add column if not exists webhook_dispatched_at  timestamptz,
  add column if not exists webhook_response_code  int,
  add column if not exists webhook_response_body  text,
  add column if not exists webhook_error          text;

comment on column public.kpi_alert_triggers.webhook_dispatched_at is
  'Momento em que o webhook desta ocorrência foi disparado. NULL = não disparou ainda.';
