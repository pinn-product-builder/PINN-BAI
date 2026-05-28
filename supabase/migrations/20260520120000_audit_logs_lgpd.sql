-- Audit logs LGPD-ready (E7.S1) — estende activity_logs com campos exigidos
-- por uma trilha LGPD: propósito do acesso, escopo de dados pessoais tocados,
-- fonte da requisição (UI/API/job).
--
-- O front continua usando o mesmo INSERT — só ganha campos opcionais.

alter table public.activity_logs
  add column if not exists purpose       text,
  add column if not exists data_scope    jsonb not null default '{}'::jsonb,
  add column if not exists source        text default 'ui',
  add column if not exists request_id    text;

comment on column public.activity_logs.purpose is
  'Finalidade do evento conforme LGPD: ex. "view", "export", "edit", "delete", "consent_change". Obrigatório nas operações sensíveis (data subject).';
comment on column public.activity_logs.data_scope is
  'JSON com lista de campos pessoais tocados. Schema sugerido: {entities: ["lead"], fields: ["email","phone","cpf"], pii_count: N}.';
comment on column public.activity_logs.source is
  'Origem do evento: "ui" | "api" | "job" | "edge_function" | "import". Default "ui".';
comment on column public.activity_logs.request_id is
  'Correlation ID — useful para amarrar logs do front com edge functions/backend (header X-Request-ID).';

create index if not exists idx_activity_logs_purpose
  on public.activity_logs (purpose) where purpose is not null;

create index if not exists idx_activity_logs_source
  on public.activity_logs (source, created_at desc);

-- ── View consolidada para o painel de auditoria LGPD ──────────────────────────
create or replace view public.vw_audit_recent as
select
  a.id,
  a.org_id,
  a.user_id,
  a.action,
  a.entity_type,
  a.entity_id,
  a.purpose,
  a.data_scope,
  a.source,
  a.ip_address,
  a.created_at,
  coalesce(p.full_name, p.email, 'anônimo')   as user_label
from public.activity_logs a
left join public.profiles p on p.user_id = a.user_id
where a.created_at >= now() - interval '90 days';

comment on view public.vw_audit_recent is
  'Janela rolante de 90 dias da activity_logs com nome do usuário resolvido. Usar no dashboard LGPD para data subject access requests.';

-- ── RPC: log_event — wrapper único que o front usa para gravar com a forma certa ──
create or replace function public.log_event(
  _org_id uuid,
  _action text,
  _entity_type text default null,
  _entity_id uuid default null,
  _purpose text default null,
  _data_scope jsonb default '{}'::jsonb,
  _source text default 'ui'
) returns uuid
language plpgsql security definer as $$
declare
  inserted_id uuid;
begin
  insert into public.activity_logs (
    org_id, user_id, action, entity_type, entity_id,
    purpose, data_scope, source
  ) values (
    _org_id, auth.uid(), _action, _entity_type, _entity_id,
    _purpose, _data_scope, _source
  )
  returning id into inserted_id;
  return inserted_id;
end;
$$;

revoke all on function public.log_event(uuid, text, text, uuid, text, jsonb, text) from public;
grant execute on function public.log_event(uuid, text, text, uuid, text, jsonb, text) to authenticated;
