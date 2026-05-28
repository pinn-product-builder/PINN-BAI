-- Bug 12 — Distinção CPF/CNPJ visível para o cliente.
--
-- Igor observou (reunião 19/05) que a auditoria interna já consegue diferenciar
-- PF de PJ a partir dos custom_fields do Kommo (CPF 11 dígitos vs CNPJ 14), mas
-- a UI cliente não expõe essa info. Para clientes B2B (Kitou, BF Company) é
-- decisivo qualificar leads automaticamente: contato PF em pipeline B2B é
-- ruído ou erro de captura.
--
-- Schema: nova coluna `person_type` em crm_norm_contacts. Valores: 'PF' | 'PJ'
-- | NULL (quando o catálogo de campos não tem CPF/CNPJ identificável).

alter table public.crm_norm_contacts
  add column if not exists person_type text;

comment on column public.crm_norm_contacts.person_type is
  'Tipo do contato: PF (CPF detectado) ou PJ (CNPJ detectado ou empresa vinculada). NULL = não identificável.';

-- View agregada para o dashboard cliente apresentar a distribuição PF/PJ
-- (qualifica leads automaticamente em operações B2B).
create or replace view public.vw_contact_person_type_distribution as
select
  tenant_id,
  count(*) filter (where person_type = 'PJ')                                  as pj_count,
  count(*) filter (where person_type = 'PF')                                  as pf_count,
  count(*) filter (where person_type is null)                                 as unknown_count,
  count(*)                                                                    as total_contacts,
  case
    when count(*) = 0 then 0::numeric
    else round(100.0 * count(*) filter (where person_type = 'PJ')::numeric / count(*), 2)
  end                                                                         as pj_pct
from public.crm_norm_contacts
group by tenant_id;
