-- ─────────────────────────────────────────────────────────────────────────────
-- #41 — RLS nas tabelas que ficaram sem row level security (drift do baseline).
--
-- Achado de auditoria: 5 tabelas em public sem RLS. A mais grave é kommo_leads
-- (tem org_id + PII de lead: email/utm) — sem RLS, qualquer usuário autenticado
-- poderia ler leads de outro tenant. As edge functions usam service_role (que
-- bypassa RLS), então habilitar RLS NÃO quebra os widgets — só fecha o acesso
-- direto com JWT de usuário.
--
-- Política por tabela, casando o acesso atual:
--   kommo_leads          → leitura por tenant (defesa em profundidade).
--   dashboard_templates  → catálogo global: leitura/atualização p/ autenticado
--                          (useTemplates.incrementUsage faz update de usage_count
--                          inclusive em contexto não-admin), insert/delete só admin.
--   onboarding_requests  → PII de prospect, sem tenant → só platform_admin.
--   onboarding_steps     → processamento de onboarding → só platform_admin.
--   linkedin_sdr_aliases → interno Pinn → só platform_admin (views/edge = service).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── kommo_leads — leitura por tenant ────────────────────────────────────────
alter table public.kommo_leads enable row level security;
drop policy if exists "kommo_leads tenant read" on public.kommo_leads;
create policy "kommo_leads tenant read" on public.kommo_leads
  for select to authenticated
  using (public.user_can_read_tenant(org_id));
-- (escrita só via sync = service_role, que bypassa RLS → sem policy de escrita)

-- ── dashboard_templates — catálogo global ───────────────────────────────────
-- A tabela JÁ tinha policies (admin manage + leitura de ativos p/ authenticated/
-- anon), mas estavam DORMENTES porque RLS estava desligado. Aqui só ligamos o
-- RLS (ativando-as) e adicionamos um UPDATE permissivo: incrementUsage
-- (usage_count) precisa atualizar a linha, e o catálogo é global/não-sensível.
alter table public.dashboard_templates enable row level security;

drop policy if exists "dashboard_templates update" on public.dashboard_templates;
create policy "dashboard_templates update" on public.dashboard_templates
  for update to authenticated using (true) with check (true);

-- ── onboarding_requests / onboarding_steps — PII de prospect, só admin ───────
alter table public.onboarding_requests enable row level security;
drop policy if exists "onboarding_requests admin" on public.onboarding_requests;
create policy "onboarding_requests admin" on public.onboarding_requests
  for all to authenticated
  using (public.is_platform_admin(auth.uid()))
  with check (public.is_platform_admin(auth.uid()));

alter table public.onboarding_steps enable row level security;
drop policy if exists "onboarding_steps admin" on public.onboarding_steps;
create policy "onboarding_steps admin" on public.onboarding_steps
  for all to authenticated
  using (public.is_platform_admin(auth.uid()))
  with check (public.is_platform_admin(auth.uid()));

-- ── linkedin_sdr_aliases — interno Pinn ──────────────────────────────────────
alter table public.linkedin_sdr_aliases enable row level security;
drop policy if exists "linkedin_sdr_aliases admin" on public.linkedin_sdr_aliases;
create policy "linkedin_sdr_aliases admin" on public.linkedin_sdr_aliases
  for all to authenticated
  using (public.is_platform_admin(auth.uid()))
  with check (public.is_platform_admin(auth.uid()));
