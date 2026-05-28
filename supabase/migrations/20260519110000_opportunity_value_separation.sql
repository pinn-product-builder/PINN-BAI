-- Bug 2 — Separação de "valor em aberto" vs dívida do lead.
--
-- Cenário: Para tenants como Kitou (recuperação de crédito tributário) o campo
-- `price` do Kommo representa o passivo do lead (dívida), não a oportunidade
-- comercial real. Somar isso como "pipeline em aberto" produz números absurdos
-- (R$ 9M de "forecast" que é na verdade dívida).
--
-- Solução:
--   1. crm_auditor_connections ganha `value_config jsonb` para o tenant declarar
--      qual campo representa a oportunidade comercial e/ou qual transformação
--      aplicar ao `price` cru.
--   2. crm_leads ganha `opportunity_value numeric` (derivado, populado pelo
--      sync). `value` continua armazenando o `price` cru do CRM.
--   3. As views agregadas passam a usar `coalesce(opportunity_value, value)`
--      para que dashboards apresentem o valor comercial real.

alter table public.crm_auditor_connections
  add column if not exists value_config jsonb not null default '{}'::jsonb;

comment on column public.crm_auditor_connections.value_config is
  'Config de cálculo de oportunidade comercial. Schema: {value_is_debt: bool, commission_pct: number (0-1), fixed_fee: number, opportunity_field_id: text}';

alter table public.crm_leads
  add column if not exists opportunity_value numeric;

comment on column public.crm_leads.opportunity_value is
  'Valor da oportunidade comercial (quanto a empresa fatura com este lead). Derivado de value + value_config da connection. Null = usa value cru.';

-- Substitui as views agregadas trocando sum(value) por sum(coalesce(opportunity_value, value)).
-- Mantém o mesmo shape (mesmas colunas) para não quebrar consumidores existentes.

create or replace view public.vw_pipeline_health as
select
  l.tenant_id,
  l.pipeline_external_id,
  coalesce(p.name, l.pipeline_external_id) as pipeline_name,
  l.stage_external_id,
  coalesce(s.name, l.stage_external_id) as stage_name,
  count(*) filter (where l.lead_status = 'open') as open_leads,
  count(*) filter (where l.lead_status = 'won') as won_leads,
  count(*) filter (where l.lead_status = 'lost') as lost_leads,
  -- Sem opportunity_value definido, retorna 0 (não usa value cru — que para alguns
-- tenants representa a dívida do lead, não a oportunidade comercial real).
  coalesce(sum(coalesce(l.opportunity_value, 0)) filter (where l.lead_status = 'open'), 0) as open_pipeline_value
from public.crm_leads l
left join public.crm_pipelines p
  on p.tenant_id = l.tenant_id and p.external_id = l.pipeline_external_id
left join public.crm_stages s
  on s.tenant_id = l.tenant_id
  and s.pipeline_external_id = l.pipeline_external_id
  and s.external_id = l.stage_external_id
group by l.tenant_id, l.pipeline_external_id, p.name, l.stage_external_id, s.name;

create or replace view public.vw_owner_performance as
select
  l.tenant_id,
  l.owner_external_id,
  coalesce(u.name, l.owner_external_id) as owner_name,
  count(*) filter (where l.lead_status = 'open') as open_leads,
  count(*) filter (where l.lead_status = 'won') as won_leads,
  count(*) filter (where l.lead_status = 'lost') as lost_leads,
  coalesce(sum(coalesce(l.opportunity_value, 0)) filter (where l.lead_status = 'open'), 0) as open_value
from public.crm_leads l
left join public.crm_users u
  on u.tenant_id = l.tenant_id and u.external_id = l.owner_external_id
group by l.tenant_id, l.owner_external_id, u.name;
