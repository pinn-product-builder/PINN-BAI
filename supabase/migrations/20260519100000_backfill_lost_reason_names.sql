-- Backfill de crm_leads.lost_reason: substitui ID numérico do Kommo pelo nome textual.
-- Catálogo vem do snapshot mais recente em crm_snapshots.payload.extended_catalog.loss_reasons.
-- Idempotente: só atualiza linhas cujo valor atual ainda parece um ID (apenas dígitos).

with latest_snapshot as (
  select distinct on (tenant_id)
    tenant_id,
    payload -> 'extended_catalog' -> 'loss_reasons' as reasons
  from public.crm_snapshots
  where snapshot_kind = 'post_sync'
    and payload -> 'extended_catalog' -> 'loss_reasons' is not null
  order by tenant_id, created_at desc
),
reason_map as (
  select
    ls.tenant_id,
    (r ->> 'id') as reason_id,
    (r ->> 'name') as reason_name
  from latest_snapshot ls,
       jsonb_array_elements(ls.reasons) r
  where (r ->> 'id') is not null
    and (r ->> 'name') is not null
)
update public.crm_leads l
set lost_reason = rm.reason_name
from reason_map rm
where l.tenant_id = rm.tenant_id
  and l.lost_reason is not null
  and l.lost_reason ~ '^[0-9]+$'
  and l.lost_reason = rm.reason_id;

-- Limpa IDs órfãos que não foram resolvidos (sem nome no catálogo).
-- Mostrar "(não informado)" via view é melhor que exibir ID cru.
update public.crm_leads
set lost_reason = null
where lost_reason is not null
  and lost_reason ~ '^[0-9]+$';
