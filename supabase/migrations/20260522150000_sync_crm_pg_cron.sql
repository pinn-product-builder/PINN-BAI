-- Sync diário das integrações CRM via pg_cron + pg_net.
-- Roda 04:00 UTC (depois do snapshot 03:30) e chama a edge function
-- correta pra cada tenant baseado no provider configurado.

create extension if not exists pg_net;

-- Função que itera todas as connections ativas e dispara HTTP POST
-- pra edge function correspondente. Idempotente — cada edge faz upsert.
create or replace function public.sync_all_crm_connections()
returns table (out_tenant_id uuid, provider text, status_code int, request_id bigint)
language plpgsql security definer as $$
declare
  rec record;
  fn text;
  body jsonb;
  base_url text := 'https://bkgwzxrutzmmxmxzfhmw.supabase.co/functions/v1';
  req_id bigint;
begin
  for rec in
    select c.tenant_id, c.provider
      from public.crm_auditor_connections c
     where c.provider in ('kommo', 'ploomes', 'omie')
  loop
    fn := 'sync-' || rec.provider;
    body := jsonb_build_object('org_id', rec.tenant_id);
    -- Edges sync-* foram deployadas com --no-verify-jwt; chamada sem Authorization.
    -- Async — resposta em net._http_response.
    select net.http_post(
      url := base_url || '/' || fn,
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := body,
      timeout_milliseconds := 300000  -- 5 min por sync
    ) into req_id;
    out_tenant_id := rec.tenant_id;
    provider := rec.provider;
    status_code := null;  -- async; status real chega depois em net._http_response
    request_id := req_id;
    return next;
  end loop;
  return;
end;
$$;

comment on function public.sync_all_crm_connections is
  'Dispara sync diário pra cada connection CRM (kommo/ploomes/omie). Async via pg_net — respostas em net._http_response.';

-- Agendamento: 04:00 UTC todo dia (snapshot é 03:30; sync depois).
do $$
begin
  perform cron.unschedule(jobid)
    from cron.job
    where jobname = 'sync-all-crm-connections';

  perform cron.schedule(
    'sync-all-crm-connections',
    '0 4 * * *',
    $cron$ select public.sync_all_crm_connections(); $cron$
  );
exception when others then
  raise notice 'pg_cron sync-all-crm-connections schedule skipped: %', sqlerrm;
end$$;
