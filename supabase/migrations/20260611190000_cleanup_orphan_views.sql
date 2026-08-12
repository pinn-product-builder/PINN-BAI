-- Reconciliação (sessões paralelas + iterações): dropa objetos ÓRFÃOS e os que
-- já tinham sido removidos no banco fora de migration. Garante repo == banco num
-- `migrate` limpo (as migrations anteriores criam estes objetos; aqui dropamos os
-- que ficaram superados).
--
-- Por que cada um é órfão:
--   • vw_bai_crm_stage_distribution — o funil migrou pro RPC funnel_distribution
--     (20260611140000). A view (iterada em 210000-240000) não é mais usada.
--   • vw_bai_eco_leads_flat / eco_kpis_period — substituídos pelos RPCs GERAIS
--     crm_kpis_period/crm_lead_count/crm_lead_rate (20260611160000). Já dropados
--     no banco; aqui pro `migrate` limpo não recriá-los.
--   • vw_bai_eco_duracao/destino/kpis — cards repointados pro RPC genérico
--     custom_field_distribution (20260611150000). Bespoke da Ecológica, órfãos.
-- Verificado: nenhum outro objeto depende deles (pg_depend vazio).

drop view     if exists public.vw_bai_crm_stage_distribution;
drop view     if exists public.vw_bai_eco_leads_flat;
drop function if exists public.eco_kpis_period(uuid, timestamptz, timestamptz);
drop view     if exists public.vw_bai_eco_duracao;
drop view     if exists public.vw_bai_eco_destino;
drop view     if exists public.vw_bai_eco_kpis;
