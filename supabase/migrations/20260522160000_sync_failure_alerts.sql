-- Alerta automático quando uma sync CRM fica em estado de erro por >=24h.
-- Insere em public.crm_alerts (já existente) com alert_type='sync_failure'.
-- Idempotente: só cria 1 alerta por tenant+provider enquanto não resolvido.

create or replace function public.detect_stale_sync_failures()
returns table (out_tenant_id uuid, provider text, action text) language plpgsql as $$
declare
  rec record;
  existing_id uuid;
begin
  for rec in
    select c.tenant_id, c.provider, c.sync_status, c.sync_error, c.last_sync_at
      from public.crm_auditor_connections c
     where c.provider in ('kommo', 'ploomes', 'omie')
  loop
    -- Resolve alertas antigos quando sync voltou a funcionar.
    if rec.sync_status = 'success' then
      update public.crm_alerts
         set resolved = true
       where tenant_id = rec.tenant_id
         and alert_type = 'sync_failure'
         and entity_external_id = rec.provider
         and resolved = false;
      continue;
    end if;

    -- Cria alerta se sync_status='error' OU sync ficou >24h sem rodar.
    if rec.sync_status = 'error'
       or (rec.last_sync_at is not null and rec.last_sync_at < now() - interval '24 hours')
    then
      select id into existing_id
        from public.crm_alerts
       where tenant_id = rec.tenant_id
         and alert_type = 'sync_failure'
         and entity_external_id = rec.provider
         and resolved = false
       limit 1;

      if existing_id is null then
        insert into public.crm_alerts (
          tenant_id, alert_type, severity, entity_type, entity_external_id, message, metadata
        ) values (
          rec.tenant_id,
          'sync_failure',
          'warning',
          'crm_connection',
          rec.provider,
          format(
            'Sync %s não atualiza há %s. %s',
            rec.provider,
            case when rec.last_sync_at is null then 'sempre' else age(now(), rec.last_sync_at)::text end,
            coalesce('Erro: ' || rec.sync_error, 'Sem erro reportado — verificar conexão.')
          ),
          jsonb_build_object(
            'provider', rec.provider,
            'sync_status', rec.sync_status,
            'sync_error', rec.sync_error,
            'last_sync_at', rec.last_sync_at,
            'detected_at', now()
          )
        );
        out_tenant_id := rec.tenant_id;
        provider := rec.provider;
        action := 'created';
        return next;
      else
        out_tenant_id := rec.tenant_id;
        provider := rec.provider;
        action := 'already-open';
        return next;
      end if;
    end if;
  end loop;
  return;
end;
$$;

comment on function public.detect_stale_sync_failures is
  'Cria entrada em crm_alerts quando sync CRM está com erro ou desatualizada >24h. Idempotente.';

-- Roda 1×/dia às 04:30 UTC — depois do snapshot (03:30) e do sync (04:00).
do $$
begin
  perform cron.unschedule(jobid)
    from cron.job
    where jobname = 'detect-sync-failures';

  perform cron.schedule(
    'detect-sync-failures',
    '30 4 * * *',
    $cron$ select public.detect_stale_sync_failures(); $cron$
  );
exception when others then
  raise notice 'pg_cron detect-sync-failures schedule skipped: %', sqlerrm;
end$$;
