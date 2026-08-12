-- P2.1 (norte 10/jun): o Kommo (e CRMs em geral) só expõem o estágio ATUAL do
-- lead — sem histórico não dá para responder "foi pra reunião e voltou pro
-- follow-up" nem "onde os leads empacam".
--
-- Captura via TRIGGER em crm_leads: funciona para QUALQUER engine de sync
-- (edge sync-kommo, backend Python — ambos upsert por tenant_id+external_id),
-- sem mudança de código nos engines. INSERT registra a entrada do lead;
-- UPDATE só registra quando stage_external_id muda de fato.
--
-- Limitações documentadas (decisão da reunião de 10/jun):
--  * A mudança é detectada NO SYNC; occurred_at usa external_updated_at do CRM
--    como melhor estimativa do momento real da movimentação.
--  * Histórico confiável a partir do backfill ('backfill' = marco de corte por
--    org); o passado pré-conexão não é reconstruível.

create table if not exists public.crm_lead_stage_history (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  lead_external_id text not null,
  pipeline_external_id text,
  from_stage_external_id text,
  to_stage_external_id text,
  lead_status text,
  source text not null default 'sync_diff',   -- sync_diff | backfill | crm_event
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_clsh_tenant_lead
  on public.crm_lead_stage_history (tenant_id, lead_external_id, occurred_at desc);
create index if not exists idx_clsh_tenant_occurred
  on public.crm_lead_stage_history (tenant_id, occurred_at desc);

alter table public.crm_lead_stage_history enable row level security;

drop policy if exists "stage_history_select" on public.crm_lead_stage_history;
create policy "stage_history_select" on public.crm_lead_stage_history
  for select to authenticated
  using (public.user_can_read_tenant(tenant_id));

create or replace function public.capture_lead_stage_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.crm_lead_stage_history
      (tenant_id, lead_external_id, pipeline_external_id, from_stage_external_id,
       to_stage_external_id, lead_status, source, occurred_at)
    values
      (new.tenant_id, new.external_id, new.pipeline_external_id, null,
       new.stage_external_id, new.lead_status, 'sync_diff',
       coalesce(new.external_updated_at, new.created_at, now()));
  elsif new.stage_external_id is distinct from old.stage_external_id then
    insert into public.crm_lead_stage_history
      (tenant_id, lead_external_id, pipeline_external_id, from_stage_external_id,
       to_stage_external_id, lead_status, source, occurred_at)
    values
      (new.tenant_id, new.external_id, new.pipeline_external_id, old.stage_external_id,
       new.stage_external_id, new.lead_status, 'sync_diff',
       coalesce(new.external_updated_at, now()));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_crm_leads_stage_history on public.crm_leads;
create trigger trg_crm_leads_stage_history
  after insert or update on public.crm_leads
  for each row execute function public.capture_lead_stage_change();

-- Backfill: estado atual de cada lead vira a primeira linha do histórico
-- (source='backfill' = marco de corte "confiável a partir daqui").
insert into public.crm_lead_stage_history
  (tenant_id, lead_external_id, pipeline_external_id, from_stage_external_id,
   to_stage_external_id, lead_status, source, occurred_at)
select l.tenant_id, l.external_id, l.pipeline_external_id, null,
       l.stage_external_id, l.lead_status, 'backfill',
       coalesce(l.external_updated_at, l.created_at, now())
from public.crm_leads l
where not exists (
  select 1 from public.crm_lead_stage_history h
  where h.tenant_id = l.tenant_id and h.lead_external_id = l.external_id
);
