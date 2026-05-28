-- Captura snapshot diário de KPIs direto no banco via pg_cron, sem depender
-- do APScheduler do backend Python (que pode estar offline). Job percorre
-- todos os tenants que têm leads e chama bai_capture_daily_snapshot.

create extension if not exists pg_cron;

-- Função wrapper que itera tenants e captura snapshot pra cada um.
-- Idempotente — bai_capture_daily_snapshot usa upsert (on conflict).
create or replace function public.bai_capture_all_tenants_snapshot()
returns table (out_tenant_id uuid, rows_inserted int) language plpgsql as $$
declare
  t_id uuid;
  inserted int;
begin
  for t_id in
    select distinct l.tenant_id from public.crm_leads l
  loop
    inserted := public.bai_capture_daily_snapshot(t_id);
    out_tenant_id := t_id;
    rows_inserted := inserted;
    return next;
  end loop;
  return;
end;
$$;

comment on function public.bai_capture_all_tenants_snapshot is
  'Captura snapshot de todos tenants com crm_leads. Chamada por pg_cron 03:30 UTC.';

-- Agenda: todo dia às 03:30 UTC. Mesmo horário do APScheduler, mas dentro do
-- banco — sobrevive a deploys/reboots do backend.
-- `nodename`/`database` na extensão pg_cron do Supabase ficam no schema cron.
do $$
begin
  -- Remove agendamento anterior se existir (idempotência da migration).
  perform cron.unschedule(jobid)
    from cron.job
    where jobname = 'bai-daily-snapshot';

  perform cron.schedule(
    'bai-daily-snapshot',
    '30 3 * * *',
    $cron$ select public.bai_capture_all_tenants_snapshot(); $cron$
  );
exception when others then
  -- Em ambientes sem pg_cron disponível, falha silenciosa para a migration
  -- não bloquear o resto. O APScheduler continua sendo fallback.
  raise notice 'pg_cron schedule skipped: %', sqlerrm;
end$$;
